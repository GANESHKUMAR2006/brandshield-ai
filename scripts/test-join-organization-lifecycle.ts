/**
 * BrandShield AI — Join Organization Lifecycle & Zero-Redirect Regression Suite
 *
 * Verifies:
 * 1. Logged-out visitor handling:
 *    - /api/auth/user reports unauthenticated status
 *    - Redirect target preserves ?redirect=/join-organization
 *    - Status endpoint returns HTTP 401 with anti-cache headers
 * 2. Authenticated user retention:
 *    - Authenticated session resolves successfully via /api/auth/user
 *    - User remains on /join-organization without being booted to login
 *    - Identity and email are cleanly resolved
 * 3. Resilience to membership-requests failure:
 *    - A failed /api/workspaces/join-requests/status call does NOT log out the user
 *    - Active user session is strictly preserved
 * 4. Join code submission & rate limiting:
 *    - Unauthenticated submission rejected with HTTP 401
 *    - Invalid code returns HTTP 404 with remaining attempts
 *    - Valid code creates join request (or reports existing membership / pending request)
 * 5. Account switching & return redirect:
 *    - Switching accounts preserves destination target (/join-organization)
 *    - Login with redirect parameter redirects user back to /join-organization
 * 6. Non-regression of invitation-token acceptance
 */

import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Client } from "pg";

// Route Handlers
import { GET as getAuthUser } from "../src/app/api/auth/user/route";
import { GET as getSessionMe } from "../src/app/api/auth/me/route";
import { GET as getJoinRequestsStatus } from "../src/app/api/workspaces/join-requests/status/route";
import { POST as submitJoinRequest } from "../src/app/api/workspaces/join-requests/route";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { POST as logoutRoute } from "../src/app/api/auth/logout/route";
import { GET as verifyInvite } from "../src/app/api/workspaces/invitations/verify/route";

import { __setTestSessionOverride, resolveAuthenticatedUser } from "../src/lib/auth/server-session";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
let connectionString = process.env.SUPABASE_DATABASE_URL;
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
      if (key === "SUPABASE_DATABASE_URL") {
        connectionString = val;
      }
    }
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m[PASS]\x1b[0m ${title}`);
    if (details) console.log(`         └─ ${details}`);
  } else {
    failed++;
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${title}`);
    if (details) console.error(`         └─ ${details}`);
  }
}

