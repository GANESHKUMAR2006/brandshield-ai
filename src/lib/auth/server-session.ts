import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ReviewerRole } from "@/types";
import { CURRENT_USER } from "@/config/site";
import { query } from "@/lib/db/server-db";

export interface ServerSessionIdentity {
  userId: string;
  userName: string;
  userEmail: string;
  role: ReviewerRole;
  workspaceId: string;
  workspaceSlug: string;
  isAuthenticated: boolean;
  isDemoFallback: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  isAuthenticated: boolean;
}

export interface ResolveSessionOptions {
  allowNoWorkspace?: boolean;
}

export type WorkspacePermission = "read" | "write" | "admin" | "review" | "publish";

export interface VerifiedWorkspaceContext {
  userId: string;
  userName: string;
  userEmail: string;
  role: ReviewerRole;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  permissions: Set<WorkspacePermission>;
}

export const ROLE_PERMISSIONS: Record<ReviewerRole, WorkspacePermission[]> = {
  admin: ["read", "write", "admin", "review", "publish"],
  compliance_reviewer: ["read", "write", "review", "publish"],
  legal_reviewer: ["read", "review"],
  creator: ["read", "write"],
  viewer: ["read"],
};

const VALID_ROLES: ReviewerRole[] = [
  "admin",
  "compliance_reviewer",
  "legal_reviewer",
  "creator",
  "viewer",
];

/**
 * Validates whether an identifier is a standard RFC 4122 UUID.
 * Fails closed on non-string or malformed identifiers (e.g. demo string "usr-01-elena").
 */
