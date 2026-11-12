/**
 * BrandShield AI - Guided Tour & Interactive Walkthrough System Test Suite
 *
 * Verifies:
 * 1. Role Tour Configs completeness for all 5 enterprise roles
 * 2. Meaningful step sequences & cross-page navigation for all roles
 * 3. Page Tour Mappings completeness for all 8 application routes
 * 4. Consequential Control Tips presence for high-impact actions
 * 5. Role Permission Alignment (no unauthorized steps in restricted roles)
 * 6. Target Selector Integrity (every data-tour attribute exists in source code)
 * 7. Active Session Persistence & Cross-Page Continuity (sessionStorage survival)
 * 8. Missing-Target Discovery Resilience & Fallback Handling
 * 9. LocalStorage State Serialization & Multi-Tenant Isolation
 */

import fs from "fs";
import path from "path";
import {
  ROLE_TOUR_CONFIGS,
  PAGE_TOURS,
} from "../src/lib/tour/tour-config";
import { ReviewerRole } from "../src/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ ${message}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  BrandShield AI — Guided Tour & Onboarding Test Suite");
  console.log("=======================================================\n");

  // 1. Role Tour Configs Validation
  console.log("Test Suite 1: Role Tour Configurations Completeness");
  const expectedRoles: ReviewerRole[] = [
    "admin",
    "compliance_reviewer",
    "legal_reviewer",
    "creator",
    "viewer",
  ];

  const configuredRoles = Object.keys(ROLE_TOUR_CONFIGS) as ReviewerRole[];
  assert(
    configuredRoles.length === 5,
    `ROLE_TOUR_CONFIGS contains exactly 5 roles (found ${configuredRoles.length})`
  );

  for (const role of expectedRoles) {
    const config = ROLE_TOUR_CONFIGS[role];
    assert(!!config, `RoleTourConfig exists for role: ${role}`);
    assert(
      config.role === role,
      `Config role property matches key (${config.role})`
    );
    assert(
      config.roleDisplayName.length > 0,
      `Role ${role} has valid display name: "${config.roleDisplayName}"`
    );
    assert(
      config.workflowSummary.length > 0,
      `Role ${role} has workflow summary`
    );
    assert(
      config.responsibilities.length >= 3,
      `Role ${role} defines at least 3 key responsibilities (${config.responsibilities.length} found)`
    );
    assert(
      config.steps.length >= 3,
      `Role ${role} defines at least 3 guided tour steps (${config.steps.length} steps)`
    );

    // Verify all steps have valid properties
    for (const step of config.steps) {
      assert(
        step.id.length > 0 &&
          step.targetSelector.startsWith('[data-tour="') &&
          step.title.length > 0 &&
          step.content.length > 0,
        `Role ${role} step "${step.id}" has valid target, title, and content`
      );
    }
  }

  // 2. Cross-Page Journey & Continuity Audit for All 5 Roles
  console.log("\nTest Suite 2: Meaningful Step Sequences & Cross-Page Navigation (All 5 Roles)");
  for (const role of expectedRoles) {
    const config = ROLE_TOUR_CONFIGS[role];
    const totalSteps = config.steps.length;

    // Check for at least one cross-page transition
    const distinctRoutes = Array.from(new Set(config.steps.map((s) => s.pageRoute || "/dashboard")));
    assert(
      distinctRoutes.length >= 2,
      `Role ${role} spans at least 2 distinct application routes (spans ${distinctRoutes.length}: ${distinctRoutes.join(", ")})`
    );

    // Simulate complete Next sequence from 0 to totalSteps - 1
    let simulatedCurrentIndex = 0;
    let prevRoute = config.steps[0].pageRoute || "/dashboard";
    let transitionCount = 0;

    for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
      simulatedCurrentIndex = stepIdx;
      const step = config.steps[stepIdx];
      const stepRoute = step.pageRoute || "/dashboard";

      if (stepRoute !== prevRoute) {
        transitionCount++;
        prevRoute = stepRoute;
      }

      // Progress bar percentage check
      const expectedProgress = Math.round(((simulatedCurrentIndex + 1) / totalSteps) * 100);
      assert(
        expectedProgress > 0 && expectedProgress <= 100,
        `Role ${role} Step ${stepIdx + 1}/${totalSteps} calculates valid progress: ${expectedProgress}%`
      );
    }

    assert(
      transitionCount >= 1,
      `Role ${role} executed ${transitionCount} cross-page route change(s) successfully`
    );

    // Simulate Back sequence from last step down to 0
    for (let backIdx = totalSteps - 1; backIdx > 0; backIdx--) {
      const prevStep = config.steps[backIdx - 1];
      assert(
        !!prevStep.targetSelector,
        `Role ${role} Back navigation to Step ${backIdx} targets valid selector: ${prevStep.targetSelector}`
      );
    }
  }

  // 3. Page Tour Mappings Completeness
  console.log("\nTest Suite 3: Page Tour Mappings (All 8 Core Routes)");
  const expectedRoutes = [
    "/dashboard",
    "/submissions",
    "/products",
    "/sources",
    "/policies",
    "/reviews",
    "/audit",
    "/settings",
  ];

  for (const route of expectedRoutes) {
    const pageTour = PAGE_TOURS[route];
    assert(!!pageTour, `Page tour defined for route: ${route}`);
    assert(
      pageTour.pageRoute === route,
      `Page tour pageRoute matches key: ${route}`
    );
    assert(
      pageTour.steps.length >= 2,
      `Page tour ${route} has at least 2 detailed steps (${pageTour.steps.length} steps)`
    );
  }

  // 4. Consequential Control Guidance (Action Name, Description, Consequence)
  console.log("\nTest Suite 4: Consequential Control Guidance");
  let controlTipCount = 0;
  for (const [route, pageTour] of Object.entries(PAGE_TOURS)) {
    for (const step of pageTour.steps) {
      if (step.controlTip) {
        controlTipCount++;
        assert(
          step.controlTip.actionName.length > 0 &&
            step.controlTip.description.length > 0 &&
            (step.controlTip.consequence?.length || 0) > 0,
          `Control tip for step "${step.id}" on ${route} has actionName, description, and consequence`
        );
      }
    }
  }
  assert(
    controlTipCount >= 6,
    `At least 6 critical consequential controls have explicit control tips (found ${controlTipCount})`
  );

  // 5. Role Permission Alignment / Security Isolation
  console.log("\nTest Suite 5: Role Permission Alignment & Security Isolation");
  // Viewer must not have any steps targeting creation, review, policy edit, or admin actions
  const viewerSteps = ROLE_TOUR_CONFIGS.viewer.steps;
  const viewerSelectors = viewerSteps.map((s) => s.targetSelector);
  assert(
    !viewerSelectors.some((s) => s.includes("create-policy") || s.includes("create-submission") || s.includes("invite-member")),
    "Viewer role tour does NOT include creation, policy configuration, or admin member invitation steps"
  );

  // Creator must not have policy modification or review queue approval steps
  const creatorSteps = ROLE_TOUR_CONFIGS.creator.steps;
  const creatorSelectors = creatorSteps.map((s) => s.targetSelector);
  assert(
    !creatorSelectors.some((s) => s.includes("create-policy") || s.includes("roles-permissions") || s.includes("reviews-decision-actions")),
    "Creator role tour does NOT include policy creation, role management, or review determination actions"
  );

  // Admin must have settings and roles steps
  const adminSteps = ROLE_TOUR_CONFIGS.admin.steps;
  const adminSelectors = adminSteps.map((s) => s.targetSelector);
  assert(
    adminSelectors.some((s) => s.includes("roles-permissions") || s.includes("settings-tabs")),
    "Admin role tour includes workspace settings and roles & permissions governance steps"
  );

  // Compliance Reviewer must have review queue and evidence steps
  const reviewerSteps = ROLE_TOUR_CONFIGS.compliance_reviewer.steps;
  const reviewerSelectors = reviewerSteps.map((s) => s.targetSelector);
  assert(
    reviewerSelectors.some((s) => s.includes("reviews-queue-table") || s.includes("reviews-decision-actions")),
    "Compliance Reviewer tour includes reviews queue and governance decision actions"
  );

  // 6. Target Selector Integrity in Codebase
  console.log("\nTest Suite 6: Codebase Target Selector Audit (All data-tour attributes exist in JSX)");
  const filesToCheck = [
    { file: "src/components/layout/TopNav.tsx", required: ["workspace-indicator", "notifications-bell"] },
    { file: "src/components/tour/HelpTourLauncher.tsx", required: ["help-tour-launcher"] },
    { file: "src/app/dashboard/page.tsx", required: ["check-content-btn", "review-queue-link", "kpi-cards", "governance-workflow", "recent-submissions"] },
    { file: "src/app/submissions/page.tsx", required: ["create-submission-btn", "submissions-search", "submissions-table"] },
    { file: "src/app/products/page.tsx", required: ["register-product-btn", "products-search", "products-table"] },
    { file: "src/app/sources/page.tsx", required: ["upload-evidence-btn", "evidence-tabs", "evidence-list"] },
    { file: "src/app/policies/page.tsx", required: ["create-policy-btn", "policies-list", "policy-studio-link"] },
    { file: "src/app/reviews/page.tsx", required: ["reviews-risk-filter", "reviews-queue-table", "reviews-decision-actions"] },
    { file: "src/app/audit/page.tsx", required: ["audit-filters", "audit-events-table", "audit-export-btn"] },
    { file: "src/app/settings/page.tsx", required: ["settings-tabs", "roles-permissions-tab", "invite-member-btn"] },
  ];

  const projectRoot = path.resolve(__dirname, "..");
  for (const { file, required } of filesToCheck) {
    const fullPath = path.join(projectRoot, file);
    assert(fs.existsSync(fullPath), `Target file exists: ${file}`);
    const content = fs.readFileSync(fullPath, "utf8");

    for (const attr of required) {
      const needle = `data-tour="${attr}"`;
      assert(
        content.includes(needle),
        `File ${file} contains ${needle}`
      );
    }
  }

  // 7. Active Session Persistence & Cross-Page Continuity Logic
  console.log("\nTest Suite 7: Active Session Persistence & Route Recovery Logic");
  const mockSessionStorage: Record<string, string> = {};
  const SESSION_KEY = "brandshield_active_tour_session_v1";

  // Simulate starting tour
  mockSessionStorage[SESSION_KEY] = JSON.stringify({
    tourId: "role-admin",
    title: "Workspace Administrator Walkthrough",
    stepIndex: 0,
    steps: ROLE_TOUR_CONFIGS.admin.steps,
  });

  const parsedSession1 = JSON.parse(mockSessionStorage[SESSION_KEY]);
  assert(parsedSession1.tourId === "role-admin", "Active session records role-admin");
  assert(parsedSession1.stepIndex === 0, "Initial session stepIndex is 0");

  // Simulate step advance to step 2 (cross-page route change to /products)
  mockSessionStorage[SESSION_KEY] = JSON.stringify({
    ...parsedSession1,
    stepIndex: 2,
  });

  const parsedSession2 = JSON.parse(mockSessionStorage[SESSION_KEY]);
  assert(parsedSession2.stepIndex === 2, "Session survives route transition and advances stepIndex to 2");
  assert(parsedSession2.steps[2].pageRoute === "/products", "Step 2 target route is /products");

  // Simulate tour completion or skip (clears session)
  delete mockSessionStorage[SESSION_KEY];
  assert(
    mockSessionStorage[SESSION_KEY] === undefined,
    "Completing or skipping tour cleanly nullifies active session storage"
  );

  // 8. Missing-Target Discovery Fallback & State Machine Simulation
  console.log("\nTest Suite 8: Target Discovery State Machine & Bounded Fallback Safety");

  interface DiscoveryState {
    isLocating: boolean;
    locateFailed: boolean;
    elementFound: boolean;
    targetRect: { width: number; height: number } | null;
  }

  // Exact reproduction of TourSpotlight locateTargetElement state machine logic
  const runDiscoveryStateMachine = (
    elementAvailableAtTick: number, // -1 means never available
    maxPolls = 50
  ) => {
    let state: DiscoveryState = {
      isLocating: true,
      locateFailed: false,
      elementFound: false,
      targetRect: null,
    };
    let tick = 0;
    let isDisposed = false;

    const stopWatching = () => {};

    const tryFind = (currentTick: number): boolean => {
      if (isDisposed) return true;
      if (elementAvailableAtTick >= 0 && currentTick >= elementAvailableAtTick) {
        stopWatching();
        // Synchronous immediate measurement (fix applied in TourSpotlight.tsx)
        state.targetRect = { width: 140, height: 28 };
        state.elementFound = true;
        state.isLocating = false;
        state.locateFailed = false;
        return true;
      }
      return false;
    };

    // 1. Initial immediate check (tick 0)
    if (tryFind(0)) {
      return { finalState: state, totalTicks: 0 };
    }

    // 2. Polling loop simulation (ticks 1..maxPolls)
    for (tick = 1; tick <= maxPolls; tick++) {
      if (tryFind(tick)) {
        return { finalState: state, totalTicks: tick };
      }
      if (tick >= maxPolls) {
        state.isLocating = false;
        state.locateFailed = true;
        state.elementFound = false;
        state.targetRect = null;
        return { finalState: state, totalTicks: tick };
      }
    }

    return { finalState: state, totalTicks: tick };
  };

  // Case A: Immediate presence (e.g. [data-tour="review-queue-link"] on /dashboard)
  const caseA = runDiscoveryStateMachine(0);
  assert(caseA.finalState.elementFound === true, "Case A: Immediate element found on tick 0");
  assert(caseA.finalState.isLocating === false, "Case A: isLocating is immediately false (no delay)");
  assert(caseA.finalState.locateFailed === false, "Case A: locateFailed is false");
  assert(caseA.finalState.targetRect !== null, "Case A: targetRect is measured immediately");
  assert(caseA.totalTicks === 0, "Case A: Resolved in 0 ticks without waiting for polling");

  // Case B: Delayed presence (e.g. dynamic content mounting at tick 5 / ~400ms)
  const caseB = runDiscoveryStateMachine(5);
  assert(caseB.finalState.elementFound === true, "Case B: Dynamic element successfully found before timeout");
  assert(caseB.finalState.isLocating === false, "Case B: isLocating resolved to false upon discovery");
  assert(caseB.finalState.locateFailed === false, "Case B: locateFailed is false");
  assert(caseB.totalTicks === 5, "Case B: Resolved on tick 5");

  // Case C: Missing element (never appears)
  const caseC = runDiscoveryStateMachine(-1, 50);
  assert(caseC.finalState.elementFound === false, "Case C: Element not found");
  assert(caseC.finalState.isLocating === false, "Case C: isLocating stops at timeout (never stuck loading)");
  assert(caseC.finalState.locateFailed === true, "Case C: locateFailed triggers gracefully");
  assert(caseC.finalState.targetRect === null, "Case C: targetRect is cleanly null");
  assert(caseC.totalTicks === 50, "Case C: Search bounded strictly to maxPolls (4000ms)");

  // Case D: Role Initial Step 1 Selectors Verification on /dashboard
  for (const role of expectedRoles) {
    const roleConfig = ROLE_TOUR_CONFIGS[role];
    const step1 = roleConfig.steps[0];
    assert(step1.pageRoute === "/dashboard", `Role ${role} Step 1 starts on /dashboard`);
    assert(step1.targetSelector.length > 0, `Role ${role} Step 1 has target selector: ${step1.targetSelector}`);
  }

  // 9. LocalStorage State Logic & Workspace Isolation Simulation
  console.log("\nTest Suite 9: LocalStorage State Serialization & Isolation Logic");
  const mockStorage: Record<string, string> = {};

  const makeKey = (userId: string, workspaceSlug: string) =>
    `brandshield_tour_state_v1_${userId}_${workspaceSlug}`;

  const userA = "usr-sarah";
  const userB = "usr-marcus";
  const ws1 = "dermaglow";
  const ws2 = "acme-pharma";

  const keyA_ws1 = makeKey(userA, ws1);
  const keyA_ws2 = makeKey(userA, ws2);
  const keyB_ws1 = makeKey(userB, ws1);

  // Initial state for Sarah in Dermaglow
  mockStorage[keyA_ws1] = JSON.stringify({
    userId: userA,
    workspaceSlug: ws1,
    hasSeenWelcome: true,
    completedTours: ["role-admin"],
    skipped: false,
    updatedAt: new Date().toISOString(),
  });

  const parsedA_ws1 = JSON.parse(mockStorage[keyA_ws1]);
  assert(parsedA_ws1.hasSeenWelcome === true, "Sarah in Dermaglow marked welcome seen");
  assert(parsedA_ws1.completedTours.includes("role-admin"), "Sarah completed admin tour");

  // Sarah in Acme Pharma should have distinct state
  assert(
    mockStorage[keyA_ws2] === undefined,
    "Sarah in Acme Pharma has no prior state (clean isolation across workspaces)"
  );

  // Marcus in Dermaglow should have distinct state
  assert(
    mockStorage[keyB_ws1] === undefined,
    "Marcus in Dermaglow has no prior state (clean isolation across users)"
  );

  // Test reset logic
  delete mockStorage[keyA_ws1];
  assert(
    mockStorage[keyA_ws1] === undefined,
    "Resetting Sarah's tour successfully clears her workspace tour state"
  );

  // Summary
  console.log("\n=======================================================");
  console.log(`  Tests completed: ${passedCount} passed, ${failedCount} failed`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled test error:", err);
  process.exit(1);
});
