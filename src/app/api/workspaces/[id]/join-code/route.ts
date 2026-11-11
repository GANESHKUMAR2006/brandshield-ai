import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { ReviewerRole } from "@/types";

/**
 * GET /api/workspaces/[id]/join-code
 * Retrieve status of organization join code (whether active, updated_at).
 * Admin only. Raw code is never permanently stored, so this returns whether enabled.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can view join code settings" },
        { status: 403 }
      );
    }

    const res = await query<{
      join_code_enabled: boolean;
      join_code_updated_at: string | null;
      join_code_hash: string | null;
    }>(
      `SELECT join_code_enabled, join_code_updated_at, join_code_hash
       FROM workspaces
       WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    const ws = res.rows[0];
    const hasActiveCode = Boolean(ws.join_code_hash && ws.join_code_enabled);

    return NextResponse.json({
      success: true,
      hasActiveCode,
      enabled: ws.join_code_enabled ?? false,
      updatedAt: ws.join_code_updated_at,
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/join-code Error] [${correlationId}]:`, err);
    return NextResponse.json({ success: false, error: "Failed to retrieve join code status", correlationId }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/[id]/join-code
 * Generate or rotate organization join code.
 * Generates an 8-character uppercase alphanumeric code (e.g. "BS-9X4K2P").
 * Computes SHA-256 hash, saves hash in database, returns raw code to admin once.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can generate or rotate join codes" },
        { status: 403 }
      );
    }

    // Generate readable code: 8 chars alphanumeric, uppercase
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const joinCode = `BS-${randomHex}`;
    const joinCodeHash = crypto.createHash("sha256").update(joinCode.trim().toUpperCase()).digest("hex");

    await query(
      `UPDATE workspaces
       SET join_code_hash = $1,
           join_code_enabled = true,
           join_code_updated_at = now(),
           join_code_updated_by = $2
       WHERE id = $3`,
      [joinCodeHash, isValidUUID(session.userId) ? session.userId : null, id]
    );

    // Audit log
    try {
      await AuditService.recordEvent({
        workspaceId: id,
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.userName,
        actorEmail: session.userEmail,
        entityType: "workspace",
        entityId: id,
        action: "join_code_rotated",
        afterState: { enabled: true, rotatedAt: new Date().toISOString() },
      });
    } catch (auditErr) {
      console.error("[POST /api/workspaces/[id]/join-code] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Organization join code generated successfully.",
      joinCode, // Only returned once upon generation/rotation
      enabled: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/[id]/join-code Error] [${correlationId}]:`, err);
    return NextResponse.json({ success: false, error: "Failed to generate join code", correlationId }, { status: 500 });
  }
}

/**
 * DELETE /api/workspaces/[id]/join-code
 * Revoke/disable organization join code.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can revoke join codes" },
        { status: 403 }
      );
    }

    await query(
      `UPDATE workspaces
       SET join_code_enabled = false,
           join_code_updated_at = now(),
           join_code_updated_by = $1
       WHERE id = $2`,
      [isValidUUID(session.userId) ? session.userId : null, id]
    );

    try {
      await AuditService.recordEvent({
        workspaceId: id,
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.userName,
        actorEmail: session.userEmail,
        entityType: "workspace",
        entityId: id,
        action: "join_code_revoked",
        afterState: { enabled: false, revokedAt: new Date().toISOString() },
      });
    } catch (auditErr) {
      console.error("[DELETE /api/workspaces/[id]/join-code] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Organization join code revoked successfully. No new join requests can use this code.",
      enabled: false,
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[DELETE /api/workspaces/[id]/join-code Error] [${correlationId}]:`, err);
    return NextResponse.json({ success: false, error: "Failed to revoke join code", correlationId }, { status: 500 });
  }
}

