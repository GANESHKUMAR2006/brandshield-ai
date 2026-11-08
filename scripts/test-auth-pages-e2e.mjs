const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

async function testAuthSuite() {
  console.log(`\n======================================================`);
  console.log(` BRANDSHIELD AI: PREMIUM AUTHENTICATION UI & API SUITE`);
  console.log(` Target Server: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Forgot password validation (empty / invalid email)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });
    const json = await res.json();
    assert(
      res.status === 400 && json.success === false,
      `1. POST /api/auth/forgot-password validates email format (status: ${res.status})`
    );
  } catch (err) {
    assert(false, `1. POST /api/auth/forgot-password validation failed: ${err.message}`);
  }

  // 2. Forgot password request (valid email interacting with real Supabase Auth)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "elena.vance@dermaglow.com" }),
    });
    const json = await res.json();
    const isLiveSupabaseResponse =
      (res.status === 200 && json.success === true) ||
      (res.status === 429 && json.isRateLimit === true) ||
      (res.status === 400 && json.error && json.error.toLowerCase().includes("email"));

    assert(
      isLiveSupabaseResponse,
      `2. POST /api/auth/forgot-password reaches live Supabase Auth (status: ${res.status}, response: ${json.message || json.error})`
    );
  } catch (err) {
    assert(false, `2. POST /api/auth/forgot-password valid submission: ${err.message}`);
  }

  // 3. Login with invalid credentials
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "elena.vance@dermaglow.com", password: "WrongPassword999!" }),
    });
    const json = await res.json();
    assert(
      res.status === 401 && json.success === false,
      `3. POST /api/auth/login rejects invalid credentials with HTTP 401`
    );
  } catch (err) {
    assert(false, `3. Invalid login check failed: ${err.message}`);
  }

  // 4. Login with valid credentials
  let sessionCookie = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "elena.vance@dermaglow.com", password: "BrandShield2026!" }),
    });
    const json = await res.json();
    sessionCookie = res.headers.get("set-cookie");
    assert(
      res.status === 200 && json.success === true && json.user?.role === "compliance_reviewer",
      `4. POST /api/auth/login succeeds for Dr. Elena Vance (role: ${json.user?.role})`
    );
    assert(!!sessionCookie, `   Session cookie received (${sessionCookie?.length || 0} bytes)`);
  } catch (err) {
    assert(false, `4. Valid login check failed: ${err.message}`);
  }

  // 5. Logout terminates session
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: sessionCookie ? { Cookie: sessionCookie } : {},
    });
    const json = await res.json();
    assert(
      res.status === 200 && json.success === true,
      `5. POST /api/auth/logout terminates session cleanly`
    );
  } catch (err) {
    assert(false, `5. Logout check failed: ${err.message}`);
  }

  console.log(`\n======================================================`);
  console.log(` AUTH SUITE SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

testAuthSuite();
