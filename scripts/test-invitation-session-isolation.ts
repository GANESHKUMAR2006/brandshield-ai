/**
 * BrandShield AI — Workspace Invitation Session Isolation & Email Confirmation Suite
 * 
 * Verifies:
 * 1. Unauthenticated acceptance attempt fails with HTTP 401.
 * 2. Session Check API (/api/auth/user) accurately exposes auth and confirmation status.
 * 3. Authenticated user with MISMATCHED session email is blocked with HTTP 403 (mismatch: true).
 * 4. Mismatch causes zero database mutations.
 * 5. Matching authenticated user with UNCONFIRMED email is rejected with HTTP 403 (unconfirmedEmail: true).
 * 6. Unconfirmed rejection causes zero database mutations (token not consumed, no membership).
 * 7. Matching user RETRIES after email verification and successfully accepts (HTTP 200).
 * 8. Correct user receives active membership with the exact assigned role.
 * 9. Replayed token is strictly rejected (HTTP 400).
 * 10. Expired and revoked tokens fail safely (HTTP 410 and 400).
 * 11. Unknown tokens return HTTP 404.
 * 12. Administrator Role Preservation: An existing workspace administrator accepting a lower-role
 *     invitation retains their 'admin' role and is never downgraded.
 */

import crypto from "crypto";
import { NextRequest } from "next/server";
import { POST as acceptInvitation } from "../src/app/api/workspaces/invitations/accept/route";
import { GET as checkUserSession } from "../src/app/api/auth/user/route";
import { __setTestSessionOverride, ServerSessionIdentity } from "../src/lib/auth/server-session";
import { __setTestQueryOverride } from "../src/lib/db/server-db";

