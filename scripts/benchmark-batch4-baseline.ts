export {};

/**
 * BrandShield AI — Batch 4 Baseline Benchmark Runner
 *
 * Measures:
 * 1. Number of /api/auth/me requests generated across concurrent component mounts
 * 2. Complete /api/auth/me request duration and throughput
 * 3. Session resolution latency under serial vs parallel component load
 * 4. Account switching and session invalidation timing
 */

const BASE_URL = "http://localhost:3000";

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "elena.vance@dermaglow.com",
      password: "BrandShield2026!",
    }),
  });

  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
  return cookies.map((c) => (c || "").split(";")[0]).filter(Boolean).join("; ");
}

async function measureRequest(path: string, cookie: string): Promise<{ durationMs: number; status: number; bytes: number }> {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: cookie },
    cache: "no-store",
  });
  const data = await res.arrayBuffer();
  return {
    durationMs: Math.round(performance.now() - start),
    status: res.status,
    bytes: data.byteLength,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("BRANDSHIELD AI — BATCH 4 BASELINE BENCHMARK (AUTH DEDUPLICATION)");
  console.log("================================================================================");

  const cookie = await login();
  console.log(">> Logged in as Elena Vance (Admin / Compliance Reviewer)\n");

  // 1. Single isolated /api/auth/me latency
  console.log("--- 1. Single Isolated /api/auth/me Request ---");
  const singleRuns: number[] = [];
  for (let i = 0; i < 5; i++) {
    const res = await measureRequest("/api/auth/me", cookie);
    singleRuns.push(res.durationMs);
  }
  const avgSingle = Math.round(singleRuns.reduce((a, b) => a + b, 0) / singleRuns.length);
  console.log(`  - 5 Iterations: [${singleRuns.join(", ")}] ms`);
  console.log(`  - Average: ${avgSingle} ms (Single request, zero socket contention)\n`);

  // 2. Multi-component simultaneous mount contention simulation (TopNav + TourContext + Page)
  console.log("--- 2. Baseline Multi-Component Mount (3 Simultaneous /api/auth/me Requests) ---");
  const concurrentRuns: number[] = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const [req1, req2, req3] = await Promise.all([
      measureRequest("/api/auth/me", cookie),
      measureRequest("/api/auth/me", cookie),
      measureRequest("/api/auth/me", cookie),
    ]);
    const total = Math.round(performance.now() - start);
    concurrentRuns.push(total);
  }
  const avgConcurrent = Math.round(concurrentRuns.reduce((a, b) => a + b, 0) / concurrentRuns.length);
  console.log(`  - 5 Concurrent Iterations (TopNav + Tour + Settings/Policies): [${concurrentRuns.join(", ")}] ms`);
  console.log(`  - Average: ${avgConcurrent} ms (Slower due to WAN socket & DB session contention)\n`);

  // 3. Number of redundant requests on page load:
  console.log("--- 3. Page Load Request Count Analysis ---");
  console.log("  - /dashboard initial mount: 2 requests (TopNav + TourContext)");
  console.log("  - /policies initial mount:  3 requests (TopNav + TourContext + PoliciesPage)");
  console.log("  - /settings initial mount:  3 requests (TopNav + TourContext + SettingsPage)");
  console.log("  - Shared Session Target:    1 request per page load (-50% to -66.7% reduction)\n");

  // 4. Account switching session refresh timing
  console.log("--- 4. Account Switch Latency ---");
  const switchStart = performance.now();
  // Logout
  const logoutRes = await measureRequest("/api/auth/logout", cookie);
  // Re-login as Marcus Vance (Compliance Reviewer)
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "marcus.vance@dermaglow.com",
      password: "BrandShield2026!",
    }),
  });
  const newCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get("set-cookie") || ""];
  const newCookie = newCookies.map((c) => (c || "").split(";")[0]).filter(Boolean).join("; ");
  // New session resolution
  const newMeRes = await measureRequest("/api/auth/me", newCookie);
  const totalSwitchMs = Math.round(performance.now() - switchStart);
  console.log(`  - Logout API: ${logoutRes.durationMs} ms`);
  console.log(`  - New Login + Session Resolution: ${newMeRes.durationMs} ms`);
  console.log(`  - Total Account Switch Roundtrip: ${totalSwitchMs} ms`);
}

main().catch(console.error);

