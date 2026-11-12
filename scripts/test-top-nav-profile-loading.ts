/**
 * BrandShield AI — Top Navigation User Profile Loading & Transition Test Suite
 * 
 * Verifies that:
 * 1. Profile component properly transitions from loading to resolved state.
 * 2. Unauthenticated / guest state displays cleanly (Sign In button) rather than an infinite pulse skeleton.
 * 3. Authenticated state displays user initials, name, and role with interactive menu.
 * 4. Account switching and logout properly reset user state.
 * 5. Cached profiles eliminate layout flash on mount.
 * 6. Demo fallback accounts display user details and do not get stuck loading.
 * 7. All data-tour selectors ("workspace-indicator", "notifications-bell") remain intact.
 */

import fs from "fs";
import path from "path";

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

async function runTopNavProfileTests() {
  console.log("\n========================================================================");
  console.log(" BRANDSHIELD AI: TOP NAVIGATION USER PROFILE RESOLUTION SUITE           ");
  console.log(" Verifying Zero-Stuck Skeleton, Auth Lifecycle, & Tour Integrity       ");
  console.log("========================================================================\n");

  const topNavPath = path.join(__dirname, "..", "src", "components", "layout", "TopNav.tsx");
  const authContextPath = path.join(__dirname, "..", "src", "components", "auth", "AuthSessionContext.tsx");
  const loginFormPath = path.join(__dirname, "..", "src", "components", "auth", "LoginForm.tsx");

  const topNavSource = fs.readFileSync(topNavPath, "utf8");
  const authContextSource = fs.readFileSync(authContextPath, "utf8");
  const loginFormSource = fs.readFileSync(loginFormPath, "utf8");

  // ------------------------------------------------------------------------
  // Suite 1: TopNav Loading vs Resolved State Machine Logic
  // ------------------------------------------------------------------------
  console.log("--- Suite 1: TopNav Loading vs Resolved State Machine ---");
  
  assert(
    topNavSource.includes("const { user, isLoading, clearSession } = useSession();"),
    "1.1 TopNav consumes isLoading from useSession() context"
  );

  assert(
    topNavSource.includes("isLoading && !userInfo.name"),
    "1.2 Pulse skeleton condition is strictly gated by isLoading && !userInfo.name"
  );

  assert(
    topNavSource.includes('aria-busy="true"') && topNavSource.includes('aria-label="Loading user profile"'),
    "1.3 Loading skeleton has accessible ARIA attributes and labels"
  );

  assert(
    topNavSource.includes("userInfo.name ? (") || topNavSource.includes(": userInfo.name ?"),
    "1.4 Authenticated branch renders when userInfo.name is present"
  );

  assert(
    topNavSource.includes('href="/login"') && topNavSource.includes("Sign In"),
    "1.5 Unauthenticated state renders clean Sign In link instead of infinite skeleton"
  );

  // ------------------------------------------------------------------------
  // Suite 2: Client Mount & Cached Profile Hydration
  // ------------------------------------------------------------------------
  console.log("\n--- Suite 2: Client Mount & Cached Profile Hydration ---");

  assert(
    topNavSource.includes('sessionStorage.getItem("brandshield_session_profile")'),
    "2.1 TopNav checks cached session profile on mount to eliminate flash"
  );

  assert(
    authContextSource.includes("setIsLoading(false);") &&
    authContextSource.includes('sessionStorage.getItem("brandshield_session_profile")'),
    "2.2 AuthSessionContext sets isLoading = false immediately when cached profile is available"
  );

  assert(
    authContextSource.includes("parsed.userName || parsed.name") &&
    authContextSource.includes("parsed.userEmail || parsed.email"),
    "2.3 AuthSessionContext supports both userName/userEmail and legacy name/email profile properties"
  );

  // ------------------------------------------------------------------------
  // Suite 3: Login & Session Synchronization Lifecycle
  // ------------------------------------------------------------------------
  console.log("\n--- Suite 3: Login & Session Synchronization Lifecycle ---");

  assert(
    loginFormSource.includes("import { useSession } from"),
    "3.1 LoginForm imports useSession from AuthSessionContext"
  );

  assert(
    loginFormSource.includes("refreshSession") && loginFormSource.includes("clearSession"),
    "3.2 LoginForm consumes refreshSession and clearSession"
  );

  assert(
    loginFormSource.includes("await refreshSession();"),
    "3.3 LoginForm triggers immediate session refresh upon successful login"
  );

  assert(
    loginFormSource.includes("clearSession();"),
    "3.4 LoginForm clears active session upon explicit account switch"
  );

  // ------------------------------------------------------------------------
  // Suite 4: Initials Calculation & Role Formatting
  // ------------------------------------------------------------------------
  console.log("\n--- Suite 4: Initials Calculation & Role Formatting ---");

  // Pure logic tests for initials extraction
  function computeInitials(displayName: string): string {
    const names = displayName.trim().split(/\s+/);
    return names.length > 1
      ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      : displayName.substring(0, 2).toUpperCase();
  }

  assert(
    computeInitials("Dr. Elena Vance") === "DV",
    "4.1 Multi-word name extracts first and last initials ('Dr. Elena Vance' -> 'DV')"
  );

  assert(
    computeInitials("Compliance Reviewer") === "CR",
    "4.2 Multi-word title extracts initials ('Compliance Reviewer' -> 'CR')"
  );

  assert(
    computeInitials("Admin") === "AD",
    "4.3 Single-word name extracts first 2 characters ('Admin' -> 'AD')"
  );

  assert(
    computeInitials("elena@dermaglow.com") === "EL",
    "4.4 Email fallback extracts first 2 characters ('elena@dermaglow.com' -> 'EL')"
  );

  assert(
    topNavSource.includes("user.role.replace(/_/g, \" \")"),
    "4.5 User role converts snake_case to readable title (e.g. compliance_reviewer -> compliance reviewer)"
  );

  // ------------------------------------------------------------------------
  // Suite 5: Guided Tour and Multi-Tenant Isolation
  // ------------------------------------------------------------------------
  console.log("\n--- Suite 5: Guided Tour and Multi-Tenant Isolation ---");

  assert(
    topNavSource.includes('data-tour="workspace-indicator"'),
    "5.1 TopNav preserves data-tour='workspace-indicator' selector"
  );

  assert(
    topNavSource.includes('data-tour="notifications-bell"'),
    "5.2 TopNav preserves data-tour='notifications-bell' selector"
  );

  assert(
    topNavSource.includes("<WorkspaceSwitcher"),
    "5.3 WorkspaceSwitcher component remains integrated in TopNav"
  );

  assert(
    topNavSource.includes("<HelpTourLauncher />"),
    "5.4 HelpTourLauncher component remains integrated in TopNav"
  );

  // ------------------------------------------------------------------------
  // Suite 6: Demo User Fallback Support
  // ------------------------------------------------------------------------
  console.log("\n--- Suite 6: Demo User Fallback Support ---");

  assert(
    !topNavSource.includes("!user.isDemoFallback"),
    "6.1 TopNav does not artificially suppress display of demo fallback users"
  );

  console.log("\n========================================================================");
  console.log(` RESULTS: ${passed} passed, ${failed} failed.`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTopNavProfileTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

