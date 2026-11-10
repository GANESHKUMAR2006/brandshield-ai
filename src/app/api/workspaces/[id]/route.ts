import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canConfigureWorkspace, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
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
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, name, slug, created_at, updated_at
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
