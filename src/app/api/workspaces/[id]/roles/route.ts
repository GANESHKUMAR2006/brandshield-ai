import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import {
  ALL_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  BUILTIN_ROLE_PERMISSIONS,
  isValidPermission,
  PermissionKey,
} from "@/lib/auth/permissions";
import { ReviewerRole } from "@/types";

const RESERVED_NAMES = ["admin", "administrator", "superadmin", "owner"];

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(60, "Role name too long"),
  description: z.string().max(255).optional().default(""),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

// Built-in role definitions with display metadata
const BUILTIN_ROLE_META: Record<
  ReviewerRole,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  admin: {
    name: "Workspace Administrator",
    description: "Full regulatory governance, team management, policy authoring, and system administration.",
    permissions: BUILTIN_ROLE_PERMISSIONS.admin,
  },
  compliance_reviewer: {
    name: "Compliance Reviewer",
    description: "Reviews marketing claims, substantiates clinical evidence, and issues approval/rejection decisions.",
    permissions: BUILTIN_ROLE_PERMISSIONS.compliance_reviewer,
  },
  legal_reviewer: {
    name: "Legal Reviewer",
    description: "Oversees regulatory escalations, evaluates policy violations, and exports compliance filings.",
    permissions: BUILTIN_ROLE_PERMISSIONS.legal_reviewer,
  },
  creator: {
    name: "Marketing Creator",
    description: "Authors marketing copy, uploads clinical assets, and views real-time verification scorecards.",
    permissions: BUILTIN_ROLE_PERMISSIONS.creator,
  },
  viewer: {
    name: "Read-Only Viewer",
    description: "Auditor and executive view access to verification reports and truth anchor documents.",
    permissions: BUILTIN_ROLE_PERMISSIONS.viewer,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify workspace membership
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

    // 1. Fetch built-in roles with member counts
    const builtInCounts = await query<{ role: string; count: string }>(
      `SELECT role, COUNT(*)::text as count
       FROM workspace_memberships
       WHERE workspace_id = $1 AND status = 'active' AND custom_role_id IS NULL
       GROUP BY role`,
      [id]
    );

    const countMap: Record<string, number> = {};
    for (const row of builtInCounts.rows) {
      countMap[row.role] = parseInt(row.count, 10);
    }

    const builtInRoles = (Object.keys(BUILTIN_ROLE_META) as ReviewerRole[]).map((roleKey) => ({
      key: roleKey,
      id: `builtin-${roleKey}`,
      name: BUILTIN_ROLE_META[roleKey].name,
      description: BUILTIN_ROLE_META[roleKey].description,
      permissions: BUILTIN_ROLE_META[roleKey].permissions,
      memberCount: countMap[roleKey] || 0,
      isBuiltIn: true,
    }));

    // 2. Fetch workspace-scoped custom roles with member counts & permissions
    const customRolesRes = await query<{
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
       WHERE wr.workspace_id = $1
       GROUP BY wr.id, wr.name, wr.description, wr.created_at, wr.updated_at
       ORDER BY wr.created_at ASC`,
      [id]
    );

    // Fetch permissions for all custom roles in this workspace
    const permsRes = await query<{ role_id: string; permission: string }>(
      `SELECT wrp.role_id, wrp.permission
       FROM workspace_role_permissions wrp
       WHERE wrp.workspace_id = $1`,
      [id]
    );

    const rolePermsMap: Record<string, PermissionKey[]> = {};
    for (const row of permsRes.rows) {
      if (!rolePermsMap[row.role_id]) rolePermsMap[row.role_id] = [];
      if (isValidPermission(row.permission)) {
        rolePermsMap[row.role_id].push(row.permission);
      }
    }

    const customRoles = customRolesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || "",
      permissions: rolePermsMap[r.id] || [],
      memberCount: parseInt(r.member_count, 10),
      isBuiltIn: false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({
      success: true,
      builtInRoles,
      customRoles,
      allPermissions: ALL_PERMISSIONS,
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/roles Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load workspace roles", correlationId },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify caller is admin in this workspace
    const callerCheck = await query<{ role: string }>(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
      [id, session.userId]
    );
    const callerRole = callerCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can create custom roles" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = createRoleSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { name, description, permissions } = validated.data;
    const trimmedName = name.trim();

    // 1. Prevent reserved built-in names
    if (RESERVED_NAMES.includes(trimmedName.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Role name "${trimmedName}" is reserved. Choose a distinct custom role title.` },
        { status: 400 }
      );
    }

    // 2. Prevent duplicate role names within workspace
    const dupCheck = await query<{ id: string }>(
      `SELECT id FROM workspace_roles WHERE workspace_id = $1 AND lower(name) = lower($2) LIMIT 1`,
      [id, trimmedName]
    );
    if (dupCheck.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `A role named "${trimmedName}" already exists in this workspace.` },
        { status: 409 }
      );
    }

    // 3. Filter and validate permissions
    const validPerms = permissions.filter(isValidPermission);
    if (validPerms.length === 0) {
      return NextResponse.json(
        { success: false, error: "Custom role must contain at least one valid permission" },
        { status: 400 }
      );
    }

    // 4. Create custom role record
    const insertRole = await query<{ id: string; name: string; description: string; created_at: string }>(
      `INSERT INTO workspace_roles (workspace_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, created_at`,
      [id, trimmedName, description || "", session.userId]
    );
    const createdRole = insertRole.rows[0];

    // 5. Insert permissions atomically
    for (const perm of validPerms) {
      await query(
        `INSERT INTO workspace_role_permissions (workspace_id, role_id, permission)
         VALUES ($1, $2, $3)
         ON CONFLICT (role_id, permission) DO NOTHING`,
        [id, createdRole.id, perm]
      );
    }

    // 6. Record audit event
    await AuditService.recordEvent({
      workspaceId: id,
      actorId: session.userId,
      actorRole: session.role,
      actorName: session.userName,
      actorEmail: session.userEmail,
      entityType: "workspace",
      entityId: createdRole.id,
      action: "custom_role_created",
      afterState: {
        roleId: createdRole.id,
        roleName: trimmedName,
        permissionCount: validPerms.length,
        permissions: validPerms,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Custom role "${trimmedName}" created successfully with ${validPerms.length} permissions`,
        role: {
          id: createdRole.id,
          name: createdRole.name,
          description: createdRole.description,
          permissions: validPerms,
          memberCount: 0,
          isBuiltIn: false,
          createdAt: createdRole.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/[id]/roles Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to create custom role", correlationId },
      { status: 500 }
    );
  }
}
