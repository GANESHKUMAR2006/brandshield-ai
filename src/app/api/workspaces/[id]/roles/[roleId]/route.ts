import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { isValidPermission, PermissionKey } from "@/lib/auth/permissions";
import { ReviewerRole } from "@/types";

const RESERVED_NAMES = ["admin", "administrator", "superadmin", "owner"];

const updateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(60).optional(),
  description: z.string().max(255).optional(),
  permissions: z.array(z.string()).min(1, "Select at least one permission").optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id, roleId } = await params;
    const session = await resolveServerSession();

    // Verify membership
    const memberCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );

    if (memberCheck.rows.length === 0 && session.workspaceId !== id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not an active member of this workspace" },
        { status: 403 }
      );
    }

    const roleRes = await query<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
      member_count: string;
    }>(
      `SELECT
         wr.id,
         wr.name,
         wr.description,
         wr.created_at,
         wr.updated_at,
         COUNT(wm.id)::text as member_count
       FROM workspace_roles wr
       LEFT JOIN workspace_memberships wm
         ON wm.custom_role_id = wr.id AND wm.status = 'active' AND wm.workspace_id = $1
       WHERE wr.id = $2 AND wr.workspace_id = $1
       GROUP BY wr.id, wr.name, wr.description, wr.created_at, wr.updated_at LIMIT 1`,
      [id, roleId]
    );

    if (roleRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }

    const permsRes = await query<{ permission: string }>(
      `SELECT permission FROM workspace_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
      [roleId, id]
    );

    const r = roleRes.rows[0];
    return NextResponse.json({
      success: true,
      role: {
        id: r.id,
        name: r.name,
        description: r.description || "",
        permissions: permsRes.rows.map((p) => p.permission),
        memberCount: parseInt(r.member_count, 10),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/roles/[roleId] Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load role", correlationId },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id, roleId } = await params;
    const session = await resolveServerSession();

    // Verify caller is admin
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );
    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can edit custom roles" },
        { status: 403 }
      );
    }

    // Verify role exists and belongs to this workspace
    const existingRoleRes = await query<{ id: string; name: string; description: string | null }>(
      `SELECT id, name, description FROM workspace_roles WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [roleId, id]
    );
    if (existingRoleRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }
    const existingRole = existingRoleRes.rows[0];

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = updateRoleSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { name, description, permissions } = validated.data;
    let targetName = existingRole.name;

    if (name !== undefined) {
      const trimmed = name.trim();
      if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: `Role name "${trimmed}" is reserved. Choose another name.` },
          { status: 400 }
        );
      }
      // Check collision
      const dupCheck = await query<{ id: string }>(
        `SELECT id FROM workspace_roles WHERE workspace_id = $1 AND lower(name) = lower($2) AND id != $3 LIMIT 1`,
        [id, trimmed, roleId]
      );
      if (dupCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: `Another role named "${trimmed}" already exists in this workspace.` },
          { status: 409 }
        );
      }
      targetName = trimmed;
    }

    const targetDesc = description !== undefined ? description : existingRole.description || "";

    // Update role record
    await query(
      `UPDATE workspace_roles
       SET name = $1, description = $2, updated_at = now()
       WHERE id = $3 AND workspace_id = $4`,
      [targetName, targetDesc, roleId, id]
    );

    // If permissions array provided, atomically replace permissions
    let finalPerms: PermissionKey[] = [];
    if (permissions !== undefined) {
      finalPerms = permissions.filter(isValidPermission);
      if (finalPerms.length === 0) {
        return NextResponse.json(
          { success: false, error: "Custom role must retain at least one valid permission" },
          { status: 400 }
        );
      }

      await query(`DELETE FROM workspace_role_permissions WHERE role_id = $1 AND workspace_id = $2`, [roleId, id]);
      for (const p of finalPerms) {
        await query(
          `INSERT INTO workspace_role_permissions (workspace_id, role_id, permission)
           VALUES ($1, $2, $3)
           ON CONFLICT (role_id, permission) DO NOTHING`,
          [id, roleId, p]
        );
      }
    } else {
      const currentPermsRes = await query<{ permission: string }>(
        `SELECT permission FROM workspace_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
        [roleId, id]
      );
      finalPerms = currentPermsRes.rows.map((r) => r.permission as PermissionKey);
    }

    // Record audit event
    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
      entityType: "workspace",
      entityId: roleId,
      action: "custom_role_updated",
      beforeState: {
        name: existingRole.name,
        description: existingRole.description,
      },
      afterState: {
        name: targetName,
        description: targetDesc,
        permissionCount: finalPerms.length,
        permissions: finalPerms,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Role "${targetName}" updated successfully`,
      role: {
        id: roleId,
        name: targetName,
        description: targetDesc,
        permissions: finalPerms,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[PATCH /api/workspaces/[id]/roles/[roleId] Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to update custom role", correlationId },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roleId: string }> }
) {
  try {
    const { id, roleId } = await params;
    const session = await resolveServerSession();

    // Verify caller is admin
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );
    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can delete custom roles" },
        { status: 403 }
      );
    }

    // Verify role exists and belongs to this workspace
    const existingRoleRes = await query<{ id: string; name: string }>(
      `SELECT id, name FROM workspace_roles WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
      [roleId, id]
    );
    if (existingRoleRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Role not found" }, { status: 404 });
    }
    const roleName = existingRoleRes.rows[0].name;

    // Check if role is assigned to any active members
    const memberCheck = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM workspace_memberships
       WHERE workspace_id = $1 AND custom_role_id = $2 AND status = 'active'`,
      [id, roleId]
    );
    const activeCount = parseInt(memberCheck.rows[0]?.count || "0", 10);
    if (activeCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role "${roleName}": ${activeCount} active member(s) are currently assigned to this role. Please reassign their roles first.`,
        },
        { status: 400 }
      );
    }

    // Delete role (workspace_role_permissions & workspace_member_roles deleted via CASCADE)
    await query(`DELETE FROM workspace_roles WHERE id = $1 AND workspace_id = $2`, [roleId, id]);

    // Record audit event
    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
      entityType: "workspace",
      entityId: roleId,
      action: "custom_role_deleted",
      beforeState: {
        roleId,
        roleName,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Role "${roleName}" was successfully deleted`,
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[DELETE /api/workspaces/[id]/roles/[roleId] Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to delete custom role", correlationId },
      { status: 500 }
    );
  }
}
