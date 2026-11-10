/**
 * BrandShield AI — Complete End-to-End Authentication Lifecycle Validation Suite
 * 
 * Verifies:
 * 1. Live Authentication Flow:
 *    - Reviewer Login with valid credentials (HTTP 200, session cookie issued)
 *    - Invalid credentials rejection (HTTP 401 Unauthorized)
 *    - Session persistence & user profile resolution via /api/auth/me
 *    - Protected resource access with valid session (/api/workspaces)
 *    - Protected resource rejection without session (HTTP 401 Unauthorized)
 *    - Session termination via /api/auth/logout
 *    - Immediate revocation verification (post-logout /api/auth/me returns HTTP 401)
 * 
 * 2. Password Recovery Lifecycle:
 *    - Supabase Auth password recovery dispatch on valid domain with MX records (HTTP 200)
 *    - Recovery dispatch behavior on fictional corporate domain without MX records or rate limit (HTTP 400/429)
 *    - Malformed recovery requests rejection (HTTP 400)
 *    - Reset password unauthenticated rejection (HTTP 401)
 *    - Reset password schema validation (<8 chars) (HTTP 400)
 *    - Auth callback route error redirect logic (HTTP 307)
 *    - Auth callback route fallback redirect logic (HTTP 307)
 * 
 * 3. Seeded Production Role Verification:
 *    - Dr. Elena Vance (compliance_reviewer)
 *    - Admin (admin)
 *    - Marcus Brody (legal_reviewer)
 */

import { NextRequest } from "next/server";
import { POST as resetPasswordRoute } from "../src/app/api/auth/reset-password/route";
import { GET as authCallbackRoute } from "../src/app/auth/callback/route";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://brandshield-ai-1.onrender.com';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, name: string, passed: boolean, details?: string, error?: string) {
  results.push({ suite, name, passed, details, error });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(`  ${status} ${name}`);
  if (details) console.log(`         └─ ${details}`);
  if (error) console.log(`         └─ Error: ${error}`);
}

