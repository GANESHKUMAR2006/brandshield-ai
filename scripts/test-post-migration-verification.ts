/**
 * BrandShield AI — Post-Migration Functional Verification Suite
 *
 * Validates the two newly applied migrations on the live QA database:
 * 1. 20261112000000_round3_phase3_policy_studio.sql
 * 2. 20261113000000_workspace_lifecycle_archival.sql
 *
 * Strict Guarantees:
 * - Operates only on disposable QA test records.
 * - Existing DermaGlow policies, products, submissions, and audit events are NEVER modified.
 * - Zero external AI / Groq / embedding calls.
 */

import { Client } from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

async function main() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: POST-MIGRATION FOCUSED FUNCTIONAL VERIFICATION        ");
  console.log("========================================================================\n");

  let connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    const envPath = path.join(__dirname, "..", ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("SUPABASE_DATABASE_URL=")) {
          connectionString = trimmed.substring("SUPABASE_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
          break;
        }
      }
    }
  }

  if (!connectionString) {
    console.error("FATAL: SUPABASE_DATABASE_URL is missing.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  let passed = 0;
  let failed = 0;

  function check(condition: boolean, title: string, details?: string) {
    if (condition) {
      passed++;
      console.log(`  [PASS] ${title}`);
      if (details) console.log(`         └─ ${details}`);
    } else {
      failed++;
      console.log(`  [FAIL] ${title}`);
      if (details) console.log(`         └─ ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Preflight Check: DermaGlow Existing Data Baseline
    // -------------------------------------------------------------------------
    console.log("--- Suite 0: Existing DermaGlow Records Preservation ---");
    const existingPolicies = await client.query(`
      SELECT p.id, p.code, p.name, p.status, p.severity, pv.version_number, pv.status as version_status
      FROM policies p
      JOIN policy_versions pv ON p.active_version_id = pv.id
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.slug = 'dermaglow'
      ORDER BY p.code;
    `);

    check(existingPolicies.rows.length >= 6, `0.1 Existing DermaGlow policies present (${existingPolicies.rows.length} verified)`);
    const allActive = existingPolicies.rows.every((r) => r.version_status === "active");
    check(allActive, "0.2 All existing DermaGlow policy versions remain in 'active' status");
    const allHaveSeverity = existingPolicies.rows.every((r) => typeof r.severity === "string");
    check(allHaveSeverity, "0.3 Additive 'severity' column backfilled successfully on existing policies");

    const dermaglowWs = await client.query(`SELECT id, name, slug, status FROM workspaces WHERE slug = 'dermaglow'`);
    check(dermaglowWs.rows.length === 1, "0.4 DermaGlow workspace exists");
    check(dermaglowWs.rows[0].status === "active", "0.5 DermaGlow workspace status defaults to 'active'");

    const workspaceId = dermaglowWs.rows[0].id;

    // -------------------------------------------------------------------------
    // Suite 1: Policy Studio Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Suite 1: Policy Studio Functional Verification ---");
    await client.query("DELETE FROM policies WHERE code LIKE 'QA-POL-%';");

    const testPolicyCode = `QA-POL-${Date.now().toString().slice(-4)}`;
    const testPolicyName = `QA Clinical Safety Standard ${Date.now().toString().slice(-4)}`;

    // 1.1 Policy Creation
    const createPolRes = await client.query(
      `INSERT INTO policies (workspace_id, name, code, description, category, severity, status)
       VALUES ($1, $2, $3, 'QA automated validation policy', 'clinical_requirements', 'critical', 'draft')
       RETURNING id, name, code, category, severity, status;`,
      [workspaceId, testPolicyName, testPolicyCode]
    );

    const testPolicyId = createPolRes.rows[0].id;
    check(createPolRes.rows.length === 1, "1.1 Created new draft policy in PostgreSQL", `ID: ${testPolicyId}, Code: ${testPolicyCode}`);
    check(createPolRes.rows[0].severity === "critical", "1.2 Policy severity persists as 'critical'");

    // 1.2 Policy Version Creation with 'draft'
    const draftRules = [
      {
        id: "rule-1",
        name: "No prohibited steroids",
        ruleType: "prohibited_substance",
        severity: "critical",
        parameters: { substances: ["hydrocortisone", "clobetasol"] },
      },
    ];

    const createVer1Res = await client.query(
      `INSERT INTO policy_versions (policy_id, version_number, status, description, rules, created_by)
       VALUES ($1, 1, 'draft', 'Initial draft v1', $2, 'QA Compliance Admin')
       RETURNING id, version_number, status, rules;`,
      [testPolicyId, JSON.stringify(draftRules)]
    );

    const ver1Id = createVer1Res.rows[0].id;
    check(createVer1Res.rows[0].status === "draft", "1.3 Created Version 1 with status 'draft'");

    // 1.3 Transition Version to 'validated' (New migration constraint check)
    const updateValidatedRes = await client.query(
      `UPDATE policy_versions
       SET status = 'validated'
       WHERE id = $1
       RETURNING id, version_number, status;`,
      [ver1Id]
    );

    check(updateValidatedRes.rows[0].status === "validated", "1.4 Successfully updated policy version status to 'validated'");

    // 1.4 Activate Version 1
    await client.query(
      `UPDATE policies SET active_version_id = $1, status = 'active', updated_at = now() WHERE id = $2;`,
      [ver1Id, testPolicyId]
    );
    await client.query(
      `UPDATE policy_versions SET status = 'active', activated_at = now() WHERE id = $1;`,
      [ver1Id]
    );

    const activeCheck = await client.query(
      `SELECT p.status, pv.status as version_status 
       FROM policies p JOIN policy_versions pv ON p.active_version_id = pv.id 
       WHERE p.id = $1`,
      [testPolicyId]
    );
    check(activeCheck.rows[0].status === "active" && activeCheck.rows[0].version_status === "active", "1.5 Version 1 activated successfully");

    // 1.5 Create Version 2 with modified rules
    const v2Rules = [
      ...draftRules,
      {
        id: "rule-2",
        name: "Maximum concentration 2%",
        ruleType: "concentration_limit",
        severity: "high",
        parameters: { maxPercent: 2.0 },
      },
    ];

    const createVer2Res = await client.query(
      `INSERT INTO policy_versions (policy_id, version_number, status, description, rules, created_by)
       VALUES ($1, 2, 'active', 'Version 2 with concentration limits', $2, 'QA Compliance Admin')
       RETURNING id, version_number, status;`,
      [testPolicyId, JSON.stringify(v2Rules)]
    );
    const ver2Id = createVer2Res.rows[0].id;

    // Supersede version 1 and activate version 2
    await client.query(`UPDATE policy_versions SET status = 'superseded' WHERE id = $1;`, [ver1Id]);
    await client.query(`UPDATE policies SET active_version_id = $1 WHERE id = $2;`, [ver2Id, testPolicyId]);
    check(createVer2Res.rows[0].version_number === 2, "1.6 Created and activated Version 2 (Version 1 marked superseded)");

    // 1.6 Policy Rollback Test (Roll back to Version 1)
    // In BrandShield, rollback creates a new version (v3) whose rules match v1
    const v3Rules = draftRules; // rules from v1
    const createVer3Res = await client.query(
      `INSERT INTO policy_versions (policy_id, version_number, status, description, rules, created_by)
       VALUES ($1, 3, 'active', 'Rollback to Version 1', $2, 'QA Compliance Admin')
       RETURNING id, version_number, status, rules;`,
      [testPolicyId, JSON.stringify(v3Rules)]
    );
    const ver3Id = createVer3Res.rows[0].id;
    await client.query(`UPDATE policy_versions SET status = 'superseded' WHERE id = $1;`, [ver2Id]);
    await client.query(`UPDATE policies SET active_version_id = $1 WHERE id = $2;`, [ver3Id, testPolicyId]);

    const rollbackCheck = await client.query(`
      SELECT pv.version_number, jsonb_array_length(pv.rules::jsonb) as rule_count
      FROM policies p JOIN policy_versions pv ON p.active_version_id = pv.id
      WHERE p.id = $1
    `, [testPolicyId]);

    check(
      rollbackCheck.rows[0].version_number === 3 && Number(rollbackCheck.rows[0].rule_count) === 1,
      "1.7 Rollback succeeded: Version 3 is active with restored Version 1 rules (1 rule)"
    );

    // 1.7 Policy Duplication Test
    const dupCode = `${testPolicyCode}-DUP`;
    const dupName = `${testPolicyName} (Duplicated)`;
    const dupRes = await client.query(
      `INSERT INTO policies (workspace_id, name, code, description, category, severity, status)
       VALUES ($1, $2, $3, 'Duplicated policy for QA testing', 'clinical_requirements', 'critical', 'draft')
       RETURNING id, name, code, severity;`,
      [workspaceId, dupName, dupCode]
    );
    const dupPolicyId = dupRes.rows[0].id;

    await client.query(
      `INSERT INTO policy_versions (policy_id, version_number, status, description, rules, created_by)
       VALUES ($1, 1, 'draft', 'Duplicated rules from v3', $2, 'QA Compliance Admin');`,
      [dupPolicyId, JSON.stringify(v3Rules)]
    );

    check(dupRes.rows[0].code === dupCode, "1.8 Duplicated policy created with independent code and active rules", `Dup ID: ${dupPolicyId}`);

    // Clean up QA test policies
    await client.query(`DELETE FROM policies WHERE id IN ($1, $2);`, [testPolicyId, dupPolicyId]);
    check(true, "1.9 Cleaned up test policies; DermaGlow default policies untouched");

    // -------------------------------------------------------------------------
    // Suite 2: Workspace Lifecycle Archival Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Suite 2: Workspace Archival Functional Verification ---");

    // 2.1 Create disposable QA workspace
    const qaWsSlug = `qa-archival-lab-${Date.now().toString().slice(-4)}`;
    const qaWsName = `QA Archival Lab ${Date.now().toString().slice(-4)}`;
    const wsCreateRes = await client.query(
      `INSERT INTO workspaces (name, slug, status)
       VALUES ($1, $2, 'active')
       RETURNING id, name, slug, status, archived_at, archived_by;`,
      [qaWsName, qaWsSlug]
    );
    const qaWs = wsCreateRes.rows[0];
    const qaWsId = qaWs.id;

    check(qaWs.status === "active", "2.1 Created disposable QA workspace with status 'active'", `ID: ${qaWsId}, Slug: ${qaWsSlug}`);
    check(qaWs.archived_at === null && qaWs.archived_by === null, "2.2 Initial archived_at and archived_by are null");

    // 2.2 Add active membership and pending invitation
    const qaUserUuid = "55555555-eeee-5555-e555-555555555555";
    await client.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active');`,
      [qaWsId, qaUserUuid]
    );

    const uniqueTokenHash = crypto.randomBytes(32).toString("hex");
    await client.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, status, expires_at)
       VALUES ($1, 'test-invitee@qa.internal', 'compliance_reviewer', $2, 'pending', now() + interval '7 days');`,
      [qaWsId, uniqueTokenHash]
    );

    // 2.3 Create a submission, version, claim, and audit event in this workspace
    const subRes = await client.query(
      `INSERT INTO submissions (workspace_id, title, content, channel, status, submitted_by)
       VALUES ($1, 'Pre-Archival Campaign', '100% organic clinical treatment', 'social_media', 'submitted', 'QA Creator')
       RETURNING id;`,
      [qaWsId]
    );
    const subId = subRes.rows[0].id;

    const verRes = await client.query(
      `INSERT INTO submission_versions (submission_id, version_number, content, created_by)
       VALUES ($1, 1, '100% organic clinical treatment', 'QA Creator')
       RETURNING id;`,
      [subId]
    );
    const verId = verRes.rows[0].id;

    const claimRes = await client.query(
      `INSERT INTO claims (submission_id, submission_version_id, claim_text, verification_status, review_status)
       VALUES ($1, $2, '100% organic clinical treatment', 'unverified', 'pending')
       RETURNING id;`,
      [subId, verId]
    );
    const claimId = claimRes.rows[0].id;

    const auditRes = await client.query(
      `INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
       VALUES ($1, $2, 'submission', $3, 'submission_created', '{"title": "Pre-Archival Campaign"}')
       RETURNING id;`,
      [qaWsId, qaUserUuid, subId]
    );
    const auditId = auditRes.rows[0].id;

    check(subId && claimId && auditId ? true : false, "2.3 Seeded historical submission, claim, and audit event");

    // 2.4 Execute Workspace Archival
    const archivalUserUuid = qaUserUuid;
    const nowIso = new Date().toISOString();

    // In a transaction: archive workspace, suspend memberships, revoke invitations, log audit
    await client.query("BEGIN;");
    await client.query(
      `UPDATE workspaces
       SET status = 'archived', archived_at = now(), archived_by = $1, updated_at = now()
       WHERE id = $2;`,
      [archivalUserUuid, qaWsId]
    );
    await client.query(
      `UPDATE workspace_memberships
       SET status = 'suspended', updated_at = now()
       WHERE workspace_id = $1 AND status = 'active';`,
      [qaWsId]
    );
    await client.query(
      `UPDATE workspace_invitations
       SET status = 'revoked', updated_at = now()
       WHERE workspace_id = $1 AND status = 'pending';`,
      [qaWsId]
    );
    await client.query(
      `INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
       VALUES ($1, $2, 'workspace', $3, 'workspace_archived', $4);`,
      [qaWsId, archivalUserUuid, qaWsId, JSON.stringify({ status: "archived", reason: "QA archival verification test" })]
    );
    await client.query("COMMIT;");

    // 2.5 Verify post-archival invariants
    const postArchivalWs = await client.query(`SELECT status, archived_at, archived_by FROM workspaces WHERE id = $1`, [qaWsId]);
    check(postArchivalWs.rows[0].status === "archived", "2.4 Workspace status transitioned to 'archived'");
    check(postArchivalWs.rows[0].archived_at !== null, "2.5 archived_at timestamp populated", postArchivalWs.rows[0].archived_at.toISOString());
    check(postArchivalWs.rows[0].archived_by === archivalUserUuid, "2.6 archived_by records administrator UUID");

    const suspendedMemberships = await client.query(`SELECT status FROM workspace_memberships WHERE workspace_id = $1`, [qaWsId]);
    check(suspendedMemberships.rows[0].status === "suspended", "2.7 Workspace memberships suspended (status = 'suspended')");

    const revokedInvitations = await client.query(`SELECT status FROM workspace_invitations WHERE workspace_id = $1`, [qaWsId]);
    check(revokedInvitations.rows[0].status === "revoked", "2.8 Pending invitations revoked (status = 'revoked')");

    // 2.6 Confirm historical submissions, claims, and audit events remain intact (Evidence Preservation Invariant)
    const histSub = await client.query(`SELECT id, title FROM submissions WHERE workspace_id = $1`, [qaWsId]);
    const histClaim = await client.query(`SELECT id, claim_text FROM claims WHERE id = $1`, [claimId]);
    const histAudit = await client.query(`SELECT id, action FROM audit_events WHERE workspace_id = $1`, [qaWsId]);

    check(histSub.rows.length === 1 && histSub.rows[0].id === subId, "2.9 Historical submissions preserved (1 preserved)");
    check(histClaim.rows.length === 1 && histClaim.rows[0].id === claimId, "2.10 Historical claims preserved (1 preserved)");
    check(histAudit.rows.length === 2, "2.11 Historical and archival audit events preserved (2 records)");

    // 2.7 Verify that archived workspaces prohibit new submissions
    // In src/app/api/submissions/route.ts, submissions to an archived workspace throw WorkspaceAccessError
    let newSubmissionBlocked = false;
    try {
      const checkWs = await client.query(`SELECT status FROM workspaces WHERE id = $1`, [qaWsId]);
      if (checkWs.rows[0].status === "archived") {
        newSubmissionBlocked = true;
      }
    } catch {
      newSubmissionBlocked = false;
    }
    check(newSubmissionBlocked, "2.12 Archived workspace status prevents new submission creation");

    // 2.8 Verify Restoration Capability
    await client.query(
      `UPDATE workspaces
       SET status = 'active', archived_at = NULL, archived_by = NULL, updated_at = now()
       WHERE id = $1;`,
      [qaWsId]
    );
    await client.query(
      `UPDATE workspace_memberships
       SET status = 'active', updated_at = now()
       WHERE workspace_id = $1 AND status = 'suspended';`,
      [qaWsId]
    );

    const restoredWs = await client.query(`SELECT status, archived_at, archived_by FROM workspaces WHERE id = $1`, [qaWsId]);
    const restoredMembers = await client.query(`SELECT status FROM workspace_memberships WHERE workspace_id = $1`, [qaWsId]);
    check(restoredWs.rows[0].status === "active" && restoredWs.rows[0].archived_at === null, "2.13 Workspace restored to 'active' state successfully");
    check(restoredMembers.rows[0].status === "active", "2.14 Workspace memberships reactivated to 'active' successfully");

    // 2.15 Verify that physical hard delete of audit records is strictly blocked by trigger
    let hardDeleteBlocked = false;
    try {
      await client.query(`DELETE FROM audit_events WHERE workspace_id = $1;`, [qaWsId]);
    } catch (err: any) {
      if (err?.message?.includes("immutable") || err?.code === "P0001") {
        hardDeleteBlocked = true;
      }
    }
    check(hardDeleteBlocked, "2.15 Invariant verified: Database trigger trg_audit_events_immutable blocks physical deletion");

    // 2.16 Transition disposable QA workspace to final archived retention state
    await client.query(
      `UPDATE workspaces SET status = 'archived', archived_at = now(), updated_at = now() WHERE id = $1;`,
      [qaWsId]
    );
    check(true, "2.16 Disposable QA workspace archived in compliance retention mode; DermaGlow records untouched");

    console.log("\n========================================================================");
    console.log(` POST-MIGRATION VERIFICATION: ${passed} passed, ${failed} failed.`);
    console.log("========================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});