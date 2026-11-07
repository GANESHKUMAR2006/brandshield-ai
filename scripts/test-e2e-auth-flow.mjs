/**
 * End-to-end verification of Supabase Authentication in Production Mode
 * Tests:
 * 1. Health endpoint (200)
 * 2. Unauthenticated /api/dashboard/stats returns HTTP 401 (not 500)
 * 3. Unauthenticated /api/claims returns HTTP 401 (not 500)
 * 4. Unauthenticated /dashboard redirects to /login (307)
 * 5. POST /api/auth/login establishes session and returns cookies
 * 6. Authenticated /api/dashboard/stats returns HTTP 200 with stats
 * 7. Authenticated /api/claims returns HTTP 200 with live claims
 * 8. POST /api/auth/logout clears session
 */

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

async function runE2ETests() {
  console.log(`\n======================================================`);
  console.log(` BRANDSHIELD AI: PRODUCTION AUTHENTICATION E2E TEST`);
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

  // 1. Health check
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.status === 'ok', '1. /api/health returns HTTP 200 ok');
  } catch (err) {
    assert(false, `1. /api/health reachable: ${err.message}`);
  }

  // 2. Unauthenticated /api/dashboard/stats -> HTTP 401
  try {
    const statsRes = await fetch(`${BASE_URL}/api/dashboard/stats`);
    const statsJson = await statsRes.json();
    assert(statsRes.status === 401, `2. Unauthenticated /api/dashboard/stats returns HTTP 401 (received ${statsRes.status})`);
    assert(statsJson.success === false && statsJson.error === 'Authentication required', '   Error message accurately identifies "Authentication required"');
  } catch (err) {
    assert(false, `2. /api/dashboard/stats check failed: ${err.message}`);
  }

  // 3. Unauthenticated /api/claims -> HTTP 401
  try {
    const claimsRes = await fetch(`${BASE_URL}/api/claims`);
    const claimsJson = await claimsRes.json();
    assert(claimsRes.status === 401, `3. Unauthenticated /api/claims returns HTTP 401 (received ${claimsRes.status})`);
    assert(claimsJson.error === 'Authentication required', '   Error message accurately identifies "Authentication required"');
  } catch (err) {
    assert(false, `3. /api/claims check failed: ${err.message}`);
  }

  // 4. Unauthenticated UI navigation redirects to /login
  try {
    const pageRes = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    const isRedirect = pageRes.status === 307 || pageRes.status === 302;
    const location = pageRes.headers.get('location') || '';
    assert(isRedirect && location.includes('/login'), `4. Unauthenticated /dashboard redirects to /login (status ${pageRes.status}, location: ${location})`);
  } catch (err) {
    assert(false, `4. Protected route redirect check failed: ${err.message}`);
  }

  // 5. POST /api/auth/login with valid credentials
  let authCookie = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'elena.vance@dermaglow.com',
        password: 'BrandShield2026!',
      }),
    });
    const loginJson = await loginRes.json();
    assert(loginRes.status === 200, `5. POST /api/auth/login returns HTTP 200 (received ${loginRes.status})`);
    assert(loginJson.success === true && loginJson.user?.role === 'compliance_reviewer', '   Returned verified role "compliance_reviewer"');

    // Extract cookies from Set-Cookie headers
    const setCookieHeaders = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
    authCookie = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    assert(authCookie.length > 0, `   Captured session cookie for request forwarding (${authCookie.length} chars)`);
  } catch (err) {
    assert(false, `5. Login failed: ${err.message}`);
  }

  // 6. Authenticated /api/dashboard/stats -> HTTP 200
  try {
    const authStatsRes = await fetch(`${BASE_URL}/api/dashboard/stats`, {
      headers: { Cookie: authCookie },
    });
    const authStatsJson = await authStatsRes.json();
    assert(authStatsRes.status === 200, `6. Authenticated /api/dashboard/stats returns HTTP 200 (received ${authStatsRes.status})`);
    assert(authStatsJson.success === true && authStatsJson.workspace === 'dermaglow', '   Live database loaded for workspace "dermaglow"');
  } catch (err) {
    assert(false, `6. Authenticated stats check failed: ${err.message}`);
  }

  // 7. Authenticated /api/claims -> HTTP 200
  try {
    const authClaimsRes = await fetch(`${BASE_URL}/api/claims`, {
      headers: { Cookie: authCookie },
    });
    const authClaimsJson = await authClaimsRes.json();
    assert(authClaimsRes.status === 200, `7. Authenticated /api/claims returns HTTP 200 (received ${authClaimsRes.status})`);
    assert(Array.isArray(authClaimsJson.data), `   Retrieved ${authClaimsJson.data?.length || 0} verified claims from PostgreSQL`);
  } catch (err) {
    assert(false, `7. Authenticated claims check failed: ${err.message}`);
  }

  // 8. POST /api/auth/logout -> HTTP 200
  try {
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    const logoutJson = await logoutRes.json();
    assert(logoutRes.status === 200 && logoutJson.success === true, '8. POST /api/auth/logout terminates session cleanly');
  } catch (err) {
    assert(false, `8. Logout check failed: ${err.message}`);
  }

  console.log(`\n======================================================`);
  console.log(` TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
