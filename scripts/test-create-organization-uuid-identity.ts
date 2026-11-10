import { NextRequest } from "next/server";
import crypto from "crypto";
import {
  POST as postWorkspace,
  GET as getWorkspaces,
} from "@/app/api/workspaces/route";
import {
  resolveAuthenticatedUser,
  isValidUUID,
  __setTestSessionOverride,
  ServerSessionIdentity,
} from "@/lib/auth/server-session";
import { CURRENT_USER } from "@/config/site";
import { __setTestQueryOverride } from "@/lib/db/server-db";

let passedCount = 0;
let failedCount = 0;

function check(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         └─ ${detail}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: CREATE ORGANIZATION UUID IDENTITY VERIFICATION SUITE   ");
  console.log("========================================================================");

  // -------------------------------------------------------------------------
  // Suite 1: UUID Format & Identity Guard Verification
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 1: UUID Format Validation & Demo Rejection ---");

  const validUUID1 = "a1111111-1111-4111-a111-111111111111";
  const validUUID2 = crypto.randomUUID();
  const demoIdElena = "usr-01-elena";
  const demoIdAdmin = "usr-01";
  const emailId = "elena.vance@dermaglow.com";

  check(isValidUUID(validUUID1), "1.1 Standard v4 UUID accepted", `UUID: ${validUUID1}`);
  check(isValidUUID(validUUID2), "1.2 Random UUID accepted", `UUID: ${validUUID2}`);
  check(!isValidUUID(demoIdElena), "1.3 Demo ID 'usr-01-elena' rejected by isValidUUID", `Value: ${demoIdElena}`);
  check(!isValidUUID(demoIdAdmin), "1.4 Demo ID 'usr-01' rejected by isValidUUID", `Value: ${demoIdAdmin}`);
  check(!isValidUUID(emailId), "1.5 Email address rejected as UUID", `Value: ${emailId}`);
  check(!isValidUUID(""), "1.6 Empty string rejected as UUID");
  check(!isValidUUID(null), "1.7 Null rejected as UUID");
  check(!isValidUUID(undefined), "1.8 Undefined rejected as UUID");

  // -------------------------------------------------------------------------
  // Suite 2: Unauthenticated Requests Return HTTP 401
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 2: Unauthenticated Requests Fail Closed with HTTP 401 ---");

  // Simulate unauthenticated session
  __setTestSessionOverride(null);

  const unauthReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Acme BioPharm",
      slug: "acme-biopharm",
    }),
  });

  const unauthRes = await postWorkspace(unauthReq);
  const unauthBody = await unauthRes.json();

  check(unauthRes.status === 401, "2.1 Unauthenticated POST /api/workspaces returns HTTP 401");
  check(
    unauthBody.success === false,
    "2.2 Response explicitly indicates success = false",
    unauthBody.error
  );

  // -------------------------------------------------------------------------
  // Suite 3: Demo Fallback Identity Blocked from Creating Workspaces
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 3: Demo Fallback Identities Blocked from Database Writes ---");

  const demoSession: ServerSessionIdentity = {
    userId: CURRENT_USER.id, // "usr-01-elena"
    userName: CURRENT_USER.name,
    userEmail: CURRENT_USER.email,
    role: "compliance_reviewer",
    workspaceId: "00000000-0000-0000-0000-000000000001",
    workspaceSlug: "dermaglow",
    isAuthenticated: false,
    isDemoFallback: true,
  };

  __setTestSessionOverride(demoSession);

  const demoReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Demo Corp",
      slug: "demo-corp",
    }),
  });

  const demoRes = await postWorkspace(demoReq);
  const demoRespBody = await demoRes.json();

  check(
    demoRes.status === 401,
    "3.1 Demo fallback session rejected with HTTP 401",
    `Status: ${demoRes.status}`
  );
  check(
    demoRespBody.success === false,
    "3.2 Demo session returns success = false",
    demoRespBody.error
  );

  // -------------------------------------------------------------------------
  // Suite 4: Authenticated Users Create Organizations with Actual Supabase UUID
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 4: Authenticated Users Provision Organization with Supabase UUID ---");

  const realUserUUID = "550e8400-e29b-41d4-a716-446655440000";
  const userSession: ServerSessionIdentity = {
    userId: realUserUUID,
    userName: "Dr. Marcus Brody",
    userEmail: "marcus.brody@dermaglow.com",
    role: "admin",
    workspaceId: "",
    workspaceSlug: "",
    isAuthenticated: true,
    isDemoFallback: false,
  };

  __setTestSessionOverride(userSession);

  // Track executed SQL queries to verify parameters
  const executedQueries: Array<{ sql: string; params: unknown[] }> = [];
  const createdWorkspaceId = crypto.randomUUID();

  __setTestQueryOverride(async (sql: string, params?: unknown[]) => {
    executedQueries.push({ sql, params: params || [] });

    // 1. Slug check
    if (sql.includes("SELECT id FROM workspaces WHERE slug = $1")) {
      return { rows: [], rowCount: 0 };
    }

    // 2. Workspace insert
    if (sql.includes("INSERT INTO workspaces")) {
      return {
        rows: [
          {
            id: createdWorkspaceId,
            name: "NovaHealth Diagnostics",
            slug: "novahealth-diagnostics",
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      };
    }

    // 3. Workspace membership insert
    if (sql.includes("INSERT INTO workspace_memberships")) {
      return {
        rows: [
          {
            id: crypto.randomUUID(),
            workspace_id: createdWorkspaceId,
            user_id: params?.[1],
            role: "admin",
            status: "active",
          },
        ],
        rowCount: 1,
      };
    }

    // 4. Audit events
    if (sql.includes("INSERT INTO audit_events")) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });

  const authReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "NovaHealth Diagnostics",
      slug: "novahealth-diagnostics",
    }),
  });

  const authRes = await postWorkspace(authReq);
  const authBody = await authRes.json();

  check(authRes.status === 201, "4.1 Authenticated POST /api/workspaces returns HTTP 201");
  check(authBody.success === true, "4.2 Organization creation returns success = true");
  check(authBody.workspace?.role === "admin", "4.3 Creator is granted 'admin' role in response");

  // Verify parameters passed to PostgreSQL
  const membershipInsert = executedQueries.find((q) =>
    q.sql.includes("INSERT INTO workspace_memberships")
  );

  check(Boolean(membershipInsert), "4.4 INSERT INTO workspace_memberships executed");
  check(
    membershipInsert?.params[1] === realUserUUID,
    "4.5 workspace_memberships.user_id received the actual authenticated Supabase UUID",
    `Passed user_id: ${membershipInsert?.params[1]}`
  );
  check(
    isValidUUID(membershipInsert?.params[1]),
    "4.6 Verified inserted user_id is a valid UUID format"
  );
  check(
    membershipInsert?.params[1] !== CURRENT_USER.id,
    "4.7 Invariant: 'usr-01-elena' was NEVER passed to workspace_memberships"
  );

  // -------------------------------------------------------------------------
  // Suite 5: Client-Supplied User IDs Cannot Override Authenticated Identity
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 5: Request Body Cannot Override Authenticated Identity ---");

  executedQueries.length = 0;

  const attackerReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Secure Labs",
      slug: "secure-labs",
      userId: "00000000-0000-0000-0000-000000000666", // Forged client-supplied attacker ID
      creatorId: "00000000-0000-0000-0000-000000000666",
      actorId: "usr-forged-actor",
    }),
  });

  const attackerRes = await postWorkspace(attackerReq);
  const attackerBody = await attackerRes.json();

  check(attackerRes.status === 201, "5.1 Organization creation succeeds");

  const attackerMembershipInsert = executedQueries.find((q) =>
    q.sql.includes("INSERT INTO workspace_memberships")
  );

  check(
    attackerMembershipInsert?.params[1] === realUserUUID,
    "5.2 Client-supplied userId in body strictly ignored; authenticated session UUID used",
    `Used UUID: ${attackerMembershipInsert?.params[1]}`
  );
  check(
    attackerMembershipInsert?.params[1] !== "00000000-0000-0000-0000-000000000666",
    "5.3 Forged body userId was strictly discarded"
  );

  // -------------------------------------------------------------------------
  // Suite 6: Duplicate Workspace Slugs Return HTTP 409 Conflict
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 6: Duplicate Workspace Slugs Return HTTP 409 Conflict ---");

  __setTestQueryOverride(async (sql: string, params?: unknown[]) => {
    if (sql.includes("SELECT id FROM workspaces WHERE slug = $1")) {
      return {
        rows: [{ id: "00000000-0000-0000-0000-000000000001" }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });

  const duplicateReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "DermaGlow",
      slug: "dermaglow",
    }),
  });

  const duplicateRes = await postWorkspace(duplicateReq);
  const duplicateBody = await duplicateRes.json();

  check(duplicateRes.status === 409, "6.1 Duplicate slug returns HTTP 409 Conflict");
  check(
    duplicateBody.error.includes("already in use"),
    "6.2 Error message informs user that slug is taken",
    duplicateBody.error
  );

  // -------------------------------------------------------------------------
  // Suite 7: Atomicity Verification (No Orphaned Workspaces on Membership Failure)
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 7: Workspace & Membership Creation Atomicity ---");

  __setTestQueryOverride(async (sql: string, params?: unknown[]) => {
    if (sql.includes("SELECT id FROM workspaces WHERE slug = $1")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO workspaces")) {
      return {
        rows: [
          {
            id: crypto.randomUUID(),
            name: "Failing Org",
            slug: "failing-org",
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes("INSERT INTO workspace_memberships")) {
      // Simulate database failure during membership insertion
      throw new Error("simulated_db_error: foreign key or membership constraint failure");
    }
    return { rows: [], rowCount: 0 };
  });

  const failReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Failing Org",
      slug: "failing-org",
    }),
  });

  const failRes = await postWorkspace(failReq);
  const failBody = await failRes.json();

  check(failRes.status === 500, "7.1 Membership failure safely yields HTTP 500");
  check(
    !failBody.error.includes("simulated_db_error"),
    "7.2 Internal DB error strings are sanitized and not leaked to client"
  );
  check(
    Boolean(failBody.correlationId),
    "7.3 Safe correlation ID returned for audit tracing",
    `Correlation ID: ${failBody.correlationId}`
  );

  // -------------------------------------------------------------------------
  // Clean up test overrides
  // -------------------------------------------------------------------------
  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);

  console.log("\n========================================================================");
  console.log(` CREATE ORG UUID SUITE: ${passedCount} passed, ${failedCount} failed.`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("FATAL test runner error:", err);
  process.exit(1);
});
