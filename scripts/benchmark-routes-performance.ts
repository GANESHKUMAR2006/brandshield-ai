/**
 * BrandShield AI — Performance & Rendering Benchmark Runner
 * 
 * Measures real latency, payload sizes, and response status across:
 * - 9 UI routes (HTML TTFB)
 * - Key data & auth API endpoints (JSON latency & payload size)
 * - Sequential vs parallel loading impact
 */

import http from "http";

const BASE_URL = "http://localhost:3000";

interface BenchmarkResult {
  target: string;
  type: "page" | "api";
  durationMs: number;
  status: number;
  contentLength: number;
  error?: string;
}

const results: BenchmarkResult[] = [];

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
  const cookieHeader = cookies.map((c) => (c || "").split(";")[0]).filter(Boolean).join("; ");
  return cookieHeader;
}

async function measureRequest(path: string, type: "page" | "api", cookie?: string): Promise<BenchmarkResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        "User-Agent": "BrandShield-Benchmark-Runner",
      },
      cache: "no-store",
    });

    const buffer = await res.arrayBuffer();
    const durationMs = Math.round(performance.now() - start);

    return {
      target: path,
      type,
      durationMs,
      status: res.status,
      contentLength: buffer.byteLength,
    };
  } catch (err: any) {
    return {
      target: path,
      type,
      durationMs: Math.round(performance.now() - start),
      status: 0,
      contentLength: 0,
      error: err.message,
    };
  }
}

async function runBenchmark() {
  console.log("================================================================================");
  console.log(" BRANDSHIELD AI: REAL PERFORMANCE & RENDERING BENCHMARK                          ");
  console.log("================================================================================\n");

  console.log("1. Authenticating as Compliance Reviewer (Dr. Elena Vance)...");
  const cookie = await login();
  console.log(`   Session Cookie Acquired: ${cookie.substring(0, 30)}...\n`);

  const routes = [
    "/dashboard",
    "/products",
    "/submissions",
    "/claims",
    "/sources",
    "/reviews",
    "/policies",
    "/settings",
    "/join-organization",
  ];

  console.log("2. Measuring Page HTML Response Latencies (TTFB)...");
  for (const r of routes) {
    // Warm up / measure
    const res = await measureRequest(r, "page", cookie);
    results.push(res);
    console.log(`   ${r.padEnd(22)} | Status: ${res.status} | Time: ${res.durationMs}ms | Size: ${(res.contentLength / 1024).toFixed(1)} KB`);
  }

  const apis = [
    "/api/auth/me",
    "/api/auth/user",
    "/api/dashboard/stats",
    "/api/products",
    "/api/submissions",
    "/api/claims",
    "/api/sources",
    "/api/reviews",
    "/api/policies",
    "/api/workspaces",
    "/api/workspaces/join-requests/status",
  ];

  console.log("\n3. Measuring API Latency & Payload Sizes...");
  for (const a of apis) {
    const res = await measureRequest(a, "api", cookie);
    results.push(res);
    console.log(`   ${a.padEnd(38)} | Status: ${res.status} | Time: ${res.durationMs}ms | Size: ${(res.contentLength / 1024).toFixed(1)} KB`);
  }

  // Measure repeated/concurrent auth impact
  console.log("\n4. Simulating Concurrent Page Mount Overhead...");
  const concurrentAuthStart = performance.now();
  const concurrentRes = await Promise.all([
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }),
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }),
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } }),
  ]);
  const concurrentTime = Math.round(performance.now() - concurrentAuthStart);
  console.log(`   3x Concurrent /api/auth/me (Simulating TopNav + TourContext + Page): ${concurrentTime}ms`);

  // Measure Dashboard coupled loading
  console.log("\n5. Measuring Dashboard Data Loading Coupling...");
  const dashStatsStart = performance.now();
  await fetch(`${BASE_URL}/api/dashboard/stats`, { headers: { Cookie: cookie } });
  const dashStatsTime = Math.round(performance.now() - dashStatsStart);

  const sourcesStart = performance.now();
  await fetch(`${BASE_URL}/api/sources`, { headers: { Cookie: cookie } });
  const sourcesTime = Math.round(performance.now() - sourcesStart);

  const coupledStart = performance.now();
  await Promise.all([
    fetch(`${BASE_URL}/api/dashboard/stats`, { headers: { Cookie: cookie } }),
    fetch(`${BASE_URL}/api/sources`, { headers: { Cookie: cookie } }),
  ]);
  const coupledTime = Math.round(performance.now() - coupledStart);

  const decoupledStart = performance.now();
  await Promise.all([
    fetch(`${BASE_URL}/api/dashboard/stats`, { headers: { Cookie: cookie } }),
    fetch(`${BASE_URL}/api/products`, { headers: { Cookie: cookie } }),
  ]);
  const decoupledTime = Math.round(performance.now() - decoupledStart);

  console.log(`   /api/dashboard/stats standalone:   ${dashStatsTime}ms`);
  console.log(`   /api/sources standalone:           ${sourcesTime}ms`);
  console.log(`   Current Coupled (/api/sources):    ${coupledTime}ms`);
  console.log(`   Optimized (/api/products):         ${decoupledTime}ms (Saved: ${coupledTime - decoupledTime}ms)`);

  console.log("\n================================================================================");
  console.log(" RAW BENCHMARK DATA JSON:");
  console.log(JSON.stringify(results, null, 2));
}

runBenchmark().catch(console.error);

