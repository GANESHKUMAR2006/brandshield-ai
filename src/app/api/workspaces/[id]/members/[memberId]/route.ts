import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { isBuiltInRole, BUILTIN_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { ReviewerRole } from "@/types";

const updateRoleSchema = z.object({
  role: z.string().min(1, "Role is required"),
  customRoleId: z.string().uuid().optional(),
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
      return NextResponse.json(
        { success: false, error: "Invalid role specified", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { role: requestedRole, customRoleId: explicitCustomRoleId } = validated.data;

    // Check target membership exists
    const targetCheck = await query<{ id: string; user_id: string; role: string; custom_role_id: string | null }>(
      `SELECT id, user_id, role, custom_role_id FROM workspace_memberships WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [memberId, id]
    );

    if (targetCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Membership record not found" }, { status: 404 });
    }

    const currentMember = targetCheck.rows[0];

    // Determine target role type: built-in vs custom
    let targetBuiltinRole: ReviewerRole | null = null;
    let targetCustomRoleId: string | null = null;
    let targetRoleDisplayName = "";
    const roleString = String(requestedRole).trim();

    if (explicitCustomRoleId) {
      targetCustomRoleId = explicitCustomRoleId;
    } else if (isBuiltInRole(roleString)) {
      targetBuiltinRole = roleString;
    } else if (isValidUUID(roleString)) {
      targetCustomRoleId = roleString;
    } else {
      // Lookup by custom role name within this workspace
      const roleByName = await query<{ id: string; name: string }>(
        `SELECT id, name FROM workspace_roles WHERE workspace_id = $1 AND lower(name) = lower($2) LIMIT 1`,
        [id, roleString]
      );
      if (roleByName.rows.length > 0) {
        targetCustomRoleId = roleByName.rows[0].id;
        targetRoleDisplayName = roleByName.rows[0].name;
      } else {
        return NextResponse.json(
          { success: false, error: `Invalid role "${roleString}". Role does not exist.` },
          { status: 400 }
        );
      }
    }

    // If target is a custom role, verify it belongs strictly to this workspace
    if (targetCustomRoleId) {
      const crCheck = await query<{ id: string; name: string }>(
        `SELECT id, name FROM workspace_roles WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [targetCustomRoleId, id]
      );
      if (crCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "The specified custom role does not exist in this workspace." },
          { status: 404 }
        );
      }
      targetRoleDisplayName = crCheck.rows[0].name;
    } else if (targetBuiltinRole) {
      targetRoleDisplayName = targetBuiltinRole;
    }

    // Safeguard: Prevent demoting the last active administrator
    const isTargetingAdmin = targetBuiltinRole === "admin";
    if (currentMember.role === "admin" && !isTargetingAdmin) {
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

    let updatedMembership: any;

    if (targetCustomRoleId) {
      // Assign custom role
      const updateRes = await query<{ id: string; role: string; custom_role_id: string; updated_at: string }>(
        `UPDATE workspace_memberships
         SET role = 'custom', custom_role_id = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3
         RETURNING id, role, custom_role_id, updated_at`,
        [targetCustomRoleId, memberId, id]
      );
      updatedMembership = updateRes.rows[0];

      // Update workspace_member_roles link table
      await query(`DELETE FROM workspace_member_roles WHERE membership_id = $1`, [memberId]);
      await query(
        `INSERT INTO workspace_member_roles (workspace_id, membership_id, role_id, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (membership_id, role_id) DO NOTHING`,
        [id, memberId, targetCustomRoleId, session.userId]
      );
    } else if (targetBuiltinRole) {
      // Assign built-in role
      const updateRes = await query<{ id: string; role: string; custom_role_id: string | null; updated_at: string }>(
        `UPDATE workspace_memberships
         SET role = $1, custom_role_id = NULL, updated_at = now()
         WHERE id = $2 AND workspace_id = $3
         RETURNING id, role, custom_role_id, updated_at`,
        [targetBuiltinRole, memberId, id]
      );
      updatedMembership = updateRes.rows[0];

      // Clear custom role link
      await query(`DELETE FROM workspace_member_roles WHERE membership_id = $1`, [memberId]);
    }

    // Record audit event
    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
      entityType: "workspace",
      entityId: memberId,
      action: "member_role_updated",
      beforeState: {
        role: currentMember.role,
        customRoleId: currentMember.custom_role_id,
      },
      afterState: {
        role: targetBuiltinRole || "custom",
        customRoleId: targetCustomRoleId,
        roleName: targetRoleDisplayName,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Member role updated to "${targetRoleDisplayName}"`,
      member: {
        ...updatedMembership,
        roleName: targetRoleDisplayName,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[PATCH /api/workspaces/[id]/members/[memberId] Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update member role", correlationId },
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
      `UPDATE workspace_memberships SET status = 'revoked', updated_at = now() WHERE id = $1 AND workspace_id = $2`,
      [memberId, id]
    );

    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
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
    const correlationId = crypto.randomUUID();
    console.error(`[DELETE /api/workspaces/[id]/members/[memberId] Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to remove member", correlationId },
      { status: 500 }
    );
  }
}
