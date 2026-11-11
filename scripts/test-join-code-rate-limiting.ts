/**
 * BrandShield AI — Distributed Shared-Storage Rate Limiting Test Suite
 * 
 * Verifies:
 * 1. 5-failed-attempt threshold enforcement on POST /api/workspaces/join-requests.
 * 2. HTTP 429 response with Retry-After header.
 * 3. Per-IP rate-limit enforcement.
 * 4. Per-Authenticated-User rate-limit enforcement.
 * 5. Concurrent requests serialization (atomic database operations prevent bypass).
 * 6. Window expiry and counter reset.
 * 7. Persistence across simulated instance restarts / independent connections.
 * 8. Legitimate successful requests and duplicate-request protections continue working.
 */

import { Client } from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as submitJoinRequest } from "../src/app/api/workspaces/join-requests/route";
import { DistributedRateLimiter } from "../src/lib/rate-limit/distributed-rate-limiter";
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

async function runRateLimitingSuite() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: DISTRIBUTED JOIN-CODE RATE LIMITING TEST SUITE         ");
  console.log(" Multi-Tenant Shared Storage Rate Limiter (PostgreSQL Engine)           ");
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

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  process.env.QA_EMAIL_CAPTURE = "true";
  (process.env as any).NODE_ENV = "test";
  EmailService.clearCapturedEmails();

  const runId = Date.now().toString(36);
  const testWorkspace = {
    id: crypto.randomUUID(),
    name: `RateLimit Workspace ${runId}`,
    slug: `ratelimit-ws-${runId}`,
  };

  const validRawJoinCode = `BS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const validJoinCodeHash = crypto.createHash("sha256").update(validRawJoinCode).digest("hex");

  const userA = {
    id: crypto.randomUUID(),
    email: `ratelimit.user.a.${runId}@example-qa.com`,
    name: "RateLimit User A",
  };

  const userB = {
    id: crypto.randomUUID(),
    email: `ratelimit.user.b.${runId}@example-qa.com`,
    name: "RateLimit User B",
  };

  const ipAlpha = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  const ipBeta = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;

  function createRequest(joinCode: string, ip: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/workspaces/join-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ joinCode }),
    });
  }

  try {
    console.log("--- 1. Setup Test Workspace with Real Join Code ---");
    await client.query(
      `INSERT INTO workspaces (id, name, slug, join_code_hash, join_code_enabled)
       VALUES ($1, $2, $3, $4, true)`,
      [testWorkspace.id, testWorkspace.name, testWorkspace.slug, validJoinCodeHash]
    );
    assert(true, "1.1 Workspace created with active hashed join code");

    // Clean any prior rate-limit buckets for these test keys
    await DistributedRateLimiter.reset(`join_code:ip:${ipAlpha}`);
    await DistributedRateLimiter.reset(`join_code:ip:${ipBeta}`);
    await DistributedRateLimiter.reset(`join_code:user:${userA.id}`);
    await DistributedRateLimiter.reset(`join_code:user:${userB.id}`);

    // --- 2. Threshold Enforcement (5 Failed Attempts) ---
    console.log("\n--- 2. Threshold Enforcement (Max 5 Failed Attempts) ---");
    const sessionA: ServerSessionIdentity = {
      userId: userA.id,
      userName: userA.name,
      userEmail: userA.email,
      role: "viewer",
      workspaceId: testWorkspace.id,
      workspaceSlug: testWorkspace.slug,
      isAuthenticated: true,
      isDemoFallback: false,
    };
    __setTestSessionOverride(sessionA);

    // Attempts 1 to 4 should return 404 (invalid code)
    for (let i = 1; i <= 4; i++) {
      const res = await submitJoinRequest(createRequest("BS-INVALID99", ipAlpha));
      const data = await res.json();
      assert(res.status === 404, `2.${i} Attempt ${i}/5 fails with HTTP 404 Not Found`, `Remaining: ${data.remainingAttempts}`);
      assert(data.remainingAttempts === 5 - i, `2.${i}b Correct remaining attempts count exposed: ${5 - i}`);
    }

    // Attempt 5 should cross threshold -> HTTP 429 Too Many Requests
    const res5 = await submitJoinRequest(createRequest("BS-INVALID99", ipAlpha));
    const data5 = await res5.json();
    assert(res5.status === 429, "2.5 Attempt 5/5 triggers rate limit (HTTP 429 Too Many Requests)", `Status: ${res5.status}`);
    assert(data5.rateLimited === true, "2.6 Response explicitly flags rateLimited: true");
    const retryAfterHeader = res5.headers.get("Retry-After");
    assert(Boolean(retryAfterHeader && Number(retryAfterHeader) > 0), "2.7 Response contains valid Retry-After header", `Retry-After: ${retryAfterHeader}s`);

    // Attempt 6: Pre-check gate blocks upfront before querying join codes
    const res6 = await submitJoinRequest(createRequest("BS-INVALID99", ipAlpha));
    assert(res6.status === 429, "2.8 Attempt 6 blocked upfront by pre-check checkLimit (HTTP 429)");

    // --- 3. Per-IP Multi-User Enforcement ---
    console.log("\n--- 3. Per-IP Multi-User Enforcement ---");
    // Switch to User B on the SAME IP (ipAlpha)
    const sessionB: ServerSessionIdentity = {
      userId: userB.id,
      userName: userB.name,
      userEmail: userB.email,
      role: "viewer",
      workspaceId: testWorkspace.id,
      workspaceSlug: testWorkspace.slug,
      isAuthenticated: true,
      isDemoFallback: false,
    };
    __setTestSessionOverride(sessionB);

    const resUserBOnBlockedIp = await submitJoinRequest(createRequest("BS-INVALID99", ipAlpha));
    assert(
      resUserBOnBlockedIp.status === 429,
      "3.1 User B on blocked IP (ipAlpha) is blocked by IP-level shared rate limit (HTTP 429)",
      `Status: ${resUserBOnBlockedIp.status}`
    );

    // --- 4. Per-User Multi-IP Enforcement ---
    console.log("\n--- 4. Per-User Multi-IP Enforcement ---");
    // Switch back to User A (who reached 5 attempts) but from a DIFFERENT clean IP (ipBeta)
    __setTestSessionOverride(sessionA);

    const resUserAOnCleanIp = await submitJoinRequest(createRequest("BS-INVALID99", ipBeta));
    const dataUserAOnCleanIp = await resUserAOnCleanIp.json();
    assert(
      resUserAOnCleanIp.status === 429,
      "4.1 User A connecting from clean IP (ipBeta) is still blocked by User-level rate limit (HTTP 429)",
      `Status: ${resUserAOnCleanIp.status}`
    );
    assert(dataUserAOnCleanIp.error.includes("on your account"), "4.2 Error message specifies user account limit exceeded");

    // Clean user on clean IP is NOT blocked
    __setTestSessionOverride(sessionB);
    const resUserBOnCleanIp = await submitJoinRequest(createRequest("BS-INVALID99", ipBeta));
    assert(
      resUserBOnCleanIp.status === 404,
      "4.3 Unrelated User B from clean IP (ipBeta) is allowed through (HTTP 404, not rate-limited)",
      `Status: ${resUserBOnCleanIp.status}`
    );

    // --- 5. Atomic Serialization & Concurrent Attempt Safety ---
    console.log("\n--- 5. Atomic Serialization & Concurrency Safety ---");
    const concurrentIp = `198.51.100.99`;
    await DistributedRateLimiter.reset(`join_code:ip:${concurrentIp}`);

    // Fire 10 concurrent requests at the exact same millisecond
    const concurrentUser = { id: crypto.randomUUID(), email: `concurrent.${runId}@example-qa.com`, name: "Concurrent User" };
    __setTestSessionOverride({
      userId: concurrentUser.id,
      userName: concurrentUser.name,
      userEmail: concurrentUser.email,
      role: "viewer",
      workspaceId: testWorkspace.id,
      workspaceSlug: testWorkspace.slug,
      isAuthenticated: true,
      isDemoFallback: false,
    });

    const requests = Array.from({ length: 8 }, () => submitJoinRequest(createRequest("BS-CONCURRENT", concurrentIp)));
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    const count404 = statuses.filter((s) => s === 404).length;
    const count429 = statuses.filter((s) => s === 429).length;

    assert(count404 === 4, `5.1 Exactly 4 initial attempts allowed before threshold (Received: ${count404})`);
    assert(count429 === 4, `5.2 Exactly 4 concurrent requests throttled with HTTP 429 (Received: ${count429})`);

    // Verify row count in PostgreSQL
    const bucketRow = await client.query(`SELECT count FROM rate_limit_buckets WHERE key = $1`, [`join_code:ip:${concurrentIp}`]);
    assert(Number(bucketRow.rows[0].count) >= 5, "5.3 Database verification: Rate limit counter atomically serialized in PostgreSQL");

    // --- 6. Window Expiry & Counter Reset ---
    console.log("\n--- 6. Window Expiry & Counter Reset ---");
    const expiryKey = `join_code:ip:198.51.100.77`;
    // Set an expired bucket (reset_at in the past)
    await client.query(
      `INSERT INTO rate_limit_buckets (key, count, first_attempt, reset_at, updated_at)
       VALUES ($1, 5, now() - interval '20 minutes', now() - interval '5 minutes', now() - interval '5 minutes')
       ON CONFLICT (key) DO UPDATE SET count = 5, reset_at = now() - interval '5 minutes'`,
      [expiryKey]
    );

    // Next attempt should reset count to 1 and be allowed
    const recordAfterExpiry = await DistributedRateLimiter.recordAttempt(expiryKey, 900, 5);
    assert(recordAfterExpiry.count === 1, "6.1 Expired rate limit window reset counter back to 1", `Count: ${recordAfterExpiry.count}`);
    assert(recordAfterExpiry.allowed === true, "6.2 Request allowed after window expiry");

    // --- 7. Persistence Across Simulated Instances ---
    console.log("\n--- 7. Persistence Across Instances (PostgreSQL Shared State) ---");
    // Connect an entirely new client connection simulating a different Render instance
    const clientInstance2 = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await clientInstance2.connect();

    const persistenceCheck = await clientInstance2.query(
      `SELECT count FROM rate_limit_buckets WHERE key = $1`,
      [`join_code:ip:${ipAlpha}`]
    );
    assert(
      persistenceCheck.rows.length === 1 && Number(persistenceCheck.rows[0].count) >= 5,
      "7.1 Second application instance reads the exact same rate limit bucket from PostgreSQL",
      `Count on Instance 2: ${persistenceCheck.rows[0]?.count}`
    );
    await clientInstance2.end();

    // --- 8. Legitimate Requests & Duplicate Protections Continue Working ---
    console.log("\n--- 8. Legitimate Requests & Duplicate Protections Working ---");
    const legitUser = { id: crypto.randomUUID(), email: `legit.${runId}@example-qa.com`, name: "Legitimate User" };
    const legitIp = `198.51.100.55`;
    __setTestSessionOverride({
      userId: legitUser.id,
      userName: legitUser.name,
      userEmail: legitUser.email,
      role: "viewer",
      workspaceId: testWorkspace.id,
      workspaceSlug: testWorkspace.slug,
      isAuthenticated: true,
      isDemoFallback: false,
    });

    // Valid join code submission
    const resLegit = await submitJoinRequest(createRequest(validRawJoinCode, legitIp));
    assert(resLegit.status === 201, "8.1 Legitimate join code succeeds with HTTP 201 Created", `Status: ${resLegit.status}`);

    // Verify rate limit bucket was NOT incremented on success
    const legitBucketCheck = await client.query(`SELECT count FROM rate_limit_buckets WHERE key = $1`, [`join_code:ip:${legitIp}`]);
    assert(legitBucketCheck.rows.length === 0, "8.2 Successful join code submission does not consume rate limit points");

    // Second submission by same user should be blocked by duplicate protection (HTTP 409)
    const resDuplicate = await submitJoinRequest(createRequest(validRawJoinCode, legitIp));
    assert(resDuplicate.status === 409, "8.3 Duplicate pending request blocked with HTTP 409 Conflict", `Status: ${resDuplicate.status}`);

    // Clean up
    console.log("\n--- 9. Cleaning up test entities ---");
    await client.query(`DELETE FROM workspace_join_requests WHERE workspace_id = $1`, [testWorkspace.id]);
    await client.query(`DELETE FROM rate_limit_buckets WHERE key LIKE 'join_code:%'`);
    await client.query(`UPDATE workspaces SET status = 'archived' WHERE id = $1`, [testWorkspace.id]);
    assert(true, "9.1 Disposable rate limit test entities cleaned up");

  } finally {
    await client.end();
  }

  console.log("\n========================================================================");
  console.log(` RATE LIMITING TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log("========================================================================\n");

  if (failed > 0) process.exit(1);
}

runRateLimitingSuite().catch((err) => {
  console.error("Fatal error during rate limiting suite execution:", err);
  process.exit(1);
});

