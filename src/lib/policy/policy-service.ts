/**
 * BrandShield AI — Phase 3: Policy Management Service
 *
 * Provides transactional lifecycle management for compliance policies and immutable
 * policy versions, role authorization checks, tamper-evident audit logging,
 * visual policy builder schema validation, rollbacks, and zero-side-effect simulation.
 */

import { query, withTransaction } from "@/lib/db/server-db";
import {
  Policy,
  PolicyCategory,
  PolicyRule,
  PolicySimulationRequest,
  PolicySimulationResult,
  PolicyVersion,
  RuleSeverity,
} from "@/types";
import { ServerSessionIdentity, canManagePolicies, canViewPolicies } from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";
import { PolicyEngine } from "./policy-engine";
import { RuleEvaluator } from "./rule-evaluator";
import { DEFAULT_POLICIES } from "./default-policies";
import { PolicySchemaValidator, PolicyValidationResult } from "./policy-schema-validator";

// In-memory policy store for local development mode when DB connection string is unavailable
let inMemoryPolicies: Policy[] = JSON.parse(JSON.stringify(DEFAULT_POLICIES));

export interface CreatePolicyInput {
  name: string;
  code: string;
  description?: string;
  category: PolicyCategory;
  severity?: RuleSeverity;
  productId?: string | null;
  rules?: PolicyRule[];
  validFrom?: string;
}

export interface CreateDraftVersionInput {
  description?: string;
  rules: PolicyRule[];
  validFrom?: string;
  validUntil?: string | null;
}

export interface UpdatePolicyDraftInput {
  name?: string;
  description?: string;
  category?: PolicyCategory;
  severity?: RuleSeverity;
  productId?: string | null;
  rules?: PolicyRule[];
  validFrom?: string;
  validUntil?: string | null;
}

export class PolicyService {
  /**
   * Resets in-memory store for unit testing.
   */
  public static resetInMemoryStore(): void {
    inMemoryPolicies = JSON.parse(JSON.stringify(DEFAULT_POLICIES));
  }

  /**
   * Validates policy schema and JSON rules without side effects.
   */
  public static validatePolicyRules(input: unknown): PolicyValidationResult {
    return PolicySchemaValidator.validatePolicy(input);
  }