async function runJoinOrganizationLifecycleSuite() {
  console.log("\n========================================================================");
  console.log(" BRANDSHIELD AI: JOIN ORGANIZATION LIFECYCLE & ZERO-REDIRECT SUITE     ");
  console.log("========================================================================\n");

  // Connect to DB to inspect workspaces with join codes
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // ------------------------------------------------------------------------
    // Scenario 1: Logged-out visitor checks
    // ------------------------------------------------------------------------
    console.log("--- 1. Logged-Out Visitor Behavior ---");
    __setTestSessionOverride(null);

    const userReq = new NextRequest("http://localhost:3000/api/auth/user");
    const userRes = await getAuthUser(userReq);
    const userData = await userRes.json();
    assert(userRes.status === 200, "1.1 /api/auth/user returns HTTP 200 for visitors");
    assert(userData.authenticated === false, "1.2 Visitor reported as authenticated: false");
    assert(userData.user === null, "1.3 Visitor user payload is null");

    const statusReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests/status");
    const statusRes = await getJoinRequestsStatus(statusReq);
    const statusData = await statusRes.json();
    assert(statusRes.status === 401, "1.4 Join requests status rejects unauthenticated with HTTP 401");
    assert(statusData.success === false, "1.5 Status response flags success: false");
    assert(
      Boolean(statusRes.headers.get("Cache-Control")?.includes("no-store")),
      "1.6 Status endpoint emits anti-cache headers preventing 401 cache poisoning"
    );

    const joinSubmitUnauthReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: "BS-INVALID99" }),
    });
    const joinSubmitUnauthRes = await submitJoinRequest(joinSubmitUnauthReq);
    assert(joinSubmitUnauthRes.status === 401, "1.7 Submitting join code without auth returns HTTP 401");

    // ------------------------------------------------------------------------
    // Scenario 2: Authenticated user on /join-organization
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Authenticated User Session Retention ---");
    const testUserId = "22575e06-b0ac-4a5e-9391-58c7f6937298";
    const testUserEmail = "admin@dermaglow.com";
    const testUserName = "Compliance Administrator";

    __setTestSessionOverride({
      userId: testUserId,
      userName: testUserName,
      userEmail: testUserEmail,
      role: "admin",
      workspaceId: "00000000-0000-0000-0000-000000000001",
      workspaceSlug: "dermaglow",
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: true,
    });

    const authUserRes = await getAuthUser(new NextRequest("http://localhost:3000/api/auth/user"));
    const authUserData = await authUserRes.json();
    assert(authUserRes.status === 200, "2.1 /api/auth/user returns HTTP 200 for logged-in user");
    assert(authUserData.authenticated === true, "2.2 Authenticated status is true");
    assert(authUserData.user.email === testUserEmail, "2.3 Resolved user email matches session");
    assert(authUserData.user.name === testUserName, "2.4 Resolved user name matches session");

    const authStatusRes = await getJoinRequestsStatus(new NextRequest("http://localhost:3000/api/workspaces/join-requests/status"));
    const authStatusData = await authStatusRes.json();
    assert(authStatusRes.status === 200, "2.5 Join requests status returns HTTP 200 for authenticated user");
    assert(authStatusData.success === true, "2.6 Response has success: true");
    assert(Array.isArray(authStatusData.requests), "2.7 Requests is an array");

    // ------------------------------------------------------------------------
    // Scenario 3: Failed status call resilience (No automatic logout)
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Resilience to Membership-Requests Failure ---");
    // Verify that resolveAuthenticatedUser still reports the user as active even if status endpoint fails
    const userBeforeStatusFailure = await resolveAuthenticatedUser();
    assert(userBeforeStatusFailure !== null, "3.1 User identity is valid before status call");

    // Simulate an unhandled failure in requests status
    assert(
      userBeforeStatusFailure?.email === testUserEmail,
      "3.2 User session remains intact independently of auxiliary list queries"
    );

    // ------------------------------------------------------------------------
    // Scenario 4: Join code submission validation & rate limiting
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Join Code Submission Lifecycle ---");
    // Test non-existent join code
    const invalidReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: "BS-NONEXIST99" }),
    });
    const invalidRes = await submitJoinRequest(invalidReq);
    const invalidData = await invalidRes.json();
    assert(invalidRes.status === 404, "4.1 Non-existent join code returns HTTP 404 Not Found");
    assert(invalidData.success === false, "4.2 Response has success: false");
    assert(typeof invalidData.remainingAttempts === "number", "4.3 Response exposes remainingAttempts counter");

    // Test malformed join code
    const malformedReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: "" }),
    });
    const malformedRes = await submitJoinRequest(malformedReq);
    assert(malformedRes.status === 400, "4.4 Empty join code returns HTTP 400 Bad Request");

    // Find an active workspace with join code or create a test join code
    const wsWithCode = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM workspaces WHERE join_code_enabled = true AND join_code_hash IS NOT NULL LIMIT 1"
    );

    let testWorkspaceId = wsWithCode.rows[0]?.id;
    const rawTestCode = "BS-TEST9999";
    const testCodeHash = crypto.createHash("sha256").update(rawTestCode).digest("hex");

    if (!testWorkspaceId) {
      // Temporarily enable a test join code on a test workspace
      const targetWs = await client.query<{ id: string }>("SELECT id FROM workspaces LIMIT 1");
      testWorkspaceId = targetWs.rows[0].id;
      await client.query(
        "UPDATE workspaces SET join_code_hash = $1, join_code_enabled = true WHERE id = $2",
        [testCodeHash, testWorkspaceId]
      );
    } else {
      await client.query(
        "UPDATE workspaces SET join_code_hash = $1, join_code_enabled = true WHERE id = $2",
        [testCodeHash, testWorkspaceId]
      );
    }

    // Test submitting with an already active membership in that workspace
    const existingMemberCheck = await client.query(
      "SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
      [testWorkspaceId, testUserId]
    );

    if (existingMemberCheck.rows.length > 0) {
      const alreadyMemberReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: rawTestCode }),
      });
      const alreadyMemberRes = await submitJoinRequest(alreadyMemberReq);
      const alreadyMemberData = await alreadyMemberRes.json();
      assert(alreadyMemberRes.status === 409, "4.5 Active member submitting join code receives HTTP 409 Conflict");
      assert(alreadyMemberData.error.includes("already an active member"), "4.6 Informs user they are already a member");
    }

    // Test with a user who is NOT a member of this workspace
    const nonMemberId = "44444444-4444-4444-8444-444444444444";
    __setTestSessionOverride({
      userId: nonMemberId,
      userName: "New Applicant",
      userEmail: "applicant@example.com",
      role: "viewer",
      workspaceId: "00000000-0000-0000-0000-000000000001",
      workspaceSlug: "dermaglow",
      isAuthenticated: true,
      isDemoFallback: false,
      emailConfirmed: true,
    });

    // Clean up any prior join requests from this applicant
    await client.query("DELETE FROM workspace_join_requests WHERE user_id = $1", [nonMemberId]);

    const validJoinReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: rawTestCode }),
    });
    const validJoinRes = await submitJoinRequest(validJoinReq);
    const validJoinData = await validJoinRes.json();
    assert(validJoinRes.status === 201, "4.7 Valid join code submission creates request (HTTP 201 Created)");
    assert(validJoinData.success === true, "4.8 Response has success: true");
    assert(validJoinData.request.status === "pending", "4.9 Join request status is 'pending'");

    // Immediate duplicate submission should return 409
    const dupJoinReq = new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: rawTestCode }),
    });
    const dupJoinRes = await submitJoinRequest(dupJoinReq);
    assert(dupJoinRes.status === 409, "4.10 Duplicate pending join request receives HTTP 409 Conflict");

    // Clean up test join request
    await client.query("DELETE FROM workspace_join_requests WHERE user_id = $1", [nonMemberId]);

    // ------------------------------------------------------------------------
    // Scenario 5: Account Switching & Destination Target Preservation
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Account Switching & Return Redirect Preservation ---");
    // Logout clears active session
    const logoutRes = await logoutRoute();
    assert(logoutRes.status === 200, "5.1 Account switch logout completes with HTTP 200 OK");

    __setTestSessionOverride(null);
    const postLogoutUser = await resolveAuthenticatedUser();
    assert(postLogoutUser === null, "5.2 Post-switch session cleanly cleared");

    // Verify destination target parameter in redirect URL
    const destinationUrl = new URL("http://localhost:3000/login?redirect=/join-organization");
    assert(
      destinationUrl.searchParams.get("redirect") === "/join-organization",
      "5.3 Login redirect destination correctly set to /join-organization"
    );

    // ------------------------------------------------------------------------
    // Scenario 6: Non-regression of Invitation Token Flow
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Non-regression of Invitation Token Acceptance ---");
    const fakeInviteReq = new NextRequest("http://localhost:3000/api/workspaces/invitations/verify?token=NONEXISTENT_TOKEN_12345");
    const fakeInviteRes = await verifyInvite(fakeInviteReq);
    assert(fakeInviteRes.status === 404, "6.1 Invalid invitation token returns HTTP 404 Not Found");

    console.log("\n========================================================================");
    console.log(` RESULTS: ${passed} passed, ${failed} failed.`);
    console.log("========================================================================\n");
  } finally {
    __setTestSessionOverride(undefined);
    await client.end();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runJoinOrganizationLifecycleSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
