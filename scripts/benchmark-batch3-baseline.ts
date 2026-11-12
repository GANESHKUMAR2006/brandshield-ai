/**
 * BrandShield AI — Batch 3 Performance Benchmark Runner
 * 
 * Measures:
 * 1. Settings page APIs & waterfall timings (Auth -> Workspace -> Members -> Invites -> Roles -> Join Code -> Join Requests)
 * 2. Reviews search keystroke simulation (un-debounced vs debounced)
 * 3. Policies search keystroke simulation (un-debounced vs debounced)
 */

export {};

const BASE_URL = "http://localhost:3000";

interface TimingResult {
  endpoint: string;
  durationMs: number;
  status: number;
  sizeBytes: number;
}

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

async function measure(url: string, cookie: string): Promise<TimingResult> {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { Cookie: cookie },
    cache: "no-store",
  });
  const data = await res.arrayBuffer();
  const durationMs = Math.round(performance.now() - start);
  return {
    endpoint: url,
    durationMs,
    status: res.status,
    sizeBytes: data.byteLength,
  };
}

async function runSettingsWaterfallBaseline(cookie: string, workspaceId: string) {
  console.log("\n==================================================");
  console.log("1. SETTINGS WATERFALL BENCHMARK (CURRENT / PRE-BATCH 3)");
  console.log("==================================================");

  // Current architecture:
  // Stage 1: /api/auth/me (resolves workspaceId)
  // Stage 2: /api/workspaces/:id (resolves workspace details)
  // Stage 3: [members, invites, roles] via Promise.all
  // Stage 4: [join-code, join-requests] sequentially awaited after Stage 3!

  const totalStart = performance.now();

  // Stage 1
  const tAuth = await measure("/api/auth/me", cookie);
  console.log(`Stage 1: /api/auth/me -> ${tAuth.durationMs} ms (status: ${tAuth.status})`);

  // Stage 2
  const tWs = await measure(`/api/workspaces/${workspaceId}`, cookie);
  console.log(`Stage 2: /api/workspaces/${workspaceId} -> ${tWs.durationMs} ms (status: ${tWs.status})`);

  // Stage 3 (Parallel group 1)
  const s3Start = performance.now();
  const [tMembers, tInvites, tRoles] = await Promise.all([
    measure(`/api/workspaces/${workspaceId}/members`, cookie),
    measure(`/api/workspaces/${workspaceId}/invitations`, cookie),
    measure(`/api/workspaces/${workspaceId}/roles`, cookie),
  ]);
  const s3Duration = Math.round(performance.now() - s3Start);
  console.log(`Stage 3 (Members + Invites + Roles) -> ${s3Duration} ms`);
  console.log(`  - Members: ${tMembers.durationMs} ms (${tMembers.sizeBytes} B)`);
  console.log(`  - Invites: ${tInvites.durationMs} ms (${tInvites.sizeBytes} B)`);
  console.log(`  - Roles:   ${tRoles.durationMs} ms (${tRoles.sizeBytes} B)`);

  // Stage 4 (Parallel group 2 awaited AFTER Stage 3)
  const s4Start = performance.now();
  const [tJoinCode, tJoinReqs] = await Promise.all([
    measure(`/api/workspaces/${workspaceId}/join-code`, cookie),
    measure(`/api/workspaces/${workspaceId}/join-requests`, cookie),
  ]);
  const s4Duration = Math.round(performance.now() - s4Start);
  console.log(`Stage 4 (Join Code + Join Requests) -> ${s4Duration} ms`);
  console.log(`  - Join Code:     ${tJoinCode.durationMs} ms (${tJoinCode.sizeBytes} B)`);
  console.log(`  - Join Requests: ${tJoinReqs.durationMs} ms (${tJoinReqs.sizeBytes} B)`);

  const currentWaterfallTotal = Math.round(performance.now() - totalStart);
  console.log(`\n>>> CURRENT 4-STAGE WATERFALL TOTAL: ${currentWaterfallTotal} ms`);

  // Optimized architecture simulation:
  // General Tab on Mount: Auth + Workspace in parallel
  const optGeneralStart = performance.now();
  const [optAuth, optWs] = await Promise.all([
    measure("/api/auth/me", cookie),
    measure(`/api/workspaces/${workspaceId}`, cookie),
  ]);
  const optGeneralTotal = Math.round(performance.now() - optGeneralStart);
  console.log(`\n>>> OPTIMIZED GENERAL TAB LOAD (Auth + Workspace parallel): ${optGeneralTotal} ms`);

  // Team Tab when navigated: All 5 team resources in parallel
  const optTeamStart = performance.now();
  const [optMembers, optInvites, optRoles, optJoinCode, optJoinReqs] = await Promise.all([
    measure(`/api/workspaces/${workspaceId}/members`, cookie),
    measure(`/api/workspaces/${workspaceId}/invitations`, cookie),
    measure(`/api/workspaces/${workspaceId}/roles`, cookie),
    measure(`/api/workspaces/${workspaceId}/join-code`, cookie),
    measure(`/api/workspaces/${workspaceId}/join-requests`, cookie),
  ]);
  const optTeamTotal = Math.round(performance.now() - optTeamStart);
  console.log(`>>> OPTIMIZED TEAM TAB LOAD (All 5 endpoints parallel): ${optTeamTotal} ms`);

  return {
    currentWaterfallTotal,
    optGeneralTotal,
    optTeamTotal,
    stage1Ms: tAuth.durationMs,
    stage2Ms: tWs.durationMs,
    stage3Ms: s3Duration,
    stage4Ms: s4Duration,
  };
}

