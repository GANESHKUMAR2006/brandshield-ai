/**
 * BrandShield AI — Granular Permissions & Role Definitions
 *
 * Centralized registry of 34 enterprise permissions grouped across 8 categories.
 * Provides server-side permission checking (hasPermission, requirePermission, getMemberPermissions)
 * with backward-compatible mapping for built-in roles and dynamic database resolution
 * for workspace-scoped custom roles.
 */

import { query } from "@/lib/db/server-db";
import { ReviewerRole } from "@/types";
import {
  resolveServerSession,
  isValidUUID,
  UnauthorizedRoleError,
  WorkspaceAccessError,
  getTestSessionOverride,
  type ServerSessionIdentity,
} from "./server-session";

export const PERMISSION_CATEGORIES = [
  "Workspace Management",
  "Submissions & Marketing Content",
  "Claim Verification",
  "Compliance Review",
  "Evidence Management",
  "Policy Management",
  "Audit & Reporting",
  "Email & Notifications",
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export interface PermissionDefinition {
  id: PermissionKey;
  name: string;
  description: string;
  category: PermissionCategory;
  isDangerous?: boolean;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // 1. Workspace Management
  {
    id: "workspace.view",
    name: "View workspace",
    description: "Access workspace dashboard and basic organization details",
    category: "Workspace Management",
  },
  {
    id: "workspace.settings.edit",
    name: "Edit workspace settings",
    description: "Modify workspace configuration, branding, and organization rules",
    category: "Workspace Management",
    isDangerous: true,
  },
  {
    id: "workspace.members.manage",
    name: "Manage workspace members",
    description: "Change member roles, manage custom roles, and configure permissions",
    category: "Workspace Management",
    isDangerous: true,
  },
  {
    id: "workspace.members.invite",
    name: "Invite members",
    description: "Create and dispatch email invitations to prospective team members",
    category: "Workspace Management",
  },
  {
    id: "workspace.members.remove",
    name: "Remove members",
    description: "Revoke workspace memberships and ban members",
    category: "Workspace Management",
    isDangerous: true,
  },
  {
    id: "workspace.join_codes.manage",
    name: "Manage join codes",
    description: "Generate, view, and rotate organization join codes",
    category: "Workspace Management",
  },
  {
    id: "workspace.join_requests.manage",
    name: "Approve or reject join requests",
    description: "Review and resolve pending membership join requests",
    category: "Workspace Management",
  },

  // 2. Submissions & Marketing Content
  {
    id: "submissions.view",
    name: "View submissions",
    description: "View marketing campaigns and submitted content",
    category: "Submissions & Marketing Content",
  },
  {
    id: "submissions.create",
    name: "Create submissions",
    description: "Draft and submit new marketing copy and campaigns",
    category: "Submissions & Marketing Content",
  },
  {
    id: "submissions.edit_own",
    name: "Edit own submissions",
    description: "Update marketing copy drafted by this user",
    category: "Submissions & Marketing Content",
  },
  {
    id: "submissions.edit_all",
    name: "Edit all submissions",
    description: "Update marketing campaigns created by any member",
    category: "Submissions & Marketing Content",
  },
  {
    id: "submissions.delete",
    name: "Delete submissions",
    description: "Permanently delete submitted marketing campaigns",
    category: "Submissions & Marketing Content",
    isDangerous: true,
  },
  {
    id: "submissions.verification_results.view",
    name: "View verification results",
    description: "Inspect claim verification scorecards and compliance badges",
    category: "Submissions & Marketing Content",
  },

  // 3. Claim Verification
  {
    id: "claims.verify",
    name: "Run claim verification",
    description: "Trigger automated AI claim extraction and fact verification engine",
    category: "Claim Verification",
  },
  {
    id: "claims.evidence_citations.view",
    name: "View evidence citations",
    description: "Inspect clinical study citations and truth anchor passages",
    category: "Claim Verification",
  },
  {
    id: "claims.verification_history.view",
    name: "View verification history",
    description: "Inspect audit log of past verification runs and model outputs",
    category: "Claim Verification",
  },
  {
    id: "claims.reverify",
    name: "Reverify claims",
    description: "Force re-extraction and re-verification of previously processed claims",
    category: "Claim Verification",
  },

  // 4. Compliance Review
  {
    id: "compliance.queue.view",
    name: "View review queue",
    description: "Access the compliance triage queue and claim inbox",
    category: "Compliance Review",
  },
  {
    id: "compliance.claims.approve",
    name: "Approve claims",
    description: "Grant formal regulatory clearance to marketing claims",
    category: "Compliance Review",
    isDangerous: true,
  },
  {
    id: "compliance.claims.reject",
    name: "Reject claims",
    description: "Reject non-compliant or unsubstantiated marketing claims",
    category: "Compliance Review",
  },
  {
    id: "compliance.claims.modify",
    name: "Modify claims",
    description: "Edit claim text, qualifier, or substantiation requirements",
    category: "Compliance Review",
  },
  {
    id: "compliance.claims.escalate",
    name: "Escalate claims",
    description: "Escalate high-risk or ambiguous claims to legal review",
    category: "Compliance Review",
  },
  {
    id: "compliance.escalations.resolve",
    name: "Resolve escalations",
    description: "Issue final binding decisions on escalated legal claims",
    category: "Compliance Review",
  },

  // 5. Evidence Management
  {
    id: "evidence.upload",
    name: "Upload evidence",
    description: "Upload clinical study documents, certificates, and lab reports",
    category: "Evidence Management",
  },
  {
    id: "evidence.view",
    name: "View evidence",
    description: "View and download truth anchors and supporting documentation",
    category: "Evidence Management",
  },
  {
    id: "evidence.metadata.edit",
    name: "Edit evidence metadata",
    description: "Update source document title, valid dates, and study parameters",
    category: "Evidence Management",
  },
  {
    id: "evidence.delete",
    name: "Delete evidence",
    description: "Remove evidence files and invalidate associated truth anchors",
    category: "Evidence Management",
    isDangerous: true,
  },

  // 6. Policy Management
  {
    id: "policies.view",
    name: "View policies",
    description: "Read regulatory compliance guidelines and brand policy rules",
    category: "Policy Management",
  },
  {
    id: "policies.create",
    name: "Create policies",
    description: "Author new regulatory policies and brand compliance constraints",
    category: "Policy Management",
  },
  {
    id: "policies.edit",
    name: "Edit policies",
    description: "Update policy definitions, severity levels, and guidance notes",
    category: "Policy Management",
  },
  {
    id: "policies.publish",
    name: "Publish policies",
    description: "Promote draft policies to live production enforcement tier",
    category: "Policy Management",
    isDangerous: true,
  },
  {
    id: "policies.rollback",
    name: "Roll back policies",
    description: "Revert active regulatory policies to previous versions",
    category: "Policy Management",
  },

  // 7. Audit & Reporting
  {
    id: "audit.logs.view",
    name: "View audit logs",
    description: "Inspect immutable tamper-evident audit records and activity trails",
    category: "Audit & Reporting",
  },
  {
    id: "audit.logs.export",
    name: "Export audit logs",
    description: "Export full cryptographic audit logs for regulatory submission",
    category: "Audit & Reporting",
    isDangerous: true,
  },
  {
    id: "reports.view",
    name: "View reports",
    description: "Access executive compliance summaries and accuracy analytics",
    category: "Audit & Reporting",
  },
  {
    id: "reports.export",
    name: "Export reports",
    description: "Download compliance analytics data and regulatory filings",
    category: "Audit & Reporting",
  },

  // 8. Email & Notifications
  {
    id: "email.diagnostics.view",
    name: "View email diagnostics",
    description: "Inspect outbound SMTP/Resend status and delivery history",
    category: "Email & Notifications",
  },
  {
    id: "email.diagnostics.send",
    name: "Send diagnostic emails",
    description: "Dispatch test emails to verify transactional delivery pipelines",
    category: "Email & Notifications",
  },
  {
    id: "notifications.settings.manage",
    name: "Manage notification settings",
    description: "Configure workspace alert thresholds and distribution channels",
    category: "Email & Notifications",
  },
];

export type PermissionKey =
  | "workspace.view"
  | "workspace.settings.edit"
  | "workspace.members.manage"
  | "workspace.members.invite"
  | "workspace.members.remove"
  | "workspace.join_codes.manage"
  | "workspace.join_requests.manage"
  | "submissions.view"
  | "submissions.create"
  | "submissions.edit_own"
  | "submissions.edit_all"
  | "submissions.delete"
  | "submissions.verification_results.view"
  | "claims.verify"
  | "claims.evidence_citations.view"
  | "claims.verification_history.view"
  | "claims.reverify"
  | "compliance.queue.view"
  | "compliance.claims.approve"
  | "compliance.claims.reject"
  | "compliance.claims.modify"
  | "compliance.claims.escalate"
  | "compliance.escalations.resolve"
  | "evidence.upload"
  | "evidence.view"
  | "evidence.metadata.edit"
  | "evidence.delete"
  | "policies.view"
  | "policies.create"
  | "policies.edit"
  | "policies.publish"
  | "policies.rollback"
  | "audit.logs.view"
  | "audit.logs.export"
  | "reports.view"
  | "reports.export"
  | "email.diagnostics.view"
  | "email.diagnostics.send"
  | "notifications.settings.manage";

export const ALL_PERMISSION_KEYS: PermissionKey[] = ALL_PERMISSIONS.map((p) => p.id);

/**
 * Built-in role permission mappings ensuring 100% backward compatibility.
 */
export const BUILTIN_ROLE_PERMISSIONS: Record<ReviewerRole, PermissionKey[]> = {
  admin: [...ALL_PERMISSION_KEYS],
  compliance_reviewer: [
    "workspace.view",
    "submissions.view",
    "submissions.edit_all",
    "submissions.verification_results.view",
    "claims.verify",
    "claims.evidence_citations.view",
    "claims.verification_history.view",
    "claims.reverify",
    "compliance.queue.view",
    "compliance.claims.approve",
    "compliance.claims.reject",
    "compliance.claims.modify",
    "compliance.claims.escalate",
    "evidence.upload",
    "evidence.view",
    "evidence.metadata.edit",
    "policies.view",
    "audit.logs.view",
    "reports.view",
    "email.diagnostics.view",
  ],
  legal_reviewer: [
    "workspace.view",
    "submissions.view",
    "submissions.verification_results.view",
    "claims.evidence_citations.view",
    "claims.verification_history.view",
    "compliance.queue.view",
    "compliance.claims.escalate",
    "compliance.escalations.resolve",
    "evidence.view",
    "policies.view",
    "audit.logs.view",
    "audit.logs.export",
    "reports.view",
    "reports.export",
  ],
  creator: [
    "workspace.view",
    "submissions.view",
    "submissions.create",
    "submissions.edit_own",
    "submissions.verification_results.view",
    "claims.evidence_citations.view",
    "evidence.upload",
    "evidence.view",
    "policies.view",
    "reports.view",
  ],
  viewer: [
    "workspace.view",
    "submissions.view",
    "submissions.verification_results.view",
    "claims.evidence_citations.view",
    "evidence.view",
    "policies.view",
    "reports.view",
  ],
};

export function isBuiltInRole(role: string): role is ReviewerRole {
  return role in BUILTIN_ROLE_PERMISSIONS;
}

export function isValidPermission(permission: string): permission is PermissionKey {
  return ALL_PERMISSION_KEYS.includes(permission as PermissionKey);
}

/**
 * Resolves all permissions granted to a member in a specific workspace.
 * Queries active memberships and dynamically evaluates built-in or custom roles.
 */
export async function getMemberPermissions(
  userId: string,
  workspaceId: string
): Promise<Set<PermissionKey>> {
  if (!isValidUUID(userId) || !isValidUUID(workspaceId)) {
    return new Set<PermissionKey>();
  }

  // Check test override if in test environment
  const override = getTestSessionOverride();
  if (override && !(override instanceof Error) && override.userId === userId && override.workspaceId === workspaceId) {
    if (override.role === "admin") {
      return new Set<PermissionKey>(ALL_PERMISSION_KEYS);
    }
    const roleKey = override.role as ReviewerRole;
    const defaultPerms = BUILTIN_ROLE_PERMISSIONS[roleKey] || [];
    return new Set<PermissionKey>(defaultPerms);
  }

  try {
    const memberRes = await query<{
      role: string;
      custom_role_id: string | null;
      status: string;
    }>(
      `SELECT wm.role, wm.custom_role_id, wm.status
       FROM workspace_memberships wm
       WHERE wm.workspace_id = $1 AND wm.user_id = $2 AND wm.status = 'active'
       LIMIT 1`,
      [workspaceId, userId]
    );

    if (memberRes.rows.length === 0) {
      return new Set<PermissionKey>();
    }

    const { role, custom_role_id } = memberRes.rows[0];

    // Administrator always possesses all permissions
    if (role === "admin") {
      return new Set<PermissionKey>(ALL_PERMISSION_KEYS);
    }

    // If custom role is linked, resolve permissions from workspace_role_permissions
    if (custom_role_id) {
      const permsRes = await query<{ permission: string }>(
        `SELECT wrp.permission
         FROM workspace_role_permissions wrp
         JOIN workspace_roles wr ON wrp.role_id = wr.id
         WHERE wr.id = $1 AND wr.workspace_id = $2`,
        [custom_role_id, workspaceId]
      );
      return new Set<PermissionKey>(permsRes.rows.map((r) => r.permission as PermissionKey));
    }

    // Built-in role fallback
    if (isBuiltInRole(role)) {
      return new Set<PermissionKey>(BUILTIN_ROLE_PERMISSIONS[role]);
    }

    // Role could be the name of a custom role assigned directly
    const roleByName = await query<{ id: string }>(
      `SELECT id FROM workspace_roles WHERE workspace_id = $1 AND name = $2 LIMIT 1`,
      [workspaceId, role]
    );
    if (roleByName.rows.length > 0) {
      const permsRes = await query<{ permission: string }>(
        `SELECT permission FROM workspace_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
        [roleByName.rows[0].id, workspaceId]
      );
      return new Set<PermissionKey>(permsRes.rows.map((r) => r.permission as PermissionKey));
    }

    return new Set<PermissionKey>();
  } catch (err) {
    console.error("[getMemberPermissions Error]:", err);
    return new Set<PermissionKey>();
  }
}

/**
 * Checks whether a user holds a specific permission in a workspace.
 * Centralized server-side gate.
 */
export async function hasPermission(
  userId: string,
  workspaceId: string,
  permission: PermissionKey
): Promise<boolean> {
  const permissions = await getMemberPermissions(userId, workspaceId);
  return permissions.has(permission);
}

/**
 * Enforces a required permission for the current session.
 * Throws UnauthorizedRoleError or WorkspaceAccessError if not authorized.
 */
export async function requirePermission(
  permission: PermissionKey,
  explicitWorkspaceId?: string
): Promise<ServerSessionIdentity> {
  const session = await resolveServerSession();

  const targetWorkspaceId = explicitWorkspaceId || session.workspaceId;
  if (!targetWorkspaceId) {
    throw new WorkspaceAccessError("No target workspace provided for authorization check.");
  }

  // Cross-workspace isolation check
  if (session.workspaceId !== targetWorkspaceId && session.role !== "admin") {
    throw new WorkspaceAccessError(`User session does not have access to workspace ${targetWorkspaceId}`);
  }

  const allowed = await hasPermission(session.userId, targetWorkspaceId, permission);
  if (!allowed) {
    throw new UnauthorizedRoleError(session.role, permission);
  }

  return session;
}