  /**
   * Retrieves all policies for the user's workspace.
   */
  public static async getPolicies(
    session: ServerSessionIdentity,
    filters?: {
      category?: string;
      status?: string;
      severity?: string;
      productId?: string;
      search?: string;
    }
  ): Promise<Policy[]> {
    if (!canViewPolicies(session.role)) {
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to view policies.`);
    }

    try {
      let sql = `
        SELECT 
          p.id,
          p.workspace_id,
          p.product_id,
          prod.name as product_name,
          prod.sku as product_sku,
          p.name,
          p.code,
          p.description,
          p.category,
          p.severity,
          p.status,
          p.active_version_id,
          p.created_at,
          p.updated_at,
          pv.version_number as active_version_number,
          pv.rules as active_rules,
          (SELECT COUNT(*) FROM policy_versions WHERE policy_id = p.id)::int as versions_count
        FROM policies p
        JOIN workspaces w ON p.workspace_id = w.id
        LEFT JOIN products prod ON p.product_id = prod.id
        LEFT JOIN policy_versions pv ON p.active_version_id = pv.id
        WHERE w.slug = $1
      `;
      const params: (string | number)[] = [session.workspaceSlug];

      if (filters?.category) {
        params.push(filters.category);
        sql += ` AND p.category = $${params.length}`;
      }
      if (filters?.status) {
        params.push(filters.status);
        sql += ` AND p.status = $${params.length}`;
      }
      if (filters?.severity) {
        params.push(filters.severity);
        sql += ` AND p.severity = $${params.length}`;
      }
      if (filters?.productId) {
        params.push(filters.productId);
        sql += ` AND p.product_id = $${params.length}`;
      }
      if (filters?.search) {
        params.push(`%${filters.search.toLowerCase()}%`);
        sql += ` AND (LOWER(p.name) LIKE $${params.length} OR LOWER(p.code) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
      }

      sql += ` ORDER BY p.created_at DESC`;

      const res = await query<{
        id: string;
        workspace_id: string;
        product_id: string | null;
        product_name: string | null;
        product_sku: string | null;
        name: string;
        code: string;
        description: string | null;
        category: PolicyCategory;
        severity: RuleSeverity | null;
        status: "draft" | "active" | "archived";
        active_version_id: string | null;
        created_at: string;
        updated_at: string;
        active_version_number: number | null;
        active_rules: PolicyRule[] | null;
        versions_count: number;
      }>(sql, params);

      return res.rows.map((row) => ({
        id: row.id,
        workspace_id: row.workspace_id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_sku: row.product_sku,
        name: row.name,
        code: row.code,
        description: row.description,
        category: row.category,
        severity: row.severity || "high",
        status: row.status,
        active_version_id: row.active_version_id,
        active_version_number: row.active_version_number,
        versions_count: row.versions_count || 1,
        rules_count: row.active_rules ? row.active_rules.length : 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } catch {
      // Demo fallback: use in-memory policies
      let filtered = inMemoryPolicies.filter(
        (p) => p.workspace_id === session.workspaceId || session.isDemoFallback
      );

      if (filters?.category) {
        filtered = filtered.filter((p) => p.category === filters.category);
      }
      if (filters?.status) {
        filtered = filtered.filter((p) => p.status === filters.status);
      }
      if (filters?.severity) {
        filtered = filtered.filter((p) => p.severity === filters.severity);
      }
      if (filters?.productId) {
        filtered = filtered.filter((p) => p.product_id === filters.productId);
      }
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(s) ||
            p.code.toLowerCase().includes(s) ||
            (p.description || "").toLowerCase().includes(s)
        );
      }

      return filtered;
    }
  }

  /**
   * Retrieves a single policy by ID with all versions and rules.
   */
  public static async getPolicyById(
    session: ServerSessionIdentity,
    policyId: string
  ): Promise<Policy> {
    if (!canViewPolicies(session.role)) {
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to view policies.`);
    }

    try {
      const polRes = await query<{
        id: string;
        workspace_id: string;
        product_id: string | null;
        product_name: string | null;
        product_sku: string | null;
        name: string;
        code: string;
        description: string | null;
        category: PolicyCategory;
        severity: RuleSeverity | null;
        status: "draft" | "active" | "archived";
        active_version_id: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT 
          p.id, p.workspace_id, p.product_id, prod.name as product_name, prod.sku as product_sku,
          p.name, p.code, p.description, p.category, p.severity, p.status, p.active_version_id,
          p.created_at, p.updated_at
        FROM policies p
        JOIN workspaces w ON p.workspace_id = w.id
        LEFT JOIN products prod ON p.product_id = prod.id
        WHERE p.id = $1 AND w.slug = $2`,
        [policyId, session.workspaceSlug]
      );

      if (polRes.rows.length === 0) {
        throw new Error(`Policy "${policyId}" not found in workspace "${session.workspaceSlug}".`);
      }

      const policyRow = polRes.rows[0];

      // Fetch versions
      const verRes = await query<{
        id: string;
        policy_id: string;
        version_number: number;
        status: "draft" | "validated" | "active" | "archived" | "superseded";
        description: string | null;
        valid_from: string;
        valid_until: string | null;
        rules: PolicyRule[];
        metadata: Record<string, unknown>;
        created_by: string;
        created_at: string;
        activated_at: string | null;
        archived_at: string | null;
      }>(
        `SELECT id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at, archived_at
         FROM policy_versions
         WHERE policy_id = $1
         ORDER BY version_number DESC`,
        [policyId]
      );

      const versions: PolicyVersion[] = verRes.rows.map((v) => ({
        id: v.id,
        policy_id: v.policy_id,
        version_number: v.version_number,
        status: v.status,
        description: v.description,
        valid_from: v.valid_from,
        valid_until: v.valid_until,
        rules: v.rules || [],
        metadata: v.metadata || {},
        created_by: v.created_by,
        created_at: v.created_at,
        activated_at: v.activated_at,
        archived_at: v.archived_at,
      }));

      const activeVer = versions.find((v) => v.id === policyRow.active_version_id) || versions[0] || null;

      return {
        ...policyRow,
        severity: policyRow.severity || "high",
        active_version: activeVer,
        active_version_number: activeVer ? activeVer.version_number : null,
        rules_count: activeVer?.rules?.length || 0,
        versions_count: versions.length,
        versions,
      };
    } catch {
      // Demo fallback: search in memory
      const found = inMemoryPolicies.find((p) => p.id === policyId || p.code === policyId);
      if (!found) {
        throw new Error(`Policy "${policyId}" not found.`);
      }
      return found;
    }
  }