async function runSessionIsolationSuite() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: INVITATION SESSION ISOLATION & CONFIRMATION SUITE      ");
  console.log("========================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string) {
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

  const workspaceId = "00000000-0000-0000-0000-000000000001";
  const workspaceName = "DermaGlow Laboratories";
  const workspaceSlug = "dermaglow";

  const intendedEmail = "tosaran09@gmail.com";
  const intendedUserId = "33333333-3333-4333-a333-333333333333";
  const intendedRole = "compliance_reviewer";

  const wrongUserEmail = "admin@dermaglow.com";
  const wrongUserId = "22575e06-b0ac-4a5e-9391-58c7f6937298";

  // Tokens
  const validRawToken = "bs_inv_" + crypto.randomBytes(24).toString("hex");
  const validTokenHash = crypto.createHash("sha256").update(validRawToken).digest("hex");

  const unconfirmedUserToken = "bs_inv_" + crypto.randomBytes(24).toString("hex");
  const unconfirmedUserTokenHash = crypto.createHash("sha256").update(unconfirmedUserToken).digest("hex");

  const adminPreserveRawToken = "bs_inv_" + crypto.randomBytes(24).toString("hex");
  const adminPreserveTokenHash = crypto.createHash("sha256").update(adminPreserveRawToken).digest("hex");

  const expiredRawToken = "bs_inv_" + crypto.randomBytes(24).toString("hex");
  const expiredTokenHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");

  const revokedRawToken = "bs_inv_" + crypto.randomBytes(24).toString("hex");
  const revokedTokenHash = crypto.createHash("sha256").update(revokedRawToken).digest("hex");

  // In-memory test store
  const invitationsStore: Array<{
    id: string;
    workspace_id: string;
    email: string;
    role: string;
    token_hash: string;
    status: string;
    expires_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
    created_at: string;
    updated_at: string;
  }> = [
    {
      id: "inv-valid-01",
      workspace_id: workspaceId,
      email: intendedEmail,
      role: intendedRole,
      token_hash: validTokenHash,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "inv-unconfirmed-01",
      workspace_id: workspaceId,
      email: "unconfirmed.newuser@dermaglow.com",
      role: "creator",
      token_hash: unconfirmedUserTokenHash,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "inv-admin-preserve-01",
      workspace_id: workspaceId,
      email: wrongUserEmail, // admin@dermaglow.com
      role: "creator",       // lower role intended to test downgrade prevention!
      token_hash: adminPreserveTokenHash,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "inv-expired-01",
      workspace_id: workspaceId,
      email: intendedEmail,
      role: intendedRole,
      token_hash: expiredTokenHash,
      status: "pending",
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "inv-revoked-01",
      workspace_id: workspaceId,
      email: intendedEmail,
      role: intendedRole,
      token_hash: revokedTokenHash,
      status: "revoked",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
      accepted_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const membershipsStore: Array<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    status: string;
  }> = [
    // Pre-existing administrator membership
    {
      id: "mem-admin-01",
      workspace_id: workspaceId,
      user_id: wrongUserId,
      role: "admin",
      status: "active",
    },
  ];

  const auditEventsStore: Array<{
    workspace_id: string;
    actor_id: string;
    action: string;
  }> = [];

  // Wire DB query interceptor
  __setTestQueryOverride(async (sql: string, params: any[] = []) => {
    // 1. Invitation lookup
    if (sql.includes("FROM workspace_invitations") && sql.includes("WHERE wi.token_hash = $1")) {
      const hash = params[0];
      const match = invitationsStore.find((i) => i.token_hash === hash);
      if (!match) return { rows: [] };
      return {
        rows: [
          {
            id: match.id,
            workspace_id: match.workspace_id,
            email: match.email,
            role: match.role,
            status: match.status,
            expires_at: match.expires_at,
            workspace_name: workspaceName,
            workspace_slug: workspaceSlug,
          },
        ],
      };
    }

    // 2. Invitation update
    if (sql.includes("UPDATE workspace_invitations") && sql.includes("SET status = 'accepted'")) {
      const acceptedBy = params[0];
      const invId = params[1];
      const inv = invitationsStore.find((i) => i.id === invId);
      if (inv) {
        inv.status = "accepted";
        inv.accepted_by = acceptedBy;
        inv.accepted_at = new Date().toISOString();
      }
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes("UPDATE workspace_invitations") && sql.includes("SET status = 'expired'")) {
      const invId = params[0];
      const inv = invitationsStore.find((i) => i.id === invId);
      if (inv) inv.status = "expired";
      return { rowCount: 1, rows: [] };
    }

    // 3. Memberships upsert with Admin Role Preservation
    if (sql.includes("INSERT INTO workspace_memberships")) {
      const wsId = params[0];
      const uId = params[1];
      const role = params[2];
      const existing = membershipsStore.find((m) => m.workspace_id === wsId && m.user_id === uId);
      if (existing) {
        // Enforce SQL logic: CASE WHEN workspace_memberships.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END
        if (sql.includes("CASE WHEN workspace_memberships.role = 'admin'")) {
          if (existing.role !== "admin") {
            existing.role = role;
          }
        } else {
          existing.role = role;
        }
        existing.status = "active";
      } else {
        membershipsStore.push({
          id: `mem-${membershipsStore.length + 1}`,
          workspace_id: wsId,
          user_id: uId,
          role,
          status: "active",
        });
      }
      return { rowCount: 1, rows: [] };
    }

    // 4. Audit events insert
    if (sql.includes("INSERT INTO audit_events")) {
      auditEventsStore.push({
        workspace_id: params[0],
        actor_id: params[1],
        action: params[6] || "invitation_accepted",
      });
      return { rowCount: 1, rows: [] };
    }

    return { rows: [] };
  });

  function makeAcceptRequest(token: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/workspaces/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  // --- SCENARIO 1: Unauthenticated request ---
  console.log("\n[Scenario 1] Unauthenticated Acceptance Rejection");
  __setTestSessionOverride(null);

  const unauthRes = await acceptInvitation(makeAcceptRequest(validRawToken));
  const unauthData = await unauthRes.json();
  assert(unauthRes.status === 401, "Unauthenticated request returns HTTP 401 Unauthorized", `Status: ${unauthRes.status}`);
  assert(unauthData.success === false, "Unauthenticated request has success: false");

  // --- SCENARIO 2: /api/auth/user endpoint reports logged-out state ---
  console.log("\n[Scenario 2] Session Check API (/api/auth/user)");
  const userCheckUnauthRes = await checkUserSession(new NextRequest("http://localhost:3000/api/auth/user"));
  const userCheckUnauthData = await userCheckUnauthRes.json();
  assert(userCheckUnauthData.authenticated === false, "/api/auth/user reports authenticated = false for logged-out visitor");
  assert(userCheckUnauthData.user === null, "/api/auth/user returns user = null for logged-out visitor");

  // --- SCENARIO 3: Wrong Account Attempt (Session Mismatch Protection) ---
  console.log("\n[Scenario 3] Wrong Account Attempt (Session Mismatch Protection)");
  const wrongUserSession: ServerSessionIdentity = {
    userId: wrongUserId,
    userName: "Compliance Administrator",
    userEmail: wrongUserEmail, // admin@dermaglow.com != tosaran09@gmail.com
    role: "admin",
    workspaceId,
    workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
    emailConfirmed: true,
  };
  __setTestSessionOverride(wrongUserSession);

  const wrongAcceptRes = await acceptInvitation(makeAcceptRequest(validRawToken));
  const wrongAcceptData = await wrongAcceptRes.json();

  assert(wrongAcceptRes.status === 403, "Mismatched session returns HTTP 403 Forbidden", `Status: ${wrongAcceptRes.status}`);
  assert(wrongAcceptData.success === false, "Response has success: false");
  assert(wrongAcceptData.mismatch === true, "Response explicitly flags mismatch: true");
  assert(wrongAcceptData.expectedEmail === intendedEmail, `Response indicates expectedEmail: ${intendedEmail}`);
  assert(wrongAcceptData.currentEmail === wrongUserEmail, `Response indicates currentEmail: ${wrongUserEmail}`);

  // Confirm DB invariant: zero changes
  const invStateAfterWrongAttempt = invitationsStore.find((i) => i.id === "inv-valid-01");
  assert(invStateAfterWrongAttempt?.status === "pending", "Invitation status remains 'pending'");
  assert(invStateAfterWrongAttempt?.accepted_by === null, "Invitation accepted_by remains null");

  // --- SCENARIO 4: Unverified / Unconfirmed Email Rejection ---
  console.log("\n[Scenario 4] Unverified Email Rejection (Email Confirmation Enforcement)");
  const unconfirmedEmail = "unconfirmed.newuser@dermaglow.com";
  const unconfirmedUserId = "55555555-5555-4555-b555-555555555555";

  const unconfirmedUserSession: ServerSessionIdentity = {
    userId: unconfirmedUserId,
    userName: "Unconfirmed User",
    userEmail: unconfirmedEmail,
    role: "creator",
    workspaceId,
    workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
    emailConfirmed: false, // Email NOT yet confirmed!
  };
  __setTestSessionOverride(unconfirmedUserSession);

  // Check /api/auth/user exposes emailConfirmed status
  const unconfirmedAuthCheck = await checkUserSession(new NextRequest("http://localhost:3000/api/auth/user"));
  const unconfirmedAuthCheckData = await unconfirmedAuthCheck.json();
  assert(unconfirmedAuthCheckData.user?.emailConfirmed === false, "/api/auth/user correctly exposes emailConfirmed: false");

  // Attempt to accept invitation with unconfirmed email
  const unconfirmedAcceptRes = await acceptInvitation(makeAcceptRequest(unconfirmedUserToken));
  const unconfirmedAcceptData = await unconfirmedAcceptRes.json();

  assert(unconfirmedAcceptRes.status === 403, "Unconfirmed email returns HTTP 403 Forbidden", `Status: ${unconfirmedAcceptRes.status}`);
  assert(unconfirmedAcceptData.success === false, "Response has success: false");
  assert(unconfirmedAcceptData.unconfirmedEmail === true, "Response explicitly flags unconfirmedEmail: true");
  assert(unconfirmedAcceptData.error.includes("not been confirmed"), "Actionable error directs user to confirm email");

  // Verify zero database mutations
  const unconfirmedInvState = invitationsStore.find((i) => i.id === "inv-unconfirmed-01");
  assert(unconfirmedInvState?.status === "pending", "Invitation status remains 'pending' on unconfirmed rejection");
  assert(unconfirmedInvState?.accepted_by === null, "Invitation was not claimed (accepted_by is null)");
  const unconfirmedMembership = membershipsStore.find((m) => m.user_id === unconfirmedUserId);
  assert(unconfirmedMembership === undefined, "Zero workspace membership created for unconfirmed account");

  // --- SCENARIO 5: Invitation Retry After Email Verification ---
  console.log("\n[Scenario 5] Invitation Retry After Email Verification");
  const verifiedUserSession: ServerSessionIdentity = {
    ...unconfirmedUserSession,
    emailConfirmed: true, // Now confirmed!
  };
  __setTestSessionOverride(verifiedUserSession);

  const retryAcceptRes = await acceptInvitation(makeAcceptRequest(unconfirmedUserToken));
  const retryAcceptData = await retryAcceptRes.json();

  assert(retryAcceptRes.status === 200, "Retry after email verification succeeds with HTTP 200 OK", `Status: ${retryAcceptRes.status}`);
  assert(retryAcceptData.success === true, "Acceptance confirmed successfully");
  assert(unconfirmedInvState?.status === "accepted", "Invitation status successfully transitioned to 'accepted'");
  assert(unconfirmedInvState?.accepted_by === unconfirmedUserId, `Invitation accepted_by set to verified user: ${unconfirmedUserId}`);

  const verifiedMembership = membershipsStore.find((m) => m.user_id === unconfirmedUserId);
  assert(verifiedMembership !== undefined, "Membership successfully created upon verified acceptance");
  assert(verifiedMembership?.role === "creator", "Membership created with assigned role: creator");

  // --- SCENARIO 6: Switch Account & Verified Recipient Acceptance ---
  console.log("\n[Scenario 6] Switch Account & Intended Recipient Acceptance");
  const correctUserSession: ServerSessionIdentity = {
    userId: intendedUserId,
    userName: "Saran",
    userEmail: intendedEmail,
    role: "compliance_reviewer",
    workspaceId,
    workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
    emailConfirmed: true,
  };
  __setTestSessionOverride(correctUserSession);

  const correctAcceptRes = await acceptInvitation(makeAcceptRequest(validRawToken));
  const correctAcceptData = await correctAcceptRes.json();

  assert(correctAcceptRes.status === 200, "Matching verified user accepts with HTTP 200 OK", `Status: ${correctAcceptRes.status}`);
  assert(correctAcceptData.success === true, "Response has success: true");
  assert(correctAcceptData.workspace.role === intendedRole, `Granted workspace role: ${correctAcceptData.workspace.role}`);

  const updatedInv = invitationsStore.find((i) => i.id === "inv-valid-01");
  assert(updatedInv?.status === "accepted", "Invitation status updated to 'accepted'");
  assert(updatedInv?.accepted_by === intendedUserId, `Invitation accepted_by set to intended user ID: ${intendedUserId}`);

  // --- SCENARIO 7: Administrator Role Preservation (No Downgrade) ---
  console.log("\n[Scenario 7] Administrator Role Preservation (No Downgrade on Lower-Role Invite)");
  // wrongUserSession has role: 'admin' and already exists in membershipsStore with role: 'admin'
  __setTestSessionOverride(wrongUserSession);

  // Admin accepts an invitation that offers a lower role ('creator')
  const adminPreserveRes = await acceptInvitation(makeAcceptRequest(adminPreserveRawToken));
  const adminPreserveData = await adminPreserveRes.json();

  assert(adminPreserveRes.status === 200, "Admin invitation acceptance succeeded with HTTP 200 OK");
  const adminMembershipAfter = membershipsStore.find((m) => m.user_id === wrongUserId);
  assert(adminMembershipAfter?.role === "admin", "Administrator role was strictly preserved (NOT downgraded to creator)", `Role: ${adminMembershipAfter?.role}`);

  // --- SCENARIO 8: Single-Use Token Protection (Replay Attack) ---
  console.log("\n[Scenario 8] Single-Use Token Invalidation");
  const replayRes = await acceptInvitation(makeAcceptRequest(validRawToken));
  const replayData = await replayRes.json();
  assert(replayRes.status === 400, "Replaying accepted token returns HTTP 400 Bad Request", `Status: ${replayRes.status}`);
  assert(replayData.error.includes("already been used"), "Error message warns token was already used");

  // --- SCENARIO 9: Expired Token Handling ---
  console.log("\n[Scenario 9] Expired Token Handling");
  const expiredRes = await acceptInvitation(makeAcceptRequest(expiredRawToken));
  const expiredData = await expiredRes.json();
  assert(expiredRes.status === 410, "Expired token returns HTTP 410 Gone", `Status: ${expiredRes.status}`);
  assert(expiredData.error.includes("expired"), "Error message confirms token is expired");

  // --- SCENARIO 10: Revoked Token Handling ---
  console.log("\n[Scenario 10] Revoked Token Handling");
  const revokedRes = await acceptInvitation(makeAcceptRequest(revokedRawToken));
  const revokedData = await revokedRes.json();
  assert(revokedRes.status === 400, "Revoked token returns HTTP 400 Bad Request", `Status: ${revokedRes.status}`);
  assert(revokedData.error.includes("revoked"), "Error message confirms token was revoked");

  // --- SCENARIO 11: Non-existent / Unknown Token ---
  console.log("\n[Scenario 11] Non-existent / Unknown Token");
  const invalidRes = await acceptInvitation(makeAcceptRequest("bs_inv_00000000000000000000000000000000"));
  const invalidData = await invalidRes.json();
  assert(invalidRes.status === 404, "Unknown token returns HTTP 404 Not Found", `Status: ${invalidRes.status}`);

  console.log("\n========================================================================");
  console.log(` RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSessionIsolationSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