export function isValidUUID(id: unknown): id is string {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export const DERMAGLOW_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const DERMAGLOW_WORKSPACE_SLUG = "dermaglow";

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required: A valid authenticated session must be established.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class UnauthorizedRoleError extends Error {
  constructor(role: string, action: string) {
    super(`Forbidden: Role "${role}" lacks authorization to ${action}.`);
    this.name = "UnauthorizedRoleError";
  }
}

export class WorkspaceAccessError extends Error {
  constructor(message = "Forbidden: User does not belong to the requested workspace.") {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

/**
 * Validates whether the user's trusted server-side metadata grants membership
 * to the target workspace slug. Fails closed.
 */
export function validateUserWorkspaceMembership(
  userWorkspaces: string[] | undefined | null,
  targetWorkspaceSlug: string
): boolean {
  if (!userWorkspaces || !Array.isArray(userWorkspaces) || userWorkspaces.length === 0) {
    return false;
  }
  return userWorkspaces.includes(targetWorkspaceSlug);
}

let testSessionOverride: ServerSessionIdentity | Error | null | undefined = undefined;

/**
 * Test-only utility to set a mock session for unit and integration testing.
 * Strictly blocked in production environments.
 */
export function __setTestSessionOverride(session: ServerSessionIdentity | Error | null | undefined): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  ) {
    throw new Error("Test session override is strictly prohibited in production.");
  }
  testSessionOverride = session;
}

export function getTestSessionOverride(): ServerSessionIdentity | Error | null | undefined {
  return testSessionOverride;
}

/**
 * Resolves verified authenticated user identity directly from Supabase server session.
 * 
 * Strict Guarantees:
 * 1. Obtains real authenticated user UUID via supabase.auth.getUser().
 * 2. Never returns demo fallback IDs (e.g. "usr-01-elena").
 * 3. Does not require pre-existing workspace membership (enables first workspace creation).
 * 4. Fails closed and returns null if unauthenticated.
 */
export async function resolveAuthenticatedUser(
  request?: NextRequest | Request
): Promise<AuthenticatedUser | null> {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  if (!isProduction && testSessionOverride !== undefined) {
    if (testSessionOverride === null) {
      return null;
    }
    if (testSessionOverride instanceof Error) {
      throw testSessionOverride;
    }
    if (testSessionOverride && testSessionOverride.isAuthenticated) {
      if (testSessionOverride.isDemoFallback || testSessionOverride.userId === CURRENT_USER.id) {
        return null;
      }
      return {
        id: testSessionOverride.userId,
        email: testSessionOverride.userEmail,
        name: testSessionOverride.userName,
        isAuthenticated: true,
      };
    }
    return null;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    if (!isValidUUID(user.id)) {
      console.error(`[resolveAuthenticatedUser] Supabase returned invalid non-UUID user id: "${user.id}"`);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email || "Verified Member",
      isAuthenticated: true,
    };
  } catch (err) {
    console.error("[resolveAuthenticatedUser] Failed to resolve Supabase server session:", err);
    return null;
  }
}

/**
 * Resolves target workspace identifier from explicit argument, request headers,
 * or cookies in that strict precedence order.
 */
export async function resolveTargetWorkspaceIdentifier(
  targetWorkspaceIdOrSlug?: string,
  request?: NextRequest | Request
): Promise<string | undefined> {
  if (targetWorkspaceIdOrSlug && targetWorkspaceIdOrSlug.trim() !== "") {
    return targetWorkspaceIdOrSlug.trim();
  }

  // 1. Check HTTP headers if request object is provided
  if (request && "headers" in request) {
    const headerSlug =
      request.headers.get("x-workspace-slug") ||
      request.headers.get("x-workspace-id");
    if (headerSlug && headerSlug.trim() !== "") {
      return headerSlug.trim();
    }
  }

  // 2. Check Next.js request context (headers & cookies)
  try {
    const { headers: getHeaders, cookies: getCookies } = await import("next/headers");
    const headerList = await getHeaders();
    const headerSlug =
      headerList.get("x-workspace-slug") ||
      headerList.get("x-workspace-id");
    if (headerSlug && headerSlug.trim() !== "") {
      return headerSlug.trim();
    }

    const cookieStore = await getCookies();
    const cookieSlug =
      cookieStore.get("active_workspace_slug")?.value ||
      cookieStore.get("active_workspace_id")?.value ||
      cookieStore.get("workspace_slug")?.value;
    if (cookieSlug && cookieSlug.trim() !== "") {
      return cookieSlug.trim();
    }
  } catch {
    // Outside of Next.js server request context
  }

  return undefined;
}

/**
 * Centralized Tenant Authorization Boundary: requireWorkspaceAccess
 * 
 * Verifies that the caller has an active, legitimate membership in the target workspace.
 * Fails closed with WorkspaceAccessError (HTTP 403) if the user does not belong to the workspace.
 * Validates role permissions when requiredPermission is specified.
 */
export async function requireWorkspaceAccess(
  targetWorkspaceIdOrSlug?: string,
  requiredPermission?: WorkspacePermission,
  request?: NextRequest | Request
): Promise<VerifiedWorkspaceContext> {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  const allowDemoAuth =
    process.env.ALLOW_DEMO_AUTH === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_DEMO_AUTH === "true" ||
    process.env.NEXT_PUBLIC_APP_ENV === "demo" ||
    process.env.NEXT_PUBLIC_APP_ENV === "preview";

  const requestedTarget = await resolveTargetWorkspaceIdentifier(
    targetWorkspaceIdOrSlug,
    request
  );

  // Check test session override (strictly allowed in non-production test environments)
  if (!isProduction && testSessionOverride !== undefined) {
    if (testSessionOverride === null) {
      throw new AuthenticationRequiredError(
        "Authentication required: A valid authenticated session must be established."
      );
    }
    if (testSessionOverride instanceof Error) {
      throw testSessionOverride;
    }

    if (
      requestedTarget &&
      requestedTarget !== testSessionOverride.workspaceSlug &&
      requestedTarget !== testSessionOverride.workspaceId
    ) {
      let memberRes;
      try {
        memberRes = await query<{
          role: string;
          workspace_id: string;
          workspace_name: string;
          slug: string;
        }>(
          `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
           FROM workspace_memberships wm
           JOIN workspaces w ON wm.workspace_id = w.id
           WHERE wm.user_id = $1 AND (w.slug = $2 OR w.id::text = $2) AND wm.status = 'active'
             AND (w.status IS NULL OR w.status != 'archived')
           LIMIT 1`,
          [testSessionOverride.userId, requestedTarget]
        );
      } catch (err: any) {
        if (err?.code === "42703" || String(err?.message).includes("status")) {
          memberRes = await query<{
            role: string;
            workspace_id: string;
            workspace_name: string;
            slug: string;
          }>(
            `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
             FROM workspace_memberships wm
             JOIN workspaces w ON wm.workspace_id = w.id
             WHERE wm.user_id = $1 AND (w.slug = $2 OR w.id::text = $2) AND wm.status = 'active'
             LIMIT 1`,
            [testSessionOverride.userId, requestedTarget]
          );
        } else {
          throw err;
        }
      }

      if (!memberRes || memberRes.rows.length === 0) {
        throw new WorkspaceAccessError(
          `Forbidden: User "${testSessionOverride.userId}" does not have active membership in workspace "${requestedTarget}".`
        );
      }

      const row = memberRes.rows[0];
      const role = VALID_ROLES.includes(row.role as ReviewerRole)
        ? (row.role as ReviewerRole)
        : testSessionOverride.role;
      const perms = new Set<WorkspacePermission>(ROLE_PERMISSIONS[role] || ["read"]);

      if (requiredPermission && !perms.has(requiredPermission)) {
        throw new UnauthorizedRoleError(role, requiredPermission);
      }

      return {
        userId: testSessionOverride.userId,
        userName: testSessionOverride.userName,
        userEmail: testSessionOverride.userEmail,
        role,
        workspaceId: row.workspace_id,
        workspaceSlug: (row as any).slug || (row as any).workspace_slug || requestedTarget || "",
        workspaceName: (row as any).workspace_name || (row as any).name || (row as any).slug || "Workspace",
        permissions: perms,
      };
    }

    const perms = new Set<WorkspacePermission>(ROLE_PERMISSIONS[testSessionOverride.role] || ["read"]);
    if (requiredPermission && !perms.has(requiredPermission)) {
      throw new UnauthorizedRoleError(testSessionOverride.role, requiredPermission);
    }

    return {
      userId: testSessionOverride.userId,
      userName: testSessionOverride.userName,
      userEmail: testSessionOverride.userEmail,
      role: testSessionOverride.role,
      workspaceId: testSessionOverride.workspaceId,
      workspaceSlug: testSessionOverride.workspaceSlug,
      workspaceName: "Test Workspace",
      permissions: perms,
    };
  }

  // 1. Resolve real authenticated user
  const user = await resolveAuthenticatedUser(request);

  if (user) {
    let memberRes;
    try {
      if (requestedTarget) {
        memberRes = await query<{
          role: string;
          workspace_id: string;
          workspace_name: string;
          slug: string;
        }>(
          `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
           FROM workspace_memberships wm
           JOIN workspaces w ON wm.workspace_id = w.id
           WHERE wm.user_id = $1 AND (w.slug = $2 OR w.id::text = $2) AND wm.status = 'active'
             AND (w.status IS NULL OR w.status != 'archived')
           LIMIT 1`,
          [user.id, requestedTarget]
        );
      } else {
        memberRes = await query<{
          role: string;
          workspace_id: string;
          workspace_name: string;
          slug: string;
        }>(
          `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
           FROM workspace_memberships wm
           JOIN workspaces w ON wm.workspace_id = w.id
           WHERE wm.user_id = $1 AND wm.status = 'active'
             AND (w.status IS NULL OR w.status != 'archived')
           ORDER BY wm.created_at ASC
           LIMIT 1`,
          [user.id]
        );
      }
    } catch (err: any) {
      if (err?.code === "42703" || String(err?.message).includes("status")) {
        if (requestedTarget) {
          memberRes = await query<{
            role: string;
            workspace_id: string;
            workspace_name: string;
            slug: string;
          }>(
            `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
             FROM workspace_memberships wm
             JOIN workspaces w ON wm.workspace_id = w.id
             WHERE wm.user_id = $1 AND (w.slug = $2 OR w.id::text = $2) AND wm.status = 'active'
             LIMIT 1`,
            [user.id, requestedTarget]
          );
        } else {
          memberRes = await query<{
            role: string;
            workspace_id: string;
            workspace_name: string;
            slug: string;
          }>(
            `SELECT wm.role, w.id as workspace_id, w.name as workspace_name, w.slug 
             FROM workspace_memberships wm
             JOIN workspaces w ON wm.workspace_id = w.id
             WHERE wm.user_id = $1 AND wm.status = 'active'
             ORDER BY wm.created_at ASC
             LIMIT 1`,
            [user.id]
          );
        }
      } else {
        throw err;
      }
    }

    if (memberRes && memberRes.rows.length > 0) {
      const row = memberRes.rows[0];
      const role: ReviewerRole = VALID_ROLES.includes(row.role as ReviewerRole)
        ? (row.role as ReviewerRole)
        : "compliance_reviewer";

      const perms = new Set<WorkspacePermission>(ROLE_PERMISSIONS[role] || ["read"]);
      if (requiredPermission && !perms.has(requiredPermission)) {
        throw new UnauthorizedRoleError(role, requiredPermission);
      }

      return {
        userId: user.id,
        userName: user.name || "Verified Member",
        userEmail: user.email || "",
        role,
        workspaceId: row.workspace_id,
        workspaceSlug: (row as any).slug || (row as any).workspace_slug || requestedTarget || "",
        workspaceName: (row as any).workspace_name || (row as any).name || (row as any).slug || "Workspace",
        permissions: perms,
      };
    }

    // Check app_metadata fallback if DB query returned 0 rows (e.g. for seed accounts)
    try {
      const supabase = await getSupabaseServerClient();
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (sbUser) {
        const rawWorkspaces: unknown = sbUser.app_metadata?.workspaces ?? sbUser.app_metadata?.workspace_slug;
        const userWorkspaces: string[] = Array.isArray(rawWorkspaces)
          ? (rawWorkspaces as string[])
          : typeof rawWorkspaces === "string"
          ? [rawWorkspaces]
          : [];

        let effectiveSlug = requestedTarget;
        if (effectiveSlug) {
          if (userWorkspaces.length > 0) {
            const isMember = validateUserWorkspaceMembership(userWorkspaces, effectiveSlug);
            if (!isMember) {
              throw new WorkspaceAccessError(
                `Forbidden: User "${user.id}" does not belong to requested workspace "${effectiveSlug}".`
              );
            }
          } else {
            throw new WorkspaceAccessError(
              `Forbidden: User "${user.id}" does not have active membership in workspace "${effectiveSlug}".`
            );
          }
        } else if (userWorkspaces.length > 0) {
          effectiveSlug = userWorkspaces[0];
        } else {
          throw new WorkspaceAccessError(
            `Forbidden: User "${user.id}" does not belong to any authorized workspace.`
          );
        }

        let resolvedWorkspaceId: string | null = null;
        let resolvedWorkspaceName = effectiveSlug;
        const wsRes = await query<{ id: string; name: string }>(
          `SELECT id, name FROM workspaces WHERE slug = $1 AND (status IS NULL OR status != 'archived') LIMIT 1`,
          [effectiveSlug]
        );
        if (wsRes.rows.length > 0) {
          resolvedWorkspaceId = wsRes.rows[0].id;
          resolvedWorkspaceName = wsRes.rows[0].name;
        }

        if (!resolvedWorkspaceId) {
          throw new WorkspaceAccessError(
            `Workspace "${effectiveSlug}" could not be resolved.`
          );
        }

        const rawRole = (sbUser.app_metadata?.role || "compliance_reviewer") as string;
        const role: ReviewerRole = VALID_ROLES.includes(rawRole as ReviewerRole)
          ? (rawRole as ReviewerRole)
          : "compliance_reviewer";

        const perms = new Set<WorkspacePermission>(ROLE_PERMISSIONS[role] || ["read"]);
        if (requiredPermission && !perms.has(requiredPermission)) {
          throw new UnauthorizedRoleError(role, requiredPermission);
        }

        return {
          userId: user.id,
          userName: user.name || "Verified Reviewer",
          userEmail: user.email || "",
          role,
          workspaceId: resolvedWorkspaceId,
          workspaceSlug: effectiveSlug,
          workspaceName: resolvedWorkspaceName,
          permissions: perms,
        };
      }
    } catch (sbErr) {
      if (sbErr instanceof WorkspaceAccessError || sbErr instanceof UnauthorizedRoleError) {
        throw sbErr;
      }
    }

    throw new WorkspaceAccessError(
      `Forbidden: User "${user.id}" does not have active membership in workspace "${requestedTarget || "primary"}".`
    );
  }

  // Fails closed in production
  if (isProduction && !allowDemoAuth) {
    throw new AuthenticationRequiredError(
      "Production authentication failure: No valid authenticated Supabase session found. Anonymous execution is prohibited in production."
    );
  }

  // Development/Test Mode Only: Demo fallback
  if (allowDemoAuth || !isProduction) {
    if (
      requestedTarget &&
      requestedTarget !== DERMAGLOW_WORKSPACE_SLUG &&
      requestedTarget !== DERMAGLOW_WORKSPACE_ID
    ) {
      throw new WorkspaceAccessError(
        `Forbidden: Development demo identity is restricted to "${DERMAGLOW_WORKSPACE_SLUG}". Access to "${requestedTarget}" is denied.`
      );
    }

    const role: ReviewerRole = "compliance_reviewer";
    const perms = new Set<WorkspacePermission>(ROLE_PERMISSIONS[role]);
    if (requiredPermission && !perms.has(requiredPermission)) {
      throw new UnauthorizedRoleError(role, requiredPermission);
    }

    return {
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userEmail: CURRENT_USER.email,
      role,
      workspaceId: DERMAGLOW_WORKSPACE_ID,
      workspaceSlug: DERMAGLOW_WORKSPACE_SLUG,
      workspaceName: "DermaGlow Demo",
      permissions: perms,
    };
  }

  throw new AuthenticationRequiredError(
    "Authentication required: A valid authenticated session must be established."
  );
}

/**
 * Resolves verified identity, role, and workspace authorization from
 * the server-side session. Client-supplied IDs, roles, and workspaces
 * are strictly ignored and never trusted.
 */
export async function resolveServerSession(
  targetWorkspaceSlug?: string,
  request?: NextRequest | Request,
  options?: ResolveSessionOptions
): Promise<ServerSessionIdentity> {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  // When allowNoWorkspace is requested (e.g. for workspace creation flow)
  if (options?.allowNoWorkspace) {
    const user = await resolveAuthenticatedUser(request);
    if (user) {
      try {
        const ctx = await requireWorkspaceAccess(targetWorkspaceSlug, undefined, request);
        return {
          userId: ctx.userId,
          userName: ctx.userName,
          userEmail: ctx.userEmail,
          role: ctx.role,
          workspaceId: ctx.workspaceId,
          workspaceSlug: ctx.workspaceSlug,
          isAuthenticated: true,
          isDemoFallback: false,
        };
      } catch (err) {
        if (err instanceof WorkspaceAccessError) {
          return {
            userId: user.id,
            userName: user.name || "Verified Member",
            userEmail: user.email || "",
            role: "admin",
            workspaceId: "",
            workspaceSlug: "",
            isAuthenticated: true,
            isDemoFallback: false,
          };
        }
        throw err;
      }
    }
  }

  const ctx = await requireWorkspaceAccess(targetWorkspaceSlug, undefined, request);
  return {
    userId: ctx.userId,
    userName: ctx.userName,
    userEmail: ctx.userEmail,
    role: ctx.role,
    workspaceId: ctx.workspaceId,
    workspaceSlug: ctx.workspaceSlug,
    isAuthenticated: ctx.userId !== CURRENT_USER.id,
    isDemoFallback: ctx.userId === CURRENT_USER.id,
  };
}

/**
 * Server-side Role-Based Access Control (RBAC) Gates
 * Supports receiving either a ReviewerRole string or a ServerSessionIdentity object.
 */
function resolveRole(target: ServerSessionIdentity | ReviewerRole): ReviewerRole {
  return typeof target === "string" ? target : target.role;
}

export function canCreateSubmissions(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "creator";
}

export function canEditSubmissions(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "creator";
}

export function canForceReextract(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer";
}

export function canReviewClaims(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "legal_reviewer";
}

export function canOverrideContradictedClaims(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "legal_reviewer";
}

export const canApproveOverrides = canOverrideContradictedClaims;

export function canPublishSubmissions(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer";
}

export const canPublish = canPublishSubmissions;

export function canViewAudit(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return (
    role === "admin" ||
    role === "compliance_reviewer" ||
    role === "legal_reviewer" ||
    role === "viewer" ||
    role === "creator"
  );
}

export function canAccessAdminAnalytics(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "legal_reviewer";
}

export function canExportAudit(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin" || role === "compliance_reviewer" || role === "legal_reviewer";
}

export function canConfigureWorkspace(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin";
}

export function canManageWorkspaceMembers(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin";
}

export function canManagePolicies(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return role === "admin";
}

export function canViewPolicies(target: ServerSessionIdentity | ReviewerRole): boolean {
  const role = resolveRole(target);
  return (
    role === "admin" ||
    role === "compliance_reviewer" ||
    role === "legal_reviewer" ||
    role === "viewer" ||
    role === "creator"
  );
}
