import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { BUILTIN_ROLE_PERMISSIONS, isBuiltInRole, PermissionKey } from "@/lib/auth/permissions";
import { ReviewerRole } from "@/types";

export async function POST(
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
        { success: false, error: "Forbidden: Only workspace administrators can duplicate roles" },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    let sourceName = "";
    let sourceDescription = "";
    let sourcePermissions: PermissionKey[] = [];

    // Check if duplicating a built-in role (id formatted as "builtin-{roleKey}")
    if (roleId.startsWith("builtin-")) {
      const roleKey = roleId.replace("builtin-", "");
      if (!isBuiltInRole(roleKey)) {
        return NextResponse.json({ success: false, error: "Invalid built-in role template" }, { status: 400 });
      }
      sourceName = roleKey
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      sourceDescription = `Cloned from built-in ${sourceName} role template.`;
      sourcePermissions = BUILTIN_ROLE_PERMISSIONS[roleKey];
    } else {
      // Duplicating an existing custom role
      const customRoleRes = await query<{ id: string; name: string; description: string | null }>(
        `SELECT id, name, description FROM workspace_roles WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
        [roleId, id]
      );
      if (customRoleRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Source custom role not found" }, { status: 404 });
      }
      sourceName = customRoleRes.rows[0].name;
      sourceDescription = customRoleRes.rows[0].description || "";

      const permsRes = await query<{ permission: string }>(
        `SELECT permission FROM workspace_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
        [roleId, id]
      );
      sourcePermissions = permsRes.rows.map((p) => p.permission as PermissionKey);
    }

    // Determine target name
    const requestedName = typeof body.name === "string" && body.name.trim().length > 0 ? body.name.trim() : null;
    let newName = requestedName || `${sourceName} (Copy)`;

    // Check for collisions and append suffix if necessary
    let counter = 1;
    while (true) {
      const dup = await query<{ id: string }>(
        `SELECT id FROM workspace_roles WHERE workspace_id = $1 AND lower(name) = lower($2) LIMIT 1`,
        [id, newName]
      );
      if (dup.rows.length === 0) break;
      counter++;
      newName = `${sourceName} (Copy ${counter})`;
    }

    // Create duplicated role
    const insertRole = await query<{ id: string; name: string; description: string; created_at: string }>(
      `INSERT INTO workspace_roles (workspace_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, created_at`,
      [id, newName, sourceDescription, session.userId]
    );
    const newRole = insertRole.rows[0];

    // Copy permissions
    for (const perm of sourcePermissions) {
      await query(
        `INSERT INTO workspace_role_permissions (workspace_id, role_id, permission)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permission) DO NOTHING`,
        [id, newRole.id, perm]
      );
    }

    // Record audit event
    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
      entityType: "workspace",
      entityId: newRole.id,
      action: "custom_role_created",
      afterState: {
        roleId: newRole.id,
        roleName: newName,
        duplicatedFrom: roleId,
        permissionCount: sourcePermissions.length,
        permissions: sourcePermissions,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Role duplicated successfully as "${newName}"`,
        role: {
          id: newRole.id,
          name: newRole.name,
          description: newRole.description,
          permissions: sourcePermissions,
          memberCount: 0,
          isBuiltIn: false,
          createdAt: newRole.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/[id]/roles/[roleId]/duplicate Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to duplicate role", correlationId },
      { status: 500 }
    );
  }
}
