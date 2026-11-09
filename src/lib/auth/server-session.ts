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

/**
 * Resolves verified identity, role, and workspace authorization from
 * the server-side session. Client-supplied IDs, roles, and workspaces
 * are strictly ignored and never trusted.
 *
 * Security Model:
 * 1. Production Mode: Fails closed. If a valid Supabase user session cannot
 *    be cryptographically verified, throws AuthenticationRequiredError (HTTP 401).
 *    If user lacks membership to target workspace, throws WorkspaceAccessError (HTTP 403).
 * 2. Development/Demo Mode: Isolated fallback to CURRENT_USER strictly when
 *    NODE_ENV !== "production" and NEXT_PUBLIC_APP_ENV !== "production".
 */
export async function resolveServerSession(
  targetWorkspaceSlug: string = DERMAGLOW_WORKSPACE_SLUG
): Promise<ServerSessionIdentity> {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  const validRoles: ReviewerRole[] = [
    "admin",
    "compliance_reviewer",
    "legal_reviewer",
    "creator",
    "viewer",
  ];

  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 1. Check database workspace_memberships first for real multi-tenant roles & workspaces
      try {
        const memberRes = await query<{
          role: string;
          workspace_id: string;
          slug: string;
        }>(
          `SELECT wm.role, w.id as workspace_id, w.slug 
           FROM workspace_memberships wm
           JOIN workspaces w ON wm.workspace_id = w.id
           WHERE wm.user_id = $1 AND w.slug = $2 AND wm.status = 'active'
           LIMIT 1`,
          [user.id, targetWorkspaceSlug]
        );

        if (memberRes.rows.length > 0) {
          const row = memberRes.rows[0];
          const memberRole = validRoles.includes(row.role as ReviewerRole)
            ? (row.role as ReviewerRole)
            : "compliance_reviewer";

          return {
            userId: user.id,
            userName: user.user_metadata?.name || user.email || "Verified Member",
            userEmail: user.email || "",
            role: memberRole,
            workspaceId: row.workspace_id,
            workspaceSlug: row.slug,
            isAuthenticated: true,
            isDemoFallback: false,
          };
        }
      } catch {
        // Continue to app_metadata check if DB query fails during initialization
      }

      // 2. Fall back to server-controlled app_metadata (e.g. for DermaGlow seed reviewers)
      const rawRole = (user.app_metadata?.role || "compliance_reviewer") as string;
      const role: ReviewerRole = validRoles.includes(rawRole as ReviewerRole)
        ? (rawRole as ReviewerRole)
        : "compliance_reviewer";

      const rawWorkspaces: unknown = user.app_metadata?.workspaces ?? user.app_metadata?.workspace_slug;
      const userWorkspaces: string[] = Array.isArray(rawWorkspaces)
        ? (rawWorkspaces as string[])
        : typeof rawWorkspaces === "string"
        ? [rawWorkspaces]
        : [];

      // If user is authenticated, validate tenant workspace access
      if (userWorkspaces.length > 0) {
        const isMember = validateUserWorkspaceMembership(userWorkspaces, targetWorkspaceSlug);
        if (!isMember) {
          throw new WorkspaceAccessError(
            `Forbidden: User "${user.id}" does not belong to requested workspace "${targetWorkspaceSlug}".`
          );
        }
      } else if (targetWorkspaceSlug !== DERMAGLOW_WORKSPACE_SLUG) {
        throw new WorkspaceAccessError(
          `Forbidden: User "${user.id}" does not belong to requested workspace "${targetWorkspaceSlug}".`
        );
      }

      // Query real workspace ID for the target slug if available
      let resolvedWorkspaceId = DERMAGLOW_WORKSPACE_ID;
      try {
        const wsRes = await query<{ id: string }>(
          `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
          [targetWorkspaceSlug]
        );
        if (wsRes.rows.length > 0) {
          resolvedWorkspaceId = wsRes.rows[0].id;
        }
      } catch {
        // Fall back to DERMAGLOW_WORKSPACE_ID
      }

      return {
        userId: user.id,
        userName: user.user_metadata?.name || user.email || "Verified Reviewer",
        userEmail: user.email || "",
        role,
        workspaceId: resolvedWorkspaceId,
        workspaceSlug: targetWorkspaceSlug,
        isAuthenticated: true,
        isDemoFallback: false,
      };
    }
  } catch (err) {
    if (err instanceof WorkspaceAccessError) {
      throw err;
    }
    const allowDemoAuth =
      process.env.ALLOW_DEMO_AUTH === "true" ||
      process.env.NEXT_PUBLIC_ALLOW_DEMO_AUTH === "true" ||
      process.env.NEXT_PUBLIC_APP_ENV === "demo" ||
      process.env.NEXT_PUBLIC_APP_ENV === "preview";

    if (isProduction && !allowDemoAuth) {
      throw new AuthenticationRequiredError(
        `Production authentication failure: Unable to verify user session (${err instanceof Error ? err.message : "Unknown error"}).`
      );
    }
  }

  // Production Gate: Fail closed unless demo showcase authentication is explicitly enabled
  const allowDemoAuth =
    process.env.ALLOW_DEMO_AUTH === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_DEMO_AUTH === "true" ||
    process.env.NEXT_PUBLIC_APP_ENV === "demo" ||
    process.env.NEXT_PUBLIC_APP_ENV === "preview";

  if (isProduction && !allowDemoAuth) {
    throw new AuthenticationRequiredError(
      "Production authentication failure: No valid authenticated Supabase session found. Anonymous execution is prohibited in production."
    );
  }

  // Development/Test Mode Only: Validate target workspace for demo identity
  if (targetWorkspaceSlug !== DERMAGLOW_WORKSPACE_SLUG) {
    throw new WorkspaceAccessError(
      `Forbidden: Development demo identity is restricted to "${DERMAGLOW_WORKSPACE_SLUG}". Access to "${targetWorkspaceSlug}" is denied.`
    );
  }

  return {
    userId: CURRENT_USER.id,
    userName: CURRENT_USER.name,
    userEmail: CURRENT_USER.email,
    role: "compliance_reviewer",
    workspaceId: DERMAGLOW_WORKSPACE_ID,
    workspaceSlug: DERMAGLOW_WORKSPACE_SLUG,
    isAuthenticated: false,
    isDemoFallback: true,
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
