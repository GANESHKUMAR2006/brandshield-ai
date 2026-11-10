import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  resolveServerSession,
  resolveAuthenticatedUser,
  canConfigureWorkspace,
  isValidUUID,
} from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify workspace exists
    const wsRes = await query<{
      id: string;
      name: string;
      slug: string;
      status: string;
      archived_at: string | null;
      archived_by: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, slug, COALESCE(status, 'active') as status, archived_at, archived_by, created_at, updated_at
       FROM workspaces
       WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (wsRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    const ws = wsRes.rows[0];

    // Verify user membership in this workspace (prevent non-UUID demo leakage into UUID parameter)
    const memberCheck = isValidUUID(session.userId)
      ? await query(
          `SELECT id, role, status FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    if (memberCheck.rows.length === 0 && session.workspaceId !== id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not a member of this workspace" },
        { status: 403 }
      );
    }

    // Get member stats
    const statsRes = await query<{ member_count: string; submission_count: string }>(
      `SELECT 
         (SELECT COUNT(*)::text FROM workspace_memberships WHERE workspace_id = $1 AND status = 'active') as member_count,
         (SELECT COUNT(*)::text FROM submissions WHERE workspace_id = $1) as submission_count`,
      [id]
    );

    return NextResponse.json({
      success: true,
      workspace: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        status: ws.status,
        archivedAt: ws.archived_at,
        archivedBy: ws.archived_by,
        createdAt: ws.created_at,
        updatedAt: ws.updated_at,
        memberCount: parseInt(statsRes.rows[0]?.member_count || "1", 10),
        submissionCount: parseInt(statsRes.rows[0]?.submission_count || "0", 10),
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id] Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load workspace", correlationId },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Check workspace admin permission (prevent non-UUID demo leakage into UUID parameter)
    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const userRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canConfigureWorkspace(userRole as any)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can modify organization settings" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = updateWorkspaceSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    const { name } = validated.data;
    if (!name) {
      return NextResponse.json({ success: false, error: "No changes provided" }, { status: 400 });
    }

    const updateRes = await query<{ id: string; name: string; slug: string; updated_at: string }>(
      `UPDATE workspaces
       SET name = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, name, slug, updated_at`,
      [name, id]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    try {
      await AuditService.recordEvent({
        workspaceId: id,
        actorId: session.userId,
        entityType: "workspace",
        entityId: id,
        action: "workspace_updated",
        afterState: { name },
      });
    } catch (auditErr) {
      console.error("[PATCH /api/workspaces/[id]] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Workspace updated successfully",
      workspace: updateRes.rows[0],
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[PATCH /api/workspaces/[id] Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to update workspace", correlationId },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[id]
 *
 * Compliance-governed Organization Lifecycle Archival (Soft Deletion).
 *
 * Regulatory & Legal Notice:
 * Under FDA 21 CFR Part 11, FTC Marketing Substantiation, and ISO 22716,
 * physical hard deletion of organizations is prohibited to prevent spoliation of
 * compliance records, evidentiary audits, and historical review determinations.
 *
 * Workflow:
 * 1. Authenticates strictly via verified Supabase server session (UUID).
 * 2. Validates caller is active 'admin' in target workspace memberships.
 * 3. Prohibits cross-tenant tampering.
 * 4. Requires exact organization name confirmation.
 * 5. Atomically:
 *    - Updates workspaces.status = 'archived', archived_at, archived_by.
 *    - Suspends all active memberships (status = 'suspended').
 *    - Revokes pending invitations (status = 'revoked').
 *    - Appends an immutable audit event to the compliance audit trail.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Strict UUID validation on workspace ID parameter
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid workspace ID: Must be a valid UUID format." },
        { status: 400 }
      );
    }

    // 2. Resolve authenticated user identity exclusively from validated server session
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required to archive organization." },
        { status: 401 }
      );
    }

    // 3. User UUID integrity check
    if (!isValidUUID(user.id)) {
      return NextResponse.json(
        { success: false, error: "Authentication required: A valid authenticated user UUID session is required." },
        { status: 401 }
      );
    }

    // 4. Verify workspace exists and check current lifecycle status
    const wsRes = await query<{
      id: string;
      name: string;
      slug: string;
      status: string;
    }>(
      `SELECT id, name, slug, COALESCE(status, 'active') as status
       FROM workspaces
       WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (wsRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Workspace not found." },
        { status: 404 }
      );
    }

    const ws = wsRes.rows[0];

    // 5. Check if already archived
    if (ws.status === "archived") {
      return NextResponse.json(
        { success: false, error: `Organization "${ws.name}" is already archived.` },
        { status: 400 }
      );
    }

    // 6. Strict RBAC & Tenant Verification: User must have active 'admin' role in this workspace
    const memberRes = await query<{ role: string; status: string }>(
      `SELECT role, status
       FROM workspace_memberships
       WHERE workspace_id = $1 AND user_id = $2
       LIMIT 1`,
      [id, user.id]
    );

    if (memberRes.rows.length === 0 || memberRes.rows[0].status !== "active") {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not an active member of this organization." },
        { status: 403 }
      );
    }

    if (memberRes.rows[0].role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only organization administrators can archive an organization." },
        { status: 403 }
      );
    }

    // 7. Parse request body for name confirmation and parameters
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body. Organization confirmation is required." },
        { status: 400 }
      );
    }

    // 8. Strict rejection of permanent hard deletion
    if (body.hardDelete === true) {
      return NextResponse.json(
        {
          success: false,
          error: "Permanent hard deletion is prohibited under compliance regulations (FDA 21 CFR Part 11, FTC Marketing Substantiation, ISO 22716). All records must be preserved via Archival.",
        },
        { status: 400 }
      );
    }

    // 9. Exact organization name confirmation verification
    const confirmName = typeof body.confirmName === "string" ? body.confirmName.trim() : "";
    if (!confirmName || confirmName.toLowerCase() !== ws.name.trim().toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: `Organization name confirmation does not match. Expected "${ws.name}".`,
        },
        { status: 400 }
      );
    }

    // 10. Execute Archival lifecycle transition in an atomic transaction
    await withTransaction(async (client) => {
      // 10a. Update workspace status to archived
      await client.query(
        `UPDATE workspaces
         SET status = 'archived',
             archived_at = now(),
             archived_by = $1,
             updated_at = now()
         WHERE id = $2`,
        [user.id, id]
      );

      // 10b. Suspend all active workspace memberships
      await client.query(
        `UPDATE workspace_memberships
         SET status = 'suspended',
             updated_at = now()
         WHERE workspace_id = $1 AND status = 'active'`,
        [id]
      );

      // 10c. Revoke all pending invitations
      await client.query(
        `UPDATE workspace_invitations
         SET status = 'revoked',
             updated_at = now()
         WHERE workspace_id = $1 AND status = 'pending'`,
        [id]
      );

      // 10d. Record tamper-evident audit event
      await AuditService.recordEvent(
        {
          workspaceId: id,
          actorId: user.id,
          actorRole: "admin",
          entityType: "workspace",
          entityId: id,
          action: "workspace_archived",
          beforeState: {
            status: ws.status,
            name: ws.name,
            slug: ws.slug,
          },
          afterState: {
            status: "archived",
            archived_at: new Date().toISOString(),
            archived_by: user.id,
            reason: body.reason || "Administrative organization archival",
          },
        },
        client
      );
    });

    return NextResponse.json({
      success: true,
      message: `Organization "${ws.name}" has been successfully archived. Active memberships have been suspended and audit records preserved.`,
      workspace: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        status: "archived",
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[DELETE /api/workspaces/[id] Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to archive organization.", correlationId },
      { status: 500 }
    );
  }
}