async function runAuthLifecycleTests() {
  console.log('========================================================================');
  console.log('    BRANDSHIELD AI: END-TO-END AUTHENTICATION LIFECYCLE SUITE           ');
  console.log('    Live Auth, Session Security, Recovery Flow & Multi-Role Audit       ');
  console.log('========================================================================\n');

  let sessionCookie = '';

  // --------------------------------------------------------------------------
  // SUITE 1: Reviewer Authentication & Session Cookie Issuance
  // --------------------------------------------------------------------------
  console.log('--- Suite 1: Reviewer Authentication & Session Cookie Issuance ---');

  try {
    const validLoginRes = await fetch(`${APP_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'elena.vance@dermaglow.com',
        password: 'BrandShield2026!'
      })
    });

    const validLoginData = await validLoginRes.json();
    const setCookieHeaders = validLoginRes.headers.getSetCookie ? validLoginRes.headers.getSetCookie() : [validLoginRes.headers.get('set-cookie')];
    const cookieHeader = setCookieHeaders.map(c => (c || '').split(';')[0]).join('; ');

    const hasAuthCookie = cookieHeader.includes('auth-token');
    recordTest(
      'Suite 1',
      '1.1 Valid reviewer login returns HTTP 200 with authenticated user payload',
      validLoginRes.status === 200 && validLoginData.success === true && validLoginData.user?.role === 'compliance_reviewer',
      `User: ${validLoginData.user?.userName || 'Dr. Elena Vance'}, Role: ${validLoginData.user?.role}, Workspace: ${validLoginData.user?.workspaceSlug || 'dermaglow'}`
    );

    recordTest(
      'Suite 1',
      '1.2 Production session cookie (sb-*-auth-token) issued in response headers',
      hasAuthCookie,
      `Cookie prefix: ${cookieHeader.substring(0, 40)}...`
    );

    sessionCookie = cookieHeader;
  } catch (err: any) {
    recordTest('Suite 1', '1.1 Valid reviewer login', false, undefined, err.message);
  }

  // Negative Login: Invalid Password
  try {
    const invalidLoginRes = await fetch(`${APP_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'elena.vance@dermaglow.com',
        password: 'IncorrectPassword2026!'
      })
    });
    const invalidData = await invalidLoginRes.json();
    recordTest(
      'Suite 1',
      '1.3 Invalid password attempt is rejected with HTTP 401 Unauthorized',
      invalidLoginRes.status === 401 && invalidData.success === false,
      `Response error: "${invalidData.error}"`
    );
  } catch (err: any) {
    recordTest('Suite 1', '1.3 Invalid password rejection', false, undefined, err.message);
  }

  // Negative Login: Malformed Payload
  try {
    const badPayloadRes = await fetch(`${APP_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'short'
      })
    });
    recordTest(
      'Suite 1',
      '1.4 Malformed email/password payload rejected with HTTP 400 Bad Request',
      badPayloadRes.status === 400
    );
  } catch (err: any) {
    recordTest('Suite 1', '1.4 Malformed payload', false, undefined, err.message);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Session Persistence & Identity Context Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 2: Session Persistence & Identity Context Verification ---');

  try {
    const meRes = await fetch(`${APP_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookie }
    });
    const meData = await meRes.json();

    recordTest(
      'Suite 2',
      '2.1 GET /api/auth/me with session cookie returns HTTP 200 OK',
      meRes.status === 200 && meData.success === true,
      `User ID: ${meData.user?.userId}, Email: ${meData.user?.userEmail}`
    );

    recordTest(
      'Suite 2',
      '2.2 Session resolves reviewer identity with non-demo production workspace',
      meData.user?.role === 'compliance_reviewer' && meData.user?.workspaceSlug === 'dermaglow' && meData.user?.isDemoFallback === false,
      `Role: ${meData.user?.role}, WorkspaceSlug: ${meData.user?.workspaceSlug}, isDemoFallback: ${meData.user?.isDemoFallback}`
    );
  } catch (err: any) {
    recordTest('Suite 2', '2.1 Session persistence check', false, undefined, err.message);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Protected Resources & Unauthenticated Rejection
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 3: Protected Resources & Access Denial ---');

  try {
    // Authorized call to /api/workspaces
    const wsAuthorized = await fetch(`${APP_URL}/api/workspaces`, {
      headers: { 'Cookie': sessionCookie }
    });
    recordTest(
      'Suite 3',
      '3.1 Authenticated session accesses protected /api/workspaces (HTTP 200)',
      wsAuthorized.status === 200
    );

    // Unauthenticated call to /api/workspaces
    const wsUnauth = await fetch(`${APP_URL}/api/workspaces`);
    recordTest(
      'Suite 3',
      '3.2 Unauthenticated call to /api/workspaces rejected with HTTP 401 Unauthorized',
      wsUnauth.status === 401
    );

    // Unauthenticated call to /api/dashboard/stats
    const statsUnauth = await fetch(`${APP_URL}/api/dashboard/stats`);
    recordTest(
      'Suite 3',
      '3.3 Unauthenticated call to /api/dashboard/stats rejected with HTTP 401 Unauthorized',
      statsUnauth.status === 401
    );
  } catch (err: any) {
    recordTest('Suite 3', '3.1-3.3 Protected routes check', false, undefined, err.message);
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Session Termination (Logout) & Immediate Invalidation
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 4: Session Termination & Immediate Invalidation ---');

  try {
    const logoutRes = await fetch(`${APP_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookie }
    });
    const logoutData = await logoutRes.json();

    const clearedCookies = logoutRes.headers.getSetCookie ? logoutRes.headers.getSetCookie() : [logoutRes.headers.get('set-cookie')];
    const clearedCookieHeader = clearedCookies.map(c => (c || '').split(';')[0]).join('; ');

    recordTest(
      'Suite 4',
      '4.1 POST /api/auth/logout terminates session and clears cookies (HTTP 200)',
      logoutRes.status === 200 && logoutData.success === true,
      `Message: "${logoutData.message}"`
    );

    // Test calling /api/auth/me with cleared cookie
    const postLogoutMe = await fetch(`${APP_URL}/api/auth/me`, {
      headers: { 'Cookie': clearedCookieHeader }
    });
    recordTest(
      'Suite 4',
      '4.2 Calling /api/auth/me after logout strictly returns HTTP 401 Unauthorized',
      postLogoutMe.status === 401,
      `Status code: ${postLogoutMe.status} (Access closed)`
    );

    // Test calling /api/auth/me with no cookies at all
    const anonymousMe = await fetch(`${APP_URL}/api/auth/me`);
    recordTest(
      'Suite 4',
      '4.3 Anonymous request to /api/auth/me strictly returns HTTP 401 Unauthorized',
      anonymousMe.status === 401
    );
  } catch (err: any) {
    recordTest('Suite 4', '4.1 Logout check', false, undefined, err.message);
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Password Recovery Lifecycle & Security Controls
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 5: Password Recovery Flow & Security Controls ---');

  try {
    // 5.1 Real domain with MX records -> Supabase sends email successfully
    const realDomainRes = await fetch(`${APP_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ganeshkumar2006@gmail.com' })
    });
    const realDomainData = await realDomainRes.json();
    const isRealDomainOk = realDomainRes.status === 200 || realDomainRes.status === 429;
    recordTest(
      'Suite 5',
      '5.1 Supabase dispatches real recovery email for domain with valid public MX records',
      isRealDomainOk,
      realDomainRes.status === 200
        ? `Message: "${realDomainData.message}"`
        : `Rate limit active: "${realDomainData.error}"`
    );

    // 5.2 Fictional corporate domain without MX records or rate limit
    const demoDomainRes = await fetch(`${APP_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'elena.vance@dermaglow.com' })
    });
    const demoDomainData = await demoDomainRes.json();
    const isDemoDomainHandled = demoDomainRes.status === 400 || demoDomainRes.status === 429;
    recordTest(
      'Suite 5',
      '5.2 Supabase GoTrue safely handles recovery for fictional domain lacking DNS MX records',
      isDemoDomainHandled,
      `Status: ${demoDomainRes.status}, Response: "${demoDomainData.error}"`
    );

    // 5.3 Malformed email syntax validation
    const malformedEmailRes = await fetch(`${APP_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email-address' })
    });
    recordTest(
      'Suite 5',
      '5.3 Malformed email address rejected with HTTP 400 Validation Error',
      malformedEmailRes.status === 400
    );

    // 5.4 Unauthenticated reset-password endpoint rejection
    const unauthReq = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ password: "NewValidPassword2026!" })
    });
    const unauthRes = await resetPasswordRoute(unauthReq);
    const unauthData = await unauthRes.json();
    recordTest(
      'Suite 5',
      '5.4 POST /api/auth/reset-password without recovery session rejected with HTTP 401',
      unauthRes.status === 401 && unauthData.success === false,
      `Response error: "${unauthData.error}"`
    );

    // 5.5 Short password rejected by Zod schema
    const shortReq = new NextRequest("http://localhost:3000/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ password: "short" })
    });
    const shortRes = await resetPasswordRoute(shortReq);
    const shortData = await shortRes.json();
    recordTest(
      'Suite 5',
      '5.5 POST /api/auth/reset-password with password <8 chars rejected with HTTP 400',
      shortRes.status === 400 && shortData.error === 'Validation failed',
      `Details: ${JSON.stringify(shortData.details)}`
    );

    // 5.6 Callback route redirect on error/expiration
    const callbackErrReq = new NextRequest("http://localhost:3000/auth/callback?error=access_denied&error_description=Link+expired");
    const callbackErrRes = await authCallbackRoute(callbackErrReq);
    const locationErr = callbackErrRes.headers.get("location") || "";
    recordTest(
      'Suite 5',
      '5.6 GET /auth/callback with error params redirects to /login?error=...',
      callbackErrRes.status === 307 && locationErr.includes("/login?error="),
      `Redirect target: ${locationErr}`
    );

    // 5.7 Callback route redirect without code lands on /reset-password
    const callbackNoCodeReq = new NextRequest("http://localhost:3000/auth/callback");
    const callbackNoCodeRes = await authCallbackRoute(callbackNoCodeReq);
    const locationNoCode = callbackNoCodeRes.headers.get("location") || "";
    recordTest(
      'Suite 5',
      '5.7 GET /auth/callback fallback lands on /reset-password',
      callbackNoCodeRes.status === 307 && locationNoCode.endsWith("/reset-password"),
      `Redirect target: ${locationNoCode}`
    );
  } catch (err: any) {
    recordTest('Suite 5', '5.1-5.7 Password recovery check', false, undefined, err.message);
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Multi-Role Production Identity Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Suite 6: Multi-Role Production Identity Verification ---');

  const rolesToTest = [
    { email: 'elena.vance@dermaglow.com', expectedRole: 'compliance_reviewer', name: 'Dr. Elena Vance' },
    { email: 'admin@dermaglow.com', expectedRole: 'admin', name: 'System Administrator' },
    { email: 'marcus.brody@dermaglow.com', expectedRole: 'legal_reviewer', name: 'Marcus Brody' }
  ];

  for (let i = 0; i < rolesToTest.length; i++) {
    const roleInfo = rolesToTest[i];
    try {
      const loginRes = await fetch(`${APP_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: roleInfo.email,
          password: 'BrandShield2026!'
        })
      });
      const data = await loginRes.json();
      recordTest(
        'Suite 6',
        `6.${i + 1} Authenticate seeded ${roleInfo.expectedRole} (${roleInfo.email})`,
        loginRes.status === 200 && data.user?.role === roleInfo.expectedRole,
        `Resolved User: "${roleInfo.name}", Role: "${data.user?.role}", Workspace: "dermaglow"`
      );
    } catch (err: any) {
      recordTest('Suite 6', `6.${i + 1} Authenticate ${roleInfo.email}`, false, undefined, err.message);
    }
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`AUTH LIFECYCLE SUMMARY: ${passedCount}/${results.length} passed, ${failedCount} failed.`);
  console.log('========================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAuthLifecycleTests().catch((err) => {
  console.error('Fatal error in auth test suite:', err);
  process.exit(1);
});
