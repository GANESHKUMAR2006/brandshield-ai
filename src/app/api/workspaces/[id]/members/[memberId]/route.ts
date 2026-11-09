import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveServerSession, canManageWorkspaceMembers } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { ReviewerRole } from "@/types";

const updateRoleSchema = z.object({
  role: z.enum(["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await resolveServerSession();

    // Verify caller has admin permission in this workspace
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );

    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can modify member roles" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = updateRoleSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: "Invalid role specified" }, { status: 400 });
    }

    const { role } = validated.data;

    // Check target membership exists
    const targetCheck = await query<{ id: string; user_id: string; role: string }>(
      `SELECT id, user_id, role FROM workspace_memberships WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [memberId, id]
    );

    if (targetCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Membership record not found" }, { status: 404 });
    }

    const currentMember = targetCheck.rows[0];

    // Prevent removing the sole active admin
    if (currentMember.role === "admin" && role !== "admin") {
      const adminCount = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM workspace_memberships WHERE workspace_id = $1 AND role = 'admin' AND status = 'active'`,
        [id]
      );
      if (parseInt(adminCount.rows[0]?.count || "0", 10) <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot change role of the sole workspace administrator" },
          { status: 400 }
        );
      }
    }

    const updateRes = await query<{ id: string; role: string; updated_at: string }>(
      `UPDATE workspace_memberships
       SET role = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, role, updated_at`,
      [role, memberId]
    );

    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      entityType: "workspace",
      entityId: memberId,
      action: "member_role_updated",
      beforeState: { role: currentMember.role },
      afterState: { role },
    });

    return NextResponse.json({
      success: true,
      message: `Member role updated to "${role}"`,
      member: updateRes.rows[0],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update member role" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const session = await resolveServerSession();

    // Verify caller has admin permission
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );

    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can remove members" },
        { status: 403 }
      );
    }

    // Check target membership exists
    const targetCheck = await query<{ id: string; user_id: string; role: string }>(
      `SELECT id, user_id, role FROM workspace_memberships WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [memberId, id]
    );

    if (targetCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Membership record not found" }, { status: 404 });
    }

    const currentMember = targetCheck.rows[0];

    // Cannot remove sole active admin
    if (currentMember.role === "admin") {
      const adminCount = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM workspace_memberships WHERE workspace_id = $1 AND role = 'admin' AND status = 'active'`,
        [id]
      );
      if (parseInt(adminCount.rows[0]?.count || "0", 10) <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot remove the sole workspace administrator" },
          { status: 400 }
        );
      }
    }

    // Revoke membership
    await query(
      `UPDATE workspace_memberships SET status = 'revoked', updated_at = now() WHERE id = $1`,
      [memberId]
    );

    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      entityType: "workspace",
      entityId: memberId,
      action: "member_removed",
      beforeState: { userId: currentMember.user_id, role: currentMember.role },
    });

    return NextResponse.json({
      success: true,
      message: "Member removed from workspace successfully",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}
