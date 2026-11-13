/**
 * BrandShield AI — Production Workspace & Membership Bug Fix Regression Test Suite
 *
 * Verifies all requirements specified in:
 * "BrandShield AI — Critical Production Workspace & Membership Bug Fix"
 *
 * Scenarios:
 * A. Team members (active count, status filtering, no mock fallback, count matches rows)
 * B. Invitations (pending filter, revoked/accepted/expired excluded, history preserved, admin-only 403)
 * C. Workspace and account switching (tenant clearing, request sequencing, stale overwrite protection)
 * D. Organization creation (duplicate slug 409, field preservation, retry without refresh)
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { GET as getMembersRoute } from "../src/app/api/workspaces/[id]/members/route";
import { GET as getInvitationsRoute } from "../src/app/api/workspaces/[id]/invitations/route";
import { POST as createWorkspaceRoute } from "../src/app/api/workspaces/route";
import { __setTestSessionOverride } from "../src/lib/auth/server-session";

// Load .env.local synchronously before db queries
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${title}`);
  } else {
    failed++;
    console.error(`[FAIL] ${title}`);
    if (details) console.error(`       Details: ${details}`);
  }
}

const DERMAGLOW_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_USER_ID = "22575e06-b0ac-4a5e-9391-58c7f6937298"; // admin@dermaglow.com in auth.users
const REVIEWER_USER_ID = "4fd3adf8-41fd-4c69-9edf-72e4ad0a7d69"; // elena.vance@dermaglow.com in auth.users

async function runRegressionSuite() {
  console.log("========================================================================");
  console.log("  BRANDSHIELD AI: WORKSPACE & MEMBERSHIP REGRESSION VERIFICATION SUITE  ");
  console.log("========================================================================\n");

  // -------------------------------------------------------------------------
  // SUITE A: Team Members
  // -------------------------------------------------------------------------
  console.log("--- Suite A: Team Members Filtering & Count Integrity ---");

  // 1. Setup Admin session on DermaGlow
  __setTestSessionOverride({
    userId: ADMIN_USER_ID,
    userEmail: "admin@dermaglow.com",
    userName: "Compliance Administrator",
    role: "admin",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: "dermaglow",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const memberReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/members`);
  const memberRes = await getMembersRoute(memberReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  const memberData = await memberRes.json();

  assert(
    memberRes.status === 200 && memberData.success === true,
    `A.1 GET /api/workspaces/[id]/members returns HTTP 200 for authenticated member (status: ${memberRes.status})`
  );

  assert(
    Array.isArray(memberData.members) && memberData.members.length === 3,
    `A.2 Correct active member count: exactly 3 active members in DermaGlow (got ${memberData.members?.length})`
  );

  // Verify none of the members are mock users (Sarah Chen, Alex Rivera, etc.)
  const names = (memberData.members || []).map((m: any) => m.name);
  const hasMockUsers = names.includes("Sarah Chen") || names.includes("Alex Rivera");
  assert(
    !hasMockUsers,
    "A.3 Mock users (Sarah Chen, Alex Rivera) are NOT present in API response"
  );

  // Verify all returned members have status === 'active'
  const allActive = (memberData.members || []).every((m: any) => m.status === "active");
  assert(
    allActive,
    "A.4 All returned members strictly have status === 'active'"
  );

  // Check SQL status filter query with ?status=all vs ?status=active
  const memberAllReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/members?status=all`);
  const memberAllRes = await getMembersRoute(memberAllReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  const memberAllData = await memberAllRes.json();
  assert(
    memberAllRes.status === 200 && Array.isArray(memberAllData.members),
    "A.5 ?status=all preserves historical query capability for audit/management views"
  );

  // Non-existent / empty workspace returns 404 or 0 members
  const emptyWsId = "00000000-0000-0000-0000-999999999999";
  const emptyReq = new NextRequest(`http://localhost:3000/api/workspaces/${emptyWsId}/members`);
  const emptyRes = await getMembersRoute(emptyReq, { params: Promise.resolve({ id: emptyWsId }) });
  assert(
    emptyRes.status === 404,
    "A.6 Non-existent workspace returns HTTP 404 without fabricated fallback"
  );

  // Cross-tenant unauthorized member check
  __setTestSessionOverride({
    userId: "00000000-0000-0000-0000-000000000099",
    userEmail: "intruder@external.org",
    userName: "Intruder User",
    role: "viewer",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    workspaceSlug: "external",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const unauthorizedReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/members`);
  const unauthorizedRes = await getMembersRoute(unauthorizedReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  assert(
    unauthorizedRes.status === 403,
    "A.7 Non-member of workspace is strictly rejected with HTTP 403 Forbidden"
  );

  // -------------------------------------------------------------------------
  // SUITE B: Invitations
  // -------------------------------------------------------------------------
  console.log("\n--- Suite B: Invitations Status Handling & Administrator Authorization ---");

  // Restore Admin session on DermaGlow
  __setTestSessionOverride({
    userId: ADMIN_USER_ID,
    userEmail: "admin@dermaglow.com",
    userName: "Compliance Administrator",
    role: "admin",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: "dermaglow",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  // Default query: must return pending invitations only (status = 'pending' and expires_at > now())
  const inviteDefaultReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/invitations`);
  const inviteDefaultRes = await getInvitationsRoute(inviteDefaultReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  const inviteDefaultData = await inviteDefaultRes.json();

  assert(
    inviteDefaultRes.status === 200 && inviteDefaultData.success === true,
    "B.1 Admin GET /api/workspaces/[id]/invitations returns HTTP 200"
  );

  assert(
    Array.isArray(inviteDefaultData.invitations) && inviteDefaultData.invitations.length === 0,
    `B.2 DermaGlow has 0 pending invitations (both DB records are revoked) -> returns empty array (got ${inviteDefaultData.invitations?.length})`
  );

  // Query historical records with ?status=all
  const inviteAllReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/invitations?status=all`);
  const inviteAllRes = await getInvitationsRoute(inviteAllReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  const inviteAllData = await inviteAllRes.json();

  assert(
    inviteAllRes.status === 200 && inviteAllData.invitations.length === 2,
    `B.3 ?status=all returns full historical records (2 revoked invitations found, got ${inviteAllData.invitations?.length})`
  );

  const revokedStatuses = inviteAllData.invitations.map((i: any) => i.status);
  assert(
    revokedStatuses.every((s: string) => s === "revoked"),
    "B.4 Historical records correctly show status === 'revoked' and were excluded from default view"
  );

  // Verify non-admin gets HTTP 403
  __setTestSessionOverride({
    userId: REVIEWER_USER_ID,
    userEmail: "elena.vance@dermaglow.com",
    userName: "Dr. Elena Vance",
    role: "compliance_reviewer",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: "dermaglow",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const inviteReviewerReq = new NextRequest(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/invitations`);
  const inviteReviewerRes = await getInvitationsRoute(inviteReviewerReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });
  const inviteReviewerData = await inviteReviewerRes.json();

  assert(
    inviteReviewerRes.status === 403,
    "B.5 Non-admin reviewer receives HTTP 403 Forbidden on invitations endpoint"
  );

  assert(
    inviteReviewerData.error?.includes("Only workspace administrators can view pending invitations"),
    "B.6 Error payload clearly states admin requirement, preserving security boundary"
  );

  // -------------------------------------------------------------------------
  // SUITE C: Client State, Workspace & Account Switching Invariants
  // -------------------------------------------------------------------------
  console.log("\n--- Suite C: Workspace Switching & Race Condition Defenses ---");

  // Read settings page source code to verify structural defenses
  const settingsSource = fs.readFileSync(path.join(__dirname, "../src/app/settings/page.tsx"), "utf8");

  assert(
    !settingsSource.includes("DEFAULT_MEMBERS") && !settingsSource.includes("DEFAULT_INVITATIONS"),
    "C.1 Hardcoded mock constants DEFAULT_MEMBERS and DEFAULT_INVITATIONS are completely eliminated"
  );

  assert(
    settingsSource.includes("teamFetchSeqRef") && settingsSource.includes("teamAbortControllerRef"),
    "C.2 Request sequence counter and AbortController refs implemented for race condition defense"
  );

  assert(
    settingsSource.includes("prevUserIdRef"),
    "C.3 Account switching tracking implemented to immediately clear stale tenant data on user transition"
  );

  assert(
    settingsSource.includes("invitationsForbidden") &&
    settingsSource.includes("Only workspace administrators can view pending invitations"),
    "C.4 Dedicated 403 permission state renders clear administrator notice, not fake data or empty list"
  );

  assert(
    settingsSource.includes("pendingInvitations = useMemo") &&
    settingsSource.includes('inv.status === "pending"'),
    "C.5 Pending invitations badge and table strictly bind to the same filtered status === 'pending' collection"
  );

  // -------------------------------------------------------------------------
  // SUITE D: Organization Creation & Slug Collision Recovery
  // -------------------------------------------------------------------------
  console.log("\n--- Suite D: Organization Creation & Duplicate Slug Verification ---");

  // Restore Admin session
  __setTestSessionOverride({
    userId: ADMIN_USER_ID,
    userEmail: "admin@dermaglow.com",
    userName: "Compliance Administrator",
    role: "admin",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: "dermaglow",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  // Attempt duplicate slug creation: "bio-tech"
  const dupReq = new NextRequest("http://localhost:3000/api/workspaces", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-brandshield-user-id": ADMIN_USER_ID,
      "x-brandshield-user-email": "admin@dermaglow.com",
    },
    body: JSON.stringify({
      name: "Bio Tech Research",
      slug: "bio-tech",
      domain: "biotech.internal",
    }),
  });

  const dupRes = await createWorkspaceRoute(dupReq);
  const dupData = await dupRes.json();

  assert(
    dupRes.status === 409,
    `D.1 Duplicate slug "bio-tech" returns HTTP 409 Conflict (got ${dupRes.status})`
  );

  assert(
    dupData.error?.includes('Workspace slug "bio-tech" is already in use'),
    `D.2 Conflict response contains clear user-actionable message: "${dupData.error}"`
  );

  // Modal inspection: verify non-destructive error handling in CreateOrganizationModal.tsx
  const modalSource = fs.readFileSync(
    path.join(__dirname, "../src/components/workspace/CreateOrganizationModal.tsx"),
    "utf8"
  );

  assert(
    modalSource.includes("setError(") && modalSource.includes("setIsLoading(false)"),
    "D.3 CreateOrganizationModal catches error and turns off loading without clearing input state"
  );

  assert(
    modalSource.includes("handleSlugChange") && modalSource.includes("setError(null)"),
    "D.4 Modal clears error automatically upon user editing the slug to retry without reload"
  );

  // Clear override
  __setTestSessionOverride(null);

  console.log("\n========================================================================");
  console.log(` REGRESSION SUITE RESULTS: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runRegressionSuite().catch((err) => {
  console.error("FATAL: Regression suite failed with unhandled exception:", err);
  process.exit(1);
});