  /**
   * Creates a new policy with an initial draft Version 1.
   * Restricted to admin role.
   */
  public static async createPolicy(
    session: ServerSessionIdentity,
    input: CreatePolicyInput
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: "unauthorized",
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "create_policy", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to create policies.`);
    }

    // Schema and security validation
    const validation = PolicySchemaValidator.validatePolicy({
      name: input.name,
      code: input.code,
      category: input.category,
      severity: input.severity,
      rules: input.rules,
    });

    if (!validation.isValid) {
      const issuesMsg = validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      throw new Error(`Policy validation failed: ${issuesMsg}`);
    }

    const calculatedSeverity: RuleSeverity =
      input.severity ||
      (input.rules && input.rules.length > 0
        ? input.rules.some((r) => r.severity === "critical")
          ? "critical"
          : input.rules.some((r) => r.severity === "high")
          ? "high"
          : input.rules.some((r) => r.severity === "medium")
          ? "medium"
          : "low"
        : "high");

    try {
      return await withTransaction(async (client) => {
        // 1. Insert master policy record (draft)
        const polRes = await client.query<{ id: string; created_at: string }>(
          `INSERT INTO policies (workspace_id, product_id, name, code, description, category, severity, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
           RETURNING id, created_at`,
          [
            session.workspaceId,
            input.productId || null,
            input.name,
            input.code,
            input.description || null,
            input.category,
            calculatedSeverity,
          ]
        );
        const policyId = polRes.rows[0].id;
        const createdAt = polRes.rows[0].created_at;

        // 2. Insert Version 1 (draft)
        const verRes = await client.query<{ id: string }>(
          `INSERT INTO policy_versions (policy_id, version_number, status, description, valid_from, rules, created_by)
           VALUES ($1, 1, 'draft', $2, $3, $4, $5)
           RETURNING id`,
          [
            policyId,
            input.description || "Initial draft version",
            input.validFrom || new Date().toISOString(),
            JSON.stringify(input.rules || []),
            session.userName,
          ]
        );
        const versionId = verRes.rows[0].id;

        // 3. Log audit event
        await AuditService.recordEvent(
          {
            workspaceId: session.workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "policy",
            entityId: policyId,
            action: "policy_created",
            beforeState: null,
            afterState: {
              name: input.name,
              code: input.code,
              category: input.category,
              severity: calculatedSeverity,
              version_number: 1,
              status: "draft",
              rules_count: (input.rules || []).length,
            },
          },
          client
        );

        const newVersion: PolicyVersion = {
          id: versionId,
          policy_id: policyId,
          version_number: 1,
          status: "draft",
          description: input.description,
          valid_from: input.validFrom || new Date().toISOString(),
          rules: input.rules || [],
          created_by: session.userName,
          created_at: createdAt,
        };

        return {
          id: policyId,
          workspace_id: session.workspaceId,
          product_id: input.productId || null,
          name: input.name,
          code: input.code,
          description: input.description,
          category: input.category,
          severity: calculatedSeverity,
          status: "draft",
          active_version_id: null,
          active_version_number: null,
          versions_count: 1,
          rules_count: (input.rules || []).length,
          created_at: createdAt,
          updated_at: createdAt,
          active_version: null,
          versions: [newVersion],
        };
      });
    } catch {
      // Demo fallback: update in-memory
      const policyId = `pol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const versionId = `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const createdAt = new Date().toISOString();

      const newVersion: PolicyVersion = {
        id: versionId,
        policy_id: policyId,
        version_number: 1,
        status: "draft",
        description: input.description,
        valid_from: input.validFrom || createdAt,
        rules: input.rules || [],
        created_by: session.userName,
        created_at: createdAt,
      };

      const newPolicy: Policy = {
        id: policyId,
        workspace_id: session.workspaceId,
        product_id: input.productId || null,
        name: input.name,
        code: input.code,
        description: input.description,
        category: input.category,
        severity: calculatedSeverity,
        status: "draft",
        active_version_id: null,
        active_version_number: null,
        versions_count: 1,
        rules_count: (input.rules || []).length,
        created_at: createdAt,
        updated_at: createdAt,
        active_version: null,
        versions: [newVersion],
      };

      inMemoryPolicies.unshift(newPolicy);

      // Audit event
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_created",
        beforeState: null,
        afterState: {
          name: input.name,
          code: input.code,
          category: input.category,
          severity: calculatedSeverity,
          version_number: 1,
          status: "draft",
        },
      });

      return newPolicy;
    }
  }

  /**
   * Creates a new draft version for an existing policy.
   */
  public static async createDraftVersion(
    session: ServerSessionIdentity,
    policyId: string,
    input: CreateDraftVersionInput
  ): Promise<PolicyVersion> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "create_draft_version", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to modify policies.`);
    }

