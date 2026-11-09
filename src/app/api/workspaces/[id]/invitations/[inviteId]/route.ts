import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession, canManageWorkspaceMembers } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { ReviewerRole } from "@/types";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const { id, inviteId } = await params;
    const session = await resolveServerSession();

    // Verify admin permission
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );

    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can revoke invitations" },
        { status: 403 }
      );
    }

    const inviteCheck = await query<{ id: string; email: string; status: string }>(
      `SELECT id, email, status FROM workspace_invitations WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [inviteId, id]
    );

    if (inviteCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
    }

    const invitation = inviteCheck.rows[0];

    // Revoke invitation
    await query(
      `UPDATE workspace_invitations SET status = 'revoked', updated_at = now() WHERE id = $1`,
      [inviteId]
    );

    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      entityType: "workspace",
      entityId: inviteId,
      action: "invitation_revoked",
      beforeState: { email: invitation.email, status: invitation.status },
    });

    return NextResponse.json({
      success: true,
      message: `Invitation to "${invitation.email}" revoked successfully`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}