async function runSearchSimulation(cookie: string) {
  console.log("\n==================================================");
  console.log("2. SEARCH KEYSTROKE SIMULATION BENCHMARK");
  console.log("==================================================");

  // Simulating typing "anti-aging" (10 characters) at 60 ms per keystroke
  const queryChars = "anti-aging".split("");

  // A) Without debounce: 10 requests dispatched
  console.log("\nA) Un-debounced typing (10 keystrokes = 10 requests):");
  const unDebouncedStart = performance.now();
  let unDebouncedDispatched = 0;
  const unDebouncedPromises: Promise<TimingResult>[] = [];
  let accum = "";
  for (const char of queryChars) {
    accum += char;
    unDebouncedDispatched++;
    unDebouncedPromises.push(measure(`/api/reviews?search=${encodeURIComponent(accum)}`, cookie));
    await new Promise((r) => setTimeout(r, 60));
  }
  const unDebouncedResults = await Promise.all(unDebouncedPromises);
  const unDebouncedDuration = Math.round(performance.now() - unDebouncedStart);
  console.log(`  - Dispatched requests: ${unDebouncedDispatched}`);
  console.log(`  - Total time to complete all 10 requests: ${unDebouncedDuration} ms`);
  console.log(`  - Individual request durations (ms):`, unDebouncedResults.map((r) => r.durationMs));

  // B) With 300ms debounce: only the final query is dispatched
  console.log("\nB) Debounced typing (300 ms debounce after last keystroke):");
  const debouncedStart = performance.now();
  let debouncedDispatched = 0;
  accum = "";
  // Simulate 10 keystrokes arriving at 60ms intervals (total 600ms typing)
  for (const char of queryChars) {
    accum += char;
    // timer reset on every keystroke
    await new Promise((r) => setTimeout(r, 60));
  }
  // User pauses, timer fires after 300 ms
  await new Promise((r) => setTimeout(r, 300));
  debouncedDispatched++;
  const debouncedResult = await measure(`/api/reviews?search=${encodeURIComponent(accum)}`, cookie);
  const debouncedTotalDuration = Math.round(performance.now() - debouncedStart);
  console.log(`  - Dispatched requests: ${debouncedDispatched} (90% reduction)`);
  console.log(`  - Server query duration: ${debouncedResult.durationMs} ms`);
  console.log(`  - Total time from typing start to final result: ${debouncedTotalDuration} ms`);

  // Policies search simulation
  console.log("\nC) Policies search keystroke simulation:");
  const policiesResUnDebounced: Promise<TimingResult>[] = [];
  accum = "";
  for (const char of "prohibited".split("")) {
    accum += char;
    policiesResUnDebounced.push(measure(`/api/policies?search=${encodeURIComponent(accum)}`, cookie));
    await new Promise((r) => setTimeout(r, 60));
  }
  const polUnDebounced = await Promise.all(policiesResUnDebounced);
  console.log(`  - Un-debounced Policies requests: ${polUnDebounced.length}`);

  // Debounced policies
  accum = "prohibited";
  const polDebounced = await measure(`/api/policies?search=${encodeURIComponent(accum)}`, cookie);
  console.log(`  - Debounced Policies requests: 1 (dispatched after 300ms idle)`);
  console.log(`  - Debounced Policies query duration: ${polDebounced.durationMs} ms`);
}

async function main() {
  const cookie = await login();
  console.log("Logged in successfully. Auth cookie obtained.");

  // Get current workspaceId from auth/me
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meData = await meRes.json();
  const workspaceId = meData.user.workspaceId;
  console.log(`Active Workspace: ${workspaceId} (${meData.user.workspaceSlug})`);

  await runSettingsWaterfallBaseline(cookie, workspaceId);
  await runSearchSimulation(cookie);
}

main().catch(console.error);
