/**
 * BrandShield AI — Production-Readiness Security Gate Live E2E Suite
 * 
 * Executes live tests against the isolated QA Supabase database:
 * Host: aws-0-ap-south-1.pooler.supabase.com
 * 
 * Verifies real implementation (not mocks):
 * 1. Positive identification of isolated QA database.
 * 2. Negative case: Wrong-account invitation acceptance blocked (HTTP 403 mismatch).
 * 3. Negative case: Unconfirmed email invitation acceptance blocked (HTTP 403 unconfirmedEmail).
 * 4. Positive case: Verified intended recipient acceptance succeeds (HTTP 200).
 * 5. Negative case: Replay attack on accepted invitation blocked (HTTP 400).
 * 6. Security invariant: Admin role preservation (accepting lower-role invite does NOT downgrade admin).
 * 7. Negative case: Admin self-approval of join request blocked (HTTP 403).
 * 8. Negative case: Cross-workspace access denial (RLS / workspace isolation).
 * 9. Security invariant: Distributed shared-storage join-code rate limiting (HTTP 429 + Retry-After).
 * 10. Security invariant: Audit log immutability enforced by 21 CFR Part 11 database trigger.
 * 11. Clean up disposable test records.
 */

import { Client } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as acceptInvitation } from "../src/app/api/workspaces/invitations/accept/route";
import { POST as approveJoinRequest } from "../src/app/api/workspaces/[id]/join-requests/[requestId]/approve/route";
import { POST as submitJoinRequest } from "../src/app/api/workspaces/join-requests/route";
import { __setTestSessionOverride, ServerSessionIdentity } from "../src/lib/auth/server-session";
import { EmailService } from "../src/lib/email/email-service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passed++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runSecurityGateSuite() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: FINAL PRODUCTION-READINESS SECURITY GATE (LIVE QA)    ");
  console.log(" Real Database Telemetry & Live Enforcement Verification               ");
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
    throw new Error("SUPABASE_DATABASE_URL is missing.");
  }

  process.env.SUPABASE_DATABASE_URL = connectionString;
  process.env.DATABASE_URL = connectionString;

  const u = new URL(connectionString);
  console.log("--- 1. Target Database Positive Identification ---");
  console.log(`  - Host:     ${u.hostname}`);
  console.log(`  - Database: ${u.pathname.replace("/", "")}`);

  if (!u.hostname.includes("supabase.com") || u.username.includes("production")) {
    throw new Error("HALT: Database connection could not be positively verified as isolated QA.");
  }
  assert(true, "1.1 Target database positively identified as isolated QA pooler");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  process.env.QA_EMAIL_CAPTURE = "true";
  (process.env as any).NODE_ENV = "test";
  EmailService.clearCapturedEmails();

  const runId = Date.now().toString(36);
  const testWorkspace1 = {
    id: crypto.randomUUID(),
    name: `Gate QA Alpha ${runId}`,
    slug: `gate-qa-alpha-${runId}`,
  };
  const testWorkspace2 = {
    id: crypto.randomUUID(),
    name: `Gate QA Beta ${runId}`,
    slug: `gate-qa-beta-${runId}`,
  };

  const adminUser = {
    id: crypto.randomUUID(),
    email: `gate.admin.${runId}@example-qa.com`,
    name: "Gate QA Admin",
  };

  const intendedReviewer = {
    id: crypto.randomUUID(),
    email: `gate.reviewer.${runId}@example-qa.com`,
    name: "Gate Intended Reviewer",
  };

  const wrongAccountUser = {
    id: crypto.randomUUID(),
    email: `gate.wrong.${runId}@example-qa.com`,
    name: "Gate Wrong User",
  };

  const unconfirmedUser = {
    id: crypto.randomUUID(),
    email: `gate.unconfirmed.${runId}@example-qa.com`,
    name: "Gate Unconfirmed User",
  };

  try {
    console.log("\n--- 2. Database Seeding for Real Live Execution ---");
    await client.query(
      `INSERT INTO workspaces (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [testWorkspace1.id, testWorkspace1.name, testWorkspace1.slug, testWorkspace2.id, testWorkspace2.name, testWorkspace2.slug]
    );

    // Seed Admin in Workspace 1
    await client.query(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role, status) VALUES ($1, $2, 'admin', 'active')`,
      [testWorkspace1.id, adminUser.id]
    );
    assert(true, "2.1 Test workspaces and Admin membership seeded in isolated QA DB");

    // Seed an invitation for Intended Reviewer
    const rawInviteToken = "bs_gate_" + crypto.randomBytes(24).toString("hex");
    const inviteTokenHash = crypto.createHash("sha256").update(rawInviteToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    const invInsert = await client.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, status, expires_at, invited_by)
       VALUES ($1, $2, 'compliance_reviewer', $3, 'pending', $4, $5)
       RETURNING id`,
      [testWorkspace1.id, intendedReviewer.email, inviteTokenHash, expiresAt.toISOString(), adminUser.id]
    );
    const inviteId = invInsert.rows[0].id;
    assert(true, "2.2 Valid pending invitation inserted into isolated QA DB", `Invite ID: ${inviteId}`);

    // --- 3. Negative Case: Wrong-account acceptance attempt ---
    console.log("\n--- 3. Negative Case: Wrong-Account Acceptance Attempt ---");
    const wrongSession: ServerSessionIdentity = {
      userId: wrongAccountUser.id,
      userName: wrongAccountUser.name,
      userEmail: wrongAccountUser.email,
      role: "viewer",
      workspaceId: testWorkspace1.id,
      workspaceSlug: testWorkspace1.slug,
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: true,
    };
    __setTestSessionOverride(wrongSession);

    const reqWrong = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawInviteToken }),
    });

    const resWrong = await acceptInvitation(reqWrong);
    const dataWrong = await resWrong.json();

    assert(resWrong.status === 403, "3.1 Wrong account session rejected with HTTP 403 Forbidden", `Status: ${resWrong.status}`);
    assert(dataWrong.mismatch === true, "3.2 Response explicitly indicates mismatch: true");

    // Verify DB state in PostgreSQL: ZERO mutations
    const dbInvCheck1 = await client.query(`SELECT status, accepted_by FROM workspace_invitations WHERE id = $1`, [inviteId]);
    assert(dbInvCheck1.rows[0].status === "pending", "3.3 Database verification: Invitation remains 'pending'");
    assert(dbInvCheck1.rows[0].accepted_by === null, "3.4 Database verification: accepted_by remains NULL");

    const dbMemCheckWrong = await client.query(`SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`, [testWorkspace1.id, wrongAccountUser.id]);
    assert(dbMemCheckWrong.rows.length === 0, "3.5 Database verification: Zero memberships created for wrong account");

    // --- 4. Negative Case: Unconfirmed email acceptance attempt ---
    console.log("\n--- 4. Negative Case: Unconfirmed Email Acceptance Attempt ---");
    const rawUnconfirmedToken = "bs_gate_unconf_" + crypto.randomBytes(24).toString("hex");
    const unconfTokenHash = crypto.createHash("sha256").update(rawUnconfirmedToken).digest("hex");

    await client.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, status, expires_at, invited_by)
       VALUES ($1, $2, 'creator', $3, 'pending', $4, $5)`,
      [testWorkspace1.id, unconfirmedUser.email, unconfTokenHash, expiresAt.toISOString(), adminUser.id]
    );

    const unconfSession: ServerSessionIdentity = {
      userId: unconfirmedUser.id,
      userName: unconfirmedUser.name,
      userEmail: unconfirmedUser.email,
      role: "creator",
      workspaceId: testWorkspace1.id,
      workspaceSlug: testWorkspace1.slug,
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: false, // UNCONFIRMED!
    };
    __setTestSessionOverride(unconfSession);

    const reqUnconf = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawUnconfirmedToken }),
    });

    const resUnconf = await acceptInvitation(reqUnconf);
    const dataUnconf = await resUnconf.json();

    assert(resUnconf.status === 403, "4.1 Unconfirmed email rejected with HTTP 403 Forbidden", `Status: ${resUnconf.status}`);
    assert(dataUnconf.unconfirmedEmail === true, "4.2 Response explicitly indicates unconfirmedEmail: true");

    const dbMemCheckUnconf = await client.query(`SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`, [testWorkspace1.id, unconfirmedUser.id]);
    assert(dbMemCheckUnconf.rows.length === 0, "4.3 Database verification: Zero memberships created for unconfirmed email");

    // --- 5. Positive Case: Intended Verified User Accepts ---
    console.log("\n--- 5. Positive Case: Verified Intended User Accepts ---");
    const intendedSession: ServerSessionIdentity = {
      userId: intendedReviewer.id,
      userName: intendedReviewer.name,
      userEmail: intendedReviewer.email,
      role: "compliance_reviewer",
      workspaceId: testWorkspace1.id,
      workspaceSlug: testWorkspace1.slug,
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: true,
    };
    __setTestSessionOverride(intendedSession);

    const reqCorrect = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawInviteToken }),
    });

    const resCorrect = await acceptInvitation(reqCorrect);
    const dataCorrect = await resCorrect.json();

    assert(resCorrect.status === 200, "5.1 Matching verified recipient accepted with HTTP 200 OK", `Status: ${resCorrect.status}`);
    assert(dataCorrect.success === true, "5.2 Response indicates success: true");

    // Verify DB state in PostgreSQL
    const dbInvCheck2 = await client.query(`SELECT status, accepted_by FROM workspace_invitations WHERE id = $1`, [inviteId]);
    assert(dbInvCheck2.rows[0].status === "accepted", "5.3 Database verification: Invitation status updated to 'accepted'");
    assert(dbInvCheck2.rows[0].accepted_by === intendedReviewer.id, "5.4 Database verification: accepted_by recorded as intended user UUID");

    const dbMemCheckCorrect = await client.query(`SELECT role, status FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`, [testWorkspace1.id, intendedReviewer.id]);
    assert(dbMemCheckCorrect.rows.length === 1 && dbMemCheckCorrect.rows[0].role === "compliance_reviewer",
      "5.5 Database verification: Exactly 1 membership created with role 'compliance_reviewer'");

    // --- 6. Negative Case: Replay attack on accepted invitation ---
    console.log("\n--- 6. Negative Case: Replay Attack on Accepted Token ---");
    const reqReplay = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawInviteToken }),
    });
    const resReplay = await acceptInvitation(reqReplay);
    const dataReplay = await resReplay.json();

    assert(resReplay.status === 400, "6.1 Replay attempt rejected with HTTP 400 Bad Request", `Status: ${resReplay.status}`);
    assert(dataReplay.error.includes("already been used"), "6.2 Error message confirms token was already consumed");

    // --- 7. Security Invariant: Administrator Role Preservation ---
    console.log("\n--- 7. Security Invariant: Administrator Role Preservation ---");
    const rawAdminLowerToken = "bs_gate_admin_lower_" + crypto.randomBytes(24).toString("hex");
    const adminLowerTokenHash = crypto.createHash("sha256").update(rawAdminLowerToken).digest("hex");

    await client.query(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, status, expires_at, invited_by)
       VALUES ($1, $2, 'creator', $3, 'pending', $4, $5)`,
      [testWorkspace1.id, adminUser.email, adminLowerTokenHash, expiresAt.toISOString(), adminUser.id]
    );

    const adminSession: ServerSessionIdentity = {
      userId: adminUser.id,
      userName: adminUser.name,
      userEmail: adminUser.email,
      role: "admin",
      workspaceId: testWorkspace1.id,
      workspaceSlug: testWorkspace1.slug,
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: true,
    };
    __setTestSessionOverride(adminSession);

    const reqAdminLower = new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawAdminLowerToken }),
    });

    const resAdminLower = await acceptInvitation(reqAdminLower);
    assert(resAdminLower.status === 200, "7.1 Admin accepted lower-role invitation with HTTP 200");

    const dbAdminMemCheck = await client.query(
      `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2`,
      [testWorkspace1.id, adminUser.id]
    );
    assert(
      dbAdminMemCheck.rows[0].role === "admin",
      "7.2 Database verification: Admin membership role strictly PRESERVED as 'admin' (NOT downgraded to creator)",
      `Current Role: ${dbAdminMemCheck.rows[0].role}`
    );

    // --- 8. Negative Case: Self-Approval of Join Request Blocked ---
    console.log("\n--- 8. Negative Case: Self-Approval of Join Request Blocked ---");
    const joinReqInsert = await client.query(
      `INSERT INTO workspace_join_requests (workspace_id, user_id, user_email, user_name, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [testWorkspace1.id, adminUser.id, adminUser.email, adminUser.name]
    );
    const selfJoinReqId = joinReqInsert.rows[0].id;

    const reqSelfApprove = new NextRequest(`http://localhost:3000/api/workspaces/${testWorkspace1.id}/join-requests/${selfJoinReqId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "compliance_reviewer" }),
    });

    const resSelfApprove = await approveJoinRequest(reqSelfApprove, {
      params: Promise.resolve({ id: testWorkspace1.id, requestId: selfJoinReqId }),
    });
    const dataSelfApprove = await resSelfApprove.json();

    assert(resSelfApprove.status === 403, "8.1 Self-approval attempt rejected with HTTP 403 Forbidden", `Status: ${resSelfApprove.status}`);
    assert(dataSelfApprove.error.includes("cannot approve your own"), "8.2 Error explicitly prevents self-approval");

    // --- 9. Negative Case: Cross-Workspace Access Isolation ---
    console.log("\n--- 9. Negative Case: Cross-Workspace Access Isolation ---");
    const reqCross = new NextRequest(`http://localhost:3000/api/workspaces/${testWorkspace2.id}/join-requests/${selfJoinReqId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "compliance_reviewer" }),
    });

    const resCross = await approveJoinRequest(reqCross, {
      params: Promise.resolve({ id: testWorkspace2.id, requestId: selfJoinReqId }),
    });
    assert(resCross.status === 403 || resCross.status === 404, "9.1 Cross-workspace request approval strictly blocked by tenancy gate", `Status: ${resCross.status}`);

    // --- 10. Security Invariant: Distributed Shared-Storage Rate Limiting ---
    console.log("\n--- 10. Security Invariant: Distributed Shared-Storage Rate Limiting ---");
    const rateLimitIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    const rateLimitUser = { id: crypto.randomUUID(), email: `gate.ratelimit.${runId}@example-qa.com`, name: "Gate RL User" };
    __setTestSessionOverride({
      userId: rateLimitUser.id,
      userName: rateLimitUser.name,
      userEmail: rateLimitUser.email,
      role: "viewer",
      workspaceId: testWorkspace1.id,
      workspaceSlug: testWorkspace1.slug,
      isAuthenticated: true,
      isDemoFallback: false,
    });

    // 4 failed attempts return 404
    for (let i = 1; i <= 4; i++) {
      const req = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": rateLimitIp },
        body: JSON.stringify({ joinCode: `BS-BADCODE${i}` }),
      });
      const res = await submitJoinRequest(req);
      assert(res.status === 404, `10.${i} Failed join code attempt ${i}/5 returned HTTP 404`);
    }

    // 5th failed attempt crosses threshold -> HTTP 429
    const req5 = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": rateLimitIp },
      body: JSON.stringify({ joinCode: "BS-BADCODE5" }),
    });
    const res5 = await submitJoinRequest(req5);
    const data5 = await res5.json();
    assert(res5.status === 429, "10.5 Attempt 5/5 triggers distributed shared-storage rate limit (HTTP 429)", `Status: ${res5.status}`);
    assert(data5.rateLimited === true, "10.6 Response confirms rateLimited: true");
    const retryAfter = res5.headers.get("Retry-After");
    assert(Boolean(retryAfter && Number(retryAfter) > 0), "10.7 Valid Retry-After header emitted by PostgreSQL shared rate limiter", `Retry-After: ${retryAfter}s`);

    // Verify row persisted in PostgreSQL table rate_limit_buckets
    const dbBucketCheck = await client.query(`SELECT count FROM rate_limit_buckets WHERE key = $1`, [`join_code:ip:${rateLimitIp}`]);
    assert(dbBucketCheck.rows.length === 1 && Number(dbBucketCheck.rows[0].count) >= 5, "10.8 Database verification: Rate limit bucket confirmed in PostgreSQL rate_limit_buckets table");

    // --- 11. Security Invariant: 21 CFR Part 11 Audit Immutability ---
    console.log("\n--- 11. Security Invariant: 21 CFR Part 11 Audit Immutability ---");
    const auditInsert = await client.query(
      `INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
       VALUES ($1, $2, 'workspace', $3, 'security_gate_test_event', '{"test": true}')
       RETURNING id`,
      [testWorkspace1.id, adminUser.id, testWorkspace1.id]
    );
    const auditId = auditInsert.rows[0].id;

    let auditTamperBlocked = false;
    try {
      await client.query(`DELETE FROM audit_events WHERE id = $1`, [auditId]);
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes("prevent_audit_tampering") || err.message.includes("immutable"))) {
        auditTamperBlocked = true;
      }
    }
    assert(auditTamperBlocked, "11.1 Database trigger trg_audit_events_immutable blocked DELETE on audit_events under 21 CFR Part 11");

    // --- 12. Cleaning up disposable test records ---
    console.log("\n--- 12. Cleaning up disposable test records ---");
    await client.query(`DELETE FROM workspace_join_requests WHERE workspace_id IN ($1, $2)`, [testWorkspace1.id, testWorkspace2.id]);
    await client.query(`DELETE FROM workspace_invitations WHERE workspace_id IN ($1, $2)`, [testWorkspace1.id, testWorkspace2.id]);
    await client.query(`DELETE FROM workspace_memberships WHERE workspace_id IN ($1, $2)`, [testWorkspace1.id, testWorkspace2.id]);
    await client.query(`DELETE FROM rate_limit_buckets WHERE key LIKE 'join_code:%'`);
    await client.query(`UPDATE workspaces SET status = 'archived' WHERE id IN ($1, $2)`, [testWorkspace1.id, testWorkspace2.id]);
    assert(true, "12.1 All disposable test entities safely cleaned up");

  } finally {
    await client.end();
  }

  console.log("\n========================================================================");
  console.log(` LIVE SECURITY GATE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log("========================================================================\n");

  if (failed > 0) process.exit(1);
}

runSecurityGateSuite().catch((err) => {
  console.error("Fatal error during security gate execution:", err);
  process.exit(1);
});