    // Validate rules
    const validation = PolicySchemaValidator.validatePolicy({
      name: "Version Validation",
      code: "POL-VALIDATE",
      category: "prohibited_claims",
      rules: input.rules,
    });
    if (!validation.isValid) {
      const issuesMsg = validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
      throw new Error(`Policy draft validation failed: ${issuesMsg}`);
    }

    try {
      return await withTransaction(async (client) => {
        // Find latest version number
        const numRes = await client.query<{ max_ver: number }>(
          `SELECT COALESCE(MAX(version_number), 0) as max_ver
           FROM policy_versions
           WHERE policy_id = $1`,
          [policyId]
        );
        const nextVersionNumber = numRes.rows[0].max_ver + 1;

        const verRes = await client.query<{ id: string; created_at: string }>(
          `INSERT INTO policy_versions (policy_id, version_number, status, description, valid_from, valid_until, rules, created_by)
           VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7)
           RETURNING id, created_at`,
          [
            policyId,
            nextVersionNumber,
            input.description || null,
            input.validFrom || new Date().toISOString(),
            input.validUntil || null,
            JSON.stringify(input.rules || []),
            session.userName,
          ]
        );

        await AuditService.recordEvent(
          {
            workspaceId: session.workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "policy_version",
            entityId: verRes.rows[0].id,
            action: "policy_updated",
            beforeState: null,
            afterState: {
              policy_id: policyId,
              version_number: nextVersionNumber,
              status: "draft",
              rules_count: input.rules.length,
            },
          },
          client
        );

        return {
          id: verRes.rows[0].id,
          policy_id: policyId,
          version_number: nextVersionNumber,
          status: "draft",
          description: input.description,
          valid_from: input.validFrom || new Date().toISOString(),
          valid_until: input.validUntil,
          rules: input.rules,
          created_by: session.userName,
          created_at: verRes.rows[0].created_at,
        };
      });
    } catch {
      // In-memory fallback
      const policy = inMemoryPolicies.find((p) => p.id === policyId || p.code === policyId);
      if (!policy) {
        throw new Error(`Policy "${policyId}" not found.`);
      }

      const versions =
        policy.versions && policy.versions.length > 0
          ? policy.versions
          : policy.active_version
          ? [policy.active_version]
          : [];
      const nextVerNumber =
        versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;
      const newVersion: PolicyVersion = {
        id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        policy_id: policy.id,
        version_number: nextVerNumber,
        status: "draft",
        description: input.description,
        valid_from: input.validFrom || new Date().toISOString(),
        valid_until: input.validUntil,
        rules: input.rules,
        created_by: session.userName,
        created_at: new Date().toISOString(),
      };

      versions.push(newVersion);
      policy.versions = versions;
      policy.versions_count = versions.length;

      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy_version",
        entityId: newVersion.id,
        action: "policy_updated",
        beforeState: null,
        afterState: {
          policy_id: policy.id,
          version_number: nextVerNumber,
          status: "draft",
          rules_count: input.rules.length,
        },
      });

      return newVersion;
    }
  }

  /**
   * Updates a draft policy. If the policy is already active/published,
   * editing automatically creates a new draft version to preserve immutability!
   */
  public static async updateDraftPolicy(
    session: ServerSessionIdentity,
    policyId: string,
    input: UpdatePolicyDraftInput
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "update_policy_draft", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to edit policies.`);
    }

    const policy = await this.getPolicyById(session, policyId);

    // If policy is active, create a new draft version rather than mutating active version
    if (policy.status === "active") {
      const newVer = await this.createDraftVersion(session, policyId, {
        description: input.description || `Draft update of ${policy.name}`,
        rules: input.rules || policy.active_version?.rules || [],
        validFrom: input.validFrom,
        validUntil: input.validUntil,
      });

      return await this.getPolicyById(session, policyId);
    }

    // Otherwise, policy is in draft status: update in-place
    try {
      return await withTransaction(async (client) => {
        if (input.name || input.description || input.category || input.severity) {
          await client.query(
            `UPDATE policies 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 category = COALESCE($3, category),
                 severity = COALESCE($4, severity),
                 updated_at = now()
             WHERE id = $5`,
            [
              input.name || null,
              input.description || null,
              input.category || null,
              input.severity || null,
              policyId,
            ]
          );
        }

        if (input.rules) {
          // Update the draft version's rules
          await client.query(
            `UPDATE policy_versions
             SET rules = $1, description = COALESCE($2, description)
             WHERE policy_id = $3 AND status = 'draft'`,
            [JSON.stringify(input.rules), input.description || null, policyId]
          );
        }

        await AuditService.recordEvent(
          {
            workspaceId: session.workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "policy",
            entityId: policyId,
            action: "policy_updated",
            beforeState: null,
            afterState: { policyId, name: input.name, rules_count: input.rules?.length },
          },
          client
        );

        return await this.getPolicyById(session, policyId);
      });
    } catch {
      // In-memory fallback
      const found = inMemoryPolicies.find((p) => p.id === policyId || p.code === policyId);
      if (!found) throw new Error(`Policy "${policyId}" not found.`);

      if (input.name) found.name = input.name;
      if (input.description) found.description = input.description;
      if (input.category) found.category = input.category;
      if (input.severity) found.severity = input.severity;
      found.updated_at = new Date().toISOString();

      if (input.rules && found.versions) {
        const draftVer = found.versions.find((v) => v.status === "draft");
        if (draftVer) {
          draftVer.rules = input.rules;
          if (input.description) draftVer.description = input.description;
        }
      }

      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: found.id,
        action: "policy_updated",
        beforeState: null,
        afterState: { policyId: found.id, name: found.name, rules_count: input.rules?.length },
      });

      return found;
    }
  }

  /**
   * Activates / Publishes a policy version, making it immutable and replacing previous active version.
   */
  public static async activatePolicyVersion(
    session: ServerSessionIdentity,
    policyId: string,
    versionId: string
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "activate_policy_version", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to activate policies.`);
    }

    try {
      return await withTransaction(async (client) => {
        // 1. Mark existing active version as superseded
        await client.query(
          `UPDATE policy_versions
           SET status = 'superseded', valid_until = now()
           WHERE policy_id = $1 AND status = 'active'`,
          [policyId]
        );

        // 2. Activate target version
        const actRes = await client.query<{
          id: string;
          version_number: number;
          rules: PolicyRule[];
          valid_from: string;
        }>(
          `UPDATE policy_versions
           SET status = 'active', activated_at = now()
           WHERE id = $1 AND policy_id = $2
           RETURNING id, version_number, rules, valid_from`,
          [versionId, policyId]
        );

        if (actRes.rows.length === 0) {
          throw new Error(`Version "${versionId}" not found for policy "${policyId}".`);
        }

        const activated = actRes.rows[0];

        // 3. Update master policy record
        await client.query(
          `UPDATE policies
           SET status = 'active', active_version_id = $1, updated_at = now()
           WHERE id = $2`,
          [versionId, policyId]
        );

        // 4. Log audit event
        await AuditService.recordEvent(
          {
            workspaceId: session.workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "policy",
            entityId: policyId,
            action: "policy_activated",
            beforeState: { status: "draft" },
            afterState: {
              active_version_id: versionId,
              version_number: activated.version_number,
              rules_count: activated.rules?.length || 0,
              activated_at: new Date().toISOString(),
            },
          },
          client
        );

        return await this.getPolicyById(session, policyId);
      });
    } catch {
      // In-memory fallback
      const policy = inMemoryPolicies.find((p) => p.id === policyId || p.code === policyId);
      if (!policy) {
        throw new Error(`Policy "${policyId}" not found.`);
      }

      const targetVersion = (policy.versions || []).find(
        (v) => v.id === versionId || v.version_number === Number(versionId)
      );
      if (!targetVersion) {
        throw new Error(`Policy version "${versionId}" not found.`);
      }

      // Supersede current active
      if (policy.active_version) {
        policy.active_version.status = "superseded";
        policy.active_version.valid_until = new Date().toISOString();
      }

      targetVersion.status = "active";
      targetVersion.activated_at = new Date().toISOString();

      policy.status = "active";
      policy.active_version_id = targetVersion.id;
      policy.active_version_number = targetVersion.version_number;
      policy.active_version = targetVersion;
      policy.rules_count = targetVersion.rules.length;
      policy.updated_at = new Date().toISOString();

      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policy.id,
        action: "policy_activated",
        beforeState: null,
        afterState: {
          active_version_id: targetVersion.id,
          version_number: targetVersion.version_number,
          rules_count: targetVersion.rules.length,
          activated_at: targetVersion.activated_at,
        },
      });

      return policy;
    }
  }

  /**
   * Rolls back a policy to a target historical version.
   * Preserves immutability: creates a brand-new version containing the historical rules
   * and activates it.
   */
  public static async rollbackPolicyVersion(
    session: ServerSessionIdentity,
    policyId: string,
    targetVersionNumber: number
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "rollback_policy_version", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to rollback policies.`);
    }

    const policy = await this.getPolicyById(session, policyId);
    const targetVersion = (policy.versions || []).find(
      (v) => v.version_number === Number(targetVersionNumber)
    );

    if (!targetVersion) {
      throw new Error(
        `Version ${targetVersionNumber} not found for policy "${policyId}". Cannot rollback.`
      );
    }

    // Create a new draft version with targetVersion's rules
    const newVersion = await this.createDraftVersion(session, policyId, {
      description: `Rollback to Version ${targetVersionNumber}: ${targetVersion.description || ""}`,
      rules: targetVersion.rules,
      validFrom: new Date().toISOString(),
    });

    // Activate the new version
    const updatedPolicy = await this.activatePolicyVersion(session, policyId, newVersion.id);

    // Record explicit rollback audit event
    await AuditService.recordEvent({
      workspaceId: session.workspaceId,
      actorId: session.userName,
      actorRole: session.role,
      entityType: "policy",
      entityId: policyId,
      action: "policy_rollback",
      beforeState: { active_version_number: policy.active_version_number },
      afterState: {
        rolled_back_to_source_version: targetVersionNumber,
        new_active_version_number: newVersion.version_number,
        new_active_version_id: newVersion.id,
      },
    });

    return updatedPolicy;
  }

  /**
   * Duplicates an existing policy and its active rules into a new draft policy.
   */
  public static async duplicatePolicy(
    session: ServerSessionIdentity,
    sourcePolicyId: string,
    newCode: string,
    newName: string
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: sourcePolicyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "duplicate_policy", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to duplicate policies.`);
    }

    const sourcePolicy = await this.getPolicyById(session, sourcePolicyId);
    const rulesToCopy = sourcePolicy.active_version?.rules || sourcePolicy.versions?.[0]?.rules || [];

    const newPolicy = await this.createPolicy(session, {
      name: newName,
      code: newCode,
      description: `Duplicated from ${sourcePolicy.name} (${sourcePolicy.code})`,
      category: sourcePolicy.category,
      severity: sourcePolicy.severity,
      productId: sourcePolicy.product_id,
      rules: JSON.parse(JSON.stringify(rulesToCopy)),
    });

    await AuditService.recordEvent({
      workspaceId: session.workspaceId,
      actorId: session.userName,
      actorRole: session.role,
      entityType: "policy",
      entityId: newPolicy.id,
      action: "policy_duplicated",
      beforeState: { source_policy_id: sourcePolicyId, source_code: sourcePolicy.code },
      afterState: { new_policy_id: newPolicy.id, new_code: newCode, new_name: newName },
    });

    return newPolicy;
  }

  /**
   * Archives a policy and all its versions.
   */
  public static async archivePolicy(
    session: ServerSessionIdentity,
    policyId: string
  ): Promise<Policy> {
    if (!canManagePolicies(session.role)) {
      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policyId,
        action: "policy_unauthorized_mutation_attempt",
        beforeState: null,
        afterState: { attemptedAction: "archive_policy", role: session.role },
      }).catch(() => {});
      throw new Error(`Forbidden: Role "${session.role}" lacks authorization to archive policies.`);
    }

    try {
      return await withTransaction(async (client) => {
        await client.query(
          `UPDATE policies
           SET status = 'archived', updated_at = now()
           WHERE id = $1`,
          [policyId]
        );

        await client.query(
          `UPDATE policy_versions
           SET status = 'archived', archived_at = now()
           WHERE policy_id = $1`,
          [policyId]
        );

        await AuditService.recordEvent(
          {
            workspaceId: session.workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "policy",
            entityId: policyId,
            action: "policy_archived",
            beforeState: { status: "active" },
            afterState: { status: "archived" },
          },
          client
        );

        return await this.getPolicyById(session, policyId);
      });
    } catch {
      const policy = inMemoryPolicies.find((p) => p.id === policyId || p.code === policyId);
      if (!policy) {
        throw new Error(`Policy "${policyId}" not found.`);
      }

      policy.status = "archived";
      policy.updated_at = new Date().toISOString();
      if (policy.active_version) {
        policy.active_version.status = "archived";
        policy.active_version.archived_at = new Date().toISOString();
      }

      await AuditService.recordEvent({
        workspaceId: session.workspaceId,
        actorId: session.userName,
        actorRole: session.role,
        entityType: "policy",
        entityId: policy.id,
        action: "policy_archived",
        beforeState: { status: "active" },
        afterState: { status: "archived" },
      });

      return policy;
    }
  }

  /**
   * Pure in-memory simulation runner.
   * Evaluates draft rules or existing policies against sample claims.
   * IMPORTANT: Absolutely NO database mutations, NO audit log events!
   */
  public static async simulatePolicy(
    session: ServerSessionIdentity,
    request: PolicySimulationRequest
  ): Promise<PolicySimulationResult> {
    // Both reviewers and admins can simulate policies
    if (!canViewPolicies(session.role)) {
      throw new Error(`Forbidden: Role "${session.role}" lacks simulation authorization.`);
    }

    // Prepare policy context for simulation
    let testPolicies: Policy[] = [];

    if (request.draftRules && request.draftRules.length > 0) {
      // Ephemeral policy wrapping the draft rules
      testPolicies = [
        {
          id: "sim-policy-draft",
          workspace_id: session.workspaceId,
          product_id: request.productId || null,
          name: "Simulation Draft Policy",
          code: "SIM-POL-001",
          category: request.draftRules[0]?.category || "prohibited_claims",
          severity: request.draftRules[0]?.severity || "high",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active_version: {
            id: "sim-ver-001",
            policy_id: "sim-policy-draft",
            version_number: 1,
            status: "active",
            valid_from: "2020-01-01T00:00:00Z",
            rules: request.draftRules,
            created_by: session.userName,
            created_at: new Date().toISOString(),
          },
        },
      ];
    } else if (request.policyId) {
      const existing = await this.getPolicyById(session, request.policyId);
      testPolicies = [existing];
    } else {
      // Use all active workspace policies
      testPolicies = await this.getPolicies(session, { status: "active" });
    }

    let compliantCount = 0;
    let reviewRequiredCount = 0;
    let nonCompliantCount = 0;

    const claimResults = request.sampleClaims.map((claim, index) => {
      const evalRes = PolicyEngine.evaluateClaim(
        claim.id || `sample-${index + 1}`,
        {
          claimText: claim.claim_text,
          claimType: claim.claim_type || "other",
          productId: claim.product_id || request.productId,
          channel: claim.channel || request.channel,
          evidenceTypes: claim.evidence_types || [],
          submissionContent: claim.submission_content,
        },
        testPolicies
      );

      if (evalRes.complianceStatus === "compliant") compliantCount++;
      else if (evalRes.complianceStatus === "review_required") reviewRequiredCount++;
      else if (evalRes.complianceStatus === "non_compliant") nonCompliantCount++;

      // Aggregate failed conditions across all evaluated rules
      const failedConditions: string[] = [];
      for (const pol of testPolicies) {
        const ver = PolicyEngine.resolveEffectiveVersion(pol);
        if (ver?.rules) {
          for (const rule of ver.rules) {
            const ruleRes = RuleEvaluator.evaluateRule(
              rule,
              {
                claimText: claim.claim_text,
                claimType: claim.claim_type || "other",
                productId: claim.product_id || request.productId,
                channel: claim.channel || request.channel,
                evidenceTypes: claim.evidence_types || [],
                submissionContent: claim.submission_content,
              },
              { policyId: pol.id, policyCode: pol.code, versionNumber: ver.version_number }
            );
            if (!ruleRes.isTriggered && ruleRes.failedConditions.length > 0) {
              failedConditions.push(...ruleRes.failedConditions);
            }
          }
        }
      }

      return {
        claimText: claim.claim_text,
        claimType: claim.claim_type || "other",
        complianceStatus: evalRes.complianceStatus,
        maxSeverity: evalRes.maxSeverity,
        triggeredRules: evalRes.triggeredRules,
        failedConditions: Array.from(new Set(failedConditions)),
        requiredEvidenceTypes: evalRes.requiredEvidenceTypes,
        mandatoryReviewerRoles: evalRes.mandatoryReviewerRoles,
        summary: evalRes.summary,
      };
    });

    return {
      evaluatedClaimsCount: request.sampleClaims.length,
      compliantCount,
      reviewRequiredCount,
      nonCompliantCount,
      claimResults,
      timestamp: new Date().toISOString(),
    };
  }
}
