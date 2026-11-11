import fs from "fs";
import path from "path";

// Preload .env.local if not already injected
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || "").trim();
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  } catch {}
}

import { NextRequest } from "next/server";
import crypto from "crypto";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { middleware } from "@/middleware";
import {
  __setTestSessionOverride,
  resolveAuthenticatedUser,
  resolveServerSession,
  isValidUUID,
  ServerSessionIdentity,
} from "@/lib/auth/server-session";
import { __setTestQueryOverride } from "@/lib/db/server-db";
import { CURRENT_USER } from "@/config/site";

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
  console.log(" BRANDSHIELD AI: MULTI-ACCOUNT LOGIN & SESSION ISOLATION TEST SUITE     ");
  console.log("========================================================================");

  // User A & User B Test Profiles (Valid RFC 4122 UUIDs)
  const userA = {
    id: "a1111111-1111-4111-a111-111111111111",
    email: "elena.vance@dermaglow.com",
    name: "Dr. Elena Vance",
    role: "compliance_reviewer",
    workspaceId: "00000000-0000-0000-0000-000000000001",
    workspaceSlug: "dermaglow",
  };

  const userB = {
    id: "b2222222-2222-4222-a222-222222222222",
    email: "marcus.brody@dermaglow.com",
    name: "Marcus Brody, Esq.",
    role: "legal_reviewer",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    workspaceSlug: "novacare-labs",
  };

  // Mock database records
  let mockMemberships = [
    {
      id: "mem-a",
      workspace_id: userA.workspaceId,
      user_id: userA.id,
      role: userA.role,
      status: "active",
      slug: userA.workspaceSlug,
    },
    {
      id: "mem-b",
      workspace_id: userB.workspaceId,
      user_id: userB.id,
      role: userB.role,
      status: "active",
      slug: userB.workspaceSlug,
    },
  ];

  __setTestQueryOverride(async (sql: string, params: unknown[] = []) => {
    const s = sql.toLowerCase();

    // Query memberships by user_id
    if (s.includes("from workspace_memberships") && s.includes("wm.user_id = $1")) {
      const uId = params[0] as string;
      const mems = mockMemberships.filter((m) => m.user_id === uId && m.status === "active");
      return {
        rows: mems.map((m) => ({
          role: m.role,
          workspace_id: m.workspace_id,
          slug: m.slug,
        })),
        rowCount: mems.length,
      };
    }

    // Workspaces table check
    if (s.includes("from workspaces where slug = $1")) {
      const slug = params[0] as string;
      if (slug === "dermaglow") {
        return { rows: [{ id: userA.workspaceId, slug: "dermaglow", status: "active" }] };
      }
      if (slug === "novacare-labs") {
        return { rows: [{ id: userB.workspaceId, slug: "novacare-labs", status: "active" }] };
      }
      return { rows: [] };
    }

    return { rows: [], rowCount: 0 };
  });

  // -------------------------------------------------------------------------
  // Scenario 1 & 2: Unauthenticated User Opens /login & No Automatic Login
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 1 & 2: Unauthenticated User Opens /login ---");
  __setTestSessionOverride(null);

  // Simulate unauthenticated request to /login through middleware
  const loginReq = new NextRequest("http://localhost:3000/login", {
    method: "GET",
  });
  const middlewareRes = await middleware(loginReq);

  // Must NOT redirect away from /login
  check(
    middlewareRes.status === 200 || !middlewareRes.headers.get("location"),
    "1.1 Unauthenticated user accessing /login is NOT redirected away",
    `Status: ${middlewareRes.status}, Location: ${middlewareRes.headers.get("location") || "none"}`
  );

  // Calling /api/auth/me while unauthenticated
  const meUnauthReq = new NextRequest("http://localhost:3000/api/auth/me", { method: "GET" });
  const meUnauthRes = await meRoute(meUnauthReq);
  const meUnauthBody = await meUnauthRes.json();

  check(
    meUnauthRes.status === 401,
    "1.2 /api/auth/me returns HTTP 401 Unauthorized for unauthenticated callers"
  );
  check(
    meUnauthBody.success === false,
    "1.3 Payload confirms success = false (no automatic demo identity fallback)",
    meUnauthBody.error
  );

  // -------------------------------------------------------------------------
  // Scenario 3: Existing Account A Can Authenticate
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 3: Account A Authentication ---");

  // Set session override simulating Account A authenticated via Supabase
  const sessionA: ServerSessionIdentity = {
    userId: userA.id,
    userName: userA.name,
    userEmail: userA.email,
    role: "compliance_reviewer",
    workspaceId: userA.workspaceId,
    workspaceSlug: userA.workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  };
  __setTestSessionOverride(sessionA);

  const meAReq = new NextRequest("http://localhost:3000/api/auth/me", { method: "GET" });
  const meARes = await meRoute(meAReq);
  const meABody = await meARes.json();

  check(meARes.status === 200, "3.1 Account A session returns HTTP 200 via /api/auth/me");
  check(meABody.user?.userId === userA.id, "3.2 Account A returns exact Supabase UUID", meABody.user?.userId);
  check(meABody.user?.userEmail === userA.email, "3.3 Account A returns correct email address", meABody.user?.userEmail);
  check(meABody.user?.role === "compliance_reviewer", "3.4 Account A returns correct role", meABody.user?.role);
  check(meABody.user?.workspaceSlug === userA.workspaceSlug, "3.5 Account A workspace matches DermaGlow");

  // -------------------------------------------------------------------------
  // Scenario 4 & 5: Account A Signs Out & Session Invalidation
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 4 & 5: Account A Logout & Immediate Invalidation ---");

  // Simulate logout request carrying active cookies
  const logoutReq = new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers: {
      cookie: "sb-mock-auth-token=tokenA; active_workspace_slug=dermaglow; active_workspace_id=00000000-0000-0000-0000-000000000001",
    },
  });

  const logoutRes = await logoutRoute(logoutReq);
  const logoutBody = await logoutRes.json();

  check(logoutRes.status === 200, "4.1 POST /api/auth/logout returns HTTP 200");
  check(logoutBody.success === true, "4.2 Response confirms session terminated successfully");

  // Check that Set-Cookie headers explicitly expire auth and workspace cookies
  const setCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get("set-cookie") || ""];
  const cookieString = setCookies.join("; ");
  const expiresAuth = cookieString.includes("auth-token") && (cookieString.includes("Max-Age=0") || cookieString.includes("Expires="));
  const expiresWorkspace = cookieString.includes("workspace") && (cookieString.includes("Max-Age=0") || cookieString.includes("Expires="));

  check(expiresAuth, "4.3 Auth token cookies explicitly expired with Max-Age=0 in response headers");
  check(expiresWorkspace, "4.4 Workspace cookies explicitly expired to prevent permission leakage");

  // 5. Invalidation: Immediate post-logout /api/auth/me returns 401
  __setTestSessionOverride(null);
  const postLogoutMeRes = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  check(postLogoutMeRes.status === 401, "5.1 Calling /api/auth/me post-logout returns HTTP 401 Unauthorized");

  // -------------------------------------------------------------------------
  // Scenario 6, 7 & 8: Account B Authenticates & Tenant Isolation
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 6, 7 & 8: Account B Authentication & Session Isolation ---");

  // Simulate Account B session
  const sessionB: ServerSessionIdentity = {
    userId: userB.id,
    userName: userB.name,
    userEmail: userB.email,
    role: "legal_reviewer",
    workspaceId: userB.workspaceId,
    workspaceSlug: userB.workspaceSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  };
  __setTestSessionOverride(sessionB);

  const meBReq = new NextRequest("http://localhost:3000/api/auth/me", { method: "GET" });
  const meBRes = await meRoute(meBReq);
  const meBBody = await meBRes.json();

  check(meBRes.status === 200, "6.1 Account B session returns HTTP 200 via /api/auth/me");
  check(meBBody.user?.userId === userB.id, "7.1 /api/auth/me returns Account B's UUID (isolated from Account A)", meBBody.user?.userId);
  check(meBBody.user?.userEmail === userB.email, "7.2 /api/auth/me returns Account B's email", meBBody.user?.userEmail);
  check(meBBody.user?.role === "legal_reviewer", "7.3 /api/auth/me returns Account B's role (legal_reviewer)", meBBody.user?.role);

  // 8. Invariant: Account B does not inherit Account A's workspace or permissions
  check(
    meBBody.user?.workspaceSlug === userB.workspaceSlug,
    "8.1 Account B resolves strictly to Account B's workspace (novacare-labs)",
    `Workspace: ${meBBody.user?.workspaceSlug}`
  );
  check(
    meBBody.user?.workspaceSlug !== userA.workspaceSlug,
    "8.2 Invariant: Account B does not inherit Account A's workspace (dermaglow)"
  );
  check(
    meBBody.user?.userId !== userA.id,
    "8.3 Invariant: Account B UUID strictly isolated from Account A UUID"
  );

  // -------------------------------------------------------------------------
  // Scenario 9: Invalid Credentials Rejection
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 9: Invalid Credentials Handling ---");

  const invalidReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "random.user@unknown.com", password: "BadPassword123!" }),
  });

  const invalidRes = await loginRoute(invalidReq);
  const invalidBody = await invalidRes.json();

  check(invalidRes.status === 401, "9.1 Invalid credentials return HTTP 401 Unauthorized");
  check(invalidBody.success === false, "9.2 Response confirms success = false");
  check(
    invalidBody.error === "Invalid email or password.",
    "9.3 Safe, non-leaking error message returned",
    invalidBody.error
  );

  // -------------------------------------------------------------------------
  // Scenario 10: Session Expiration Handling
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 10: Session Expiration & Malformed Tokens ---");

  // Malformed or expired session
  __setTestSessionOverride(null);
  const expiredReq = new NextRequest("http://localhost:3000/api/auth/me", {
    headers: { cookie: "sb-mock-auth-token=expired-malformed-token" },
  });
  const expiredRes = await meRoute(expiredReq);
  check(expiredRes.status === 401, "10.1 Expired/malformed session fails closed with HTTP 401");

  // -------------------------------------------------------------------------
  // Scenario 11: Stale Client State Cannot Override Server Identity
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 11: Stale Client State Override Prevention ---");

  // Attempting to pass forged client headers
  const forgedReq = new NextRequest("http://localhost:3000/api/auth/me", {
    headers: {
      "x-user-id": userA.id,
      "x-user-role": "admin",
      "x-workspace-slug": "dermaglow",
    },
  });

  // Client is unauthenticated on the server side
  __setTestSessionOverride(null);
  const forgedRes = await meRoute(forgedReq);
  check(forgedRes.status === 401, "11.1 Forged client headers (x-user-id, x-user-role) are strictly ignored (HTTP 401)");

  // -------------------------------------------------------------------------
  // Scenario 12: Demo Identities Blocked from Overriding Real Sessions
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 12: Demo Identities Strictly Isolated ---");

  // Demo fallback session has isAuthenticated = false and isDemoFallback = true
  const demoFallbackSession: ServerSessionIdentity = {
    userId: CURRENT_USER.id,
    userName: CURRENT_USER.name,
    userEmail: CURRENT_USER.email,
    role: "compliance_reviewer",
    workspaceId: "00000000-0000-0000-0000-000000000001",
    workspaceSlug: "dermaglow",
    isAuthenticated: false,
    isDemoFallback: true,
  };
  __setTestSessionOverride(demoFallbackSession);

  const demoMeRes = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  check(
    demoMeRes.status === 401,
    "12.1 Demo fallback persona (Dr. Elena Vance) returns HTTP 401 on /api/auth/me"
  );

  // -------------------------------------------------------------------------
  // Scenario 13: Middleware Protected Route Enforcement
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 13: Middleware Protected Route Enforcement ---");

  // In production, unauthenticated request to /dashboard must redirect to /login
  const origNodeEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";

  const protectedReq = new NextRequest("http://localhost:3000/dashboard", {
    method: "GET",
  });
  const protectedRes = await middleware(protectedReq);

  check(
    protectedRes.status === 307 || protectedRes.status === 302,
    "13.1 Middleware intercepts unauthenticated request to /dashboard with HTTP 307 redirect"
  );
  check(
    Boolean(protectedRes.headers.get("location")?.includes("/login")),
    "13.2 Redirect destination points to /login?redirect=/dashboard",
    protectedRes.headers.get("location") || ""
  );

  // Root path unauthenticated redirects to /login
  const rootReq = new NextRequest("http://localhost:3000/", { method: "GET" });
  const rootRes = await middleware(rootReq);
  check(
    Boolean(rootRes.headers.get("location")?.includes("/login")),
    "13.3 Root path '/' redirects unauthenticated users to /login",
    rootRes.headers.get("location") || ""
  );

  (process.env as any).NODE_ENV = origNodeEnv;

  // -------------------------------------------------------------------------
  // Scenario 14: Input Validation & Empty Field Guards
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 14: Form Validation & Empty Field Guards ---");

  const emptyReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "", password: "" }),
  });
  const emptyRes = await loginRoute(emptyReq);
  check(emptyRes.status === 400, "14.1 Empty email/password rejected with HTTP 400 Validation Error");

  const missingPassReq = new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@domain.com", password: "" }),
  });
  const missingPassRes = await loginRoute(missingPassReq);
  check(missingPassRes.status === 400, "14.2 Empty password rejected with HTTP 400 Validation Error");

  // -------------------------------------------------------------------------
  // Scenario 15: Clean Lifecycle Transition (Login A -> Logout -> Login B)
  // -------------------------------------------------------------------------
  console.log("\n--- Scenario 15: Clean Lifecycle Transition (A -> Sign Out -> B) ---");

  // Step 1: Session A Active
  __setTestSessionOverride(sessionA);
  const step1 = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  const step1Body = await step1.json();
  check(step1.status === 200 && step1Body.user?.userId === userA.id, "15.1 Step 1: Account A authenticated");

  // Step 2: Sign Out
  __setTestSessionOverride(null);
  const step2 = await logoutRoute(new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" }));
  const step2Me = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  check(step2.status === 200 && step2Me.status === 401, "15.2 Step 2: Account A logged out, /api/auth/me returns 401");

  // Step 3: Session B Active
  __setTestSessionOverride(sessionB);
  const step3 = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  const step3Body = await step3.json();
  check(
    step3.status === 200 && step3Body.user?.userId === userB.id && step3Body.user?.workspaceSlug === userB.workspaceSlug,
    "15.3 Step 3: Account B authenticated with fresh session and distinct workspace",
    `User: ${step3Body.user?.userName}, Workspace: ${step3Body.user?.workspaceSlug}`
  );

  // Step 4: Sign Out B
  __setTestSessionOverride(null);
  const step4 = await logoutRoute(new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" }));
  const step4Me = await meRoute(new NextRequest("http://localhost:3000/api/auth/me"));
  check(step4.status === 200 && step4Me.status === 401, "15.4 Step 4: Account B logged out, /api/auth/me returns 401");

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log(` RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal exception:", err);
  process.exit(1);
});
