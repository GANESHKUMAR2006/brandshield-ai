import { NextRequest } from "next/server";
import crypto from "crypto";
import {
  DELETE as deleteWorkspace,
  GET as getWorkspace,
} from "@/app/api/workspaces/[id]/route";
import {
  GET as getWorkspaces,
} from "@/app/api/workspaces/route";
import {
  POST as postSubmission,
} from "@/app/api/submissions/route";
import {
  __setTestSessionOverride,
  ServerSessionIdentity,
  isValidUUID,
} from "@/lib/auth/server-session";
import { __setTestQueryOverride } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

let passedCount = 0;
let failedCount = 0;

function check(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         └─ ${detail}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: ORGANIZATION LIFECYCLE & ARCHIVAL VERIFICATION SUITE   ");
  console.log("========================================================================");

  // Setup mock IDs
  const adminUserId = "b1111111-1111-4111-a111-111111111111";
  const reviewerUserId = "b2222222-2222-4222-a222-222222222222";
  const targetWorkspaceId = "c1111111-1111-4111-a111-111111111111";
  const otherWorkspaceId = "c2222222-2222-4222-a222-222222222222";
  const targetOrgName = "Lumina Therapeutics";
  const targetOrgSlug = "lumina-therapeutics";

  // In-memory mock database state for testing
  let mockWorkspaces: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    archived_at: string | null;
    archived_by: string | null;
    created_at: string;
    updated_at: string;
  }> = [];

  let mockMemberships: Array<{
    id: string;
    workspace_id: string;
    user_id: string;
    role: string;
    status: string;
  }> = [];

  let mockInvitations: Array<{
    id: string;
    workspace_id: string;
    email: string;
    status: string;
  }> = [];

  function resetMockDb() {
    mockWorkspaces = [
      {
        id: targetWorkspaceId,
        name: targetOrgName,
        slug: targetOrgSlug,
        status: "active",
        archived_at: null,
        archived_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: otherWorkspaceId,
        name: "DermaGlow Inc",
        slug: "dermaglow",
        status: "active",
        archived_at: null,
        archived_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockMemberships = [
      {
        id: crypto.randomUUID(),
        workspace_id: targetWorkspaceId,
        user_id: adminUserId,
        role: "admin",
        status: "active",
      },
      {
        id: crypto.randomUUID(),
        workspace_id: targetWorkspaceId,
        user_id: reviewerUserId,
        role: "compliance_reviewer",
        status: "active",
      },
      {
        id: crypto.randomUUID(),
        workspace_id: otherWorkspaceId,
        user_id: adminUserId,
        role: "admin",
        status: "active",
      },
    ];

    mockInvitations = [
      {
        id: crypto.randomUUID(),
        workspace_id: targetWorkspaceId,
        email: "invited.doctor@lumina.com",
        status: "pending",
      },
    ];

    AuditService.clearInMemoryLedger();
  }

  // Intercept SQL queries
  __setTestQueryOverride(async (sql: string, params: unknown[] = []) => {
    const s = sql.toLowerCase();

    // 1. SELECT workspaces WHERE id = $1
    if (s.includes("from workspaces") && s.includes("where id = $1")) {
      const id = params[0] as string;
      const ws = mockWorkspaces.find((w) => w.id === id);
      return { rows: ws ? [ws] : [] };
    }

    // 2. SELECT workspace_memberships WHERE workspace_id = $1 AND user_id = $2
    if (s.includes("from workspace_memberships") && s.includes("workspace_id = $1 and user_id = $2")) {
      const wsId = params[0] as string;
      const uId = params[1] as string;
      const m = mockMemberships.find((mem) => mem.workspace_id === wsId && mem.user_id === uId);
      return { rows: m ? [m] : [] };
    }

    // 3. UPDATE workspaces SET status = 'archived'
    if (s.includes("update workspaces") && s.includes("status = 'archived'")) {
      const actorId = params[0] as string;
      const wsId = params[1] as string;
      const ws = mockWorkspaces.find((w) => w.id === wsId);
      if (ws) {
        ws.status = "archived";
        ws.archived_at = new Date().toISOString();
        ws.archived_by = actorId;
        ws.updated_at = new Date().toISOString();
      }
      return { rows: ws ? [ws] : [] };
    }

    // 4. UPDATE workspace_memberships SET status = 'suspended'
    if (s.includes("update workspace_memberships") && s.includes("status = 'suspended'")) {
      const wsId = params[0] as string;
      mockMemberships.forEach((m) => {
        if (m.workspace_id === wsId && m.status === "active") {
          m.status = "suspended";
        }
      });
      return { rows: [] };
    }

    // 5. UPDATE workspace_invitations SET status = 'revoked'
    if (s.includes("update workspace_invitations") && s.includes("status = 'revoked'")) {
      const wsId = params[0] as string;
      mockInvitations.forEach((inv) => {
        if (inv.workspace_id === wsId && inv.status === "pending") {
          inv.status = "revoked";
        }
      });
      return { rows: [] };
    }

    // 6. SELECT workspaces for user
    if (s.includes("from workspaces w") && s.includes("join workspace_memberships wm")) {
      const userId = params[0] as string;
      const includeArchived = s.includes("wm.status = 'suspended'");
      const userMems = mockMemberships.filter((m) =>
        m.user_id === userId && (includeArchived ? (m.status === "active" || m.status === "suspended") : m.status === "active")
      );
      const filterArchived = s.includes("w.status != 'archived'");

      const rows = userMems
        .map((m) => {
          const ws = mockWorkspaces.find((w) => w.id === m.workspace_id);
          if (!ws) return null;
          if (filterArchived && ws.status === "archived") return null;
          return {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            role: m.role,
            status: m.status,
            created_at: ws.created_at,
            member_count: "1",
          };
        })
        .filter(Boolean);

      return { rows };
    }

    // 7. GET submissions check: SELECT id, COALESCE(status, 'active') as status FROM workspaces WHERE slug = $1
    if (s.includes("from workspaces where slug = $1")) {
      const slug = params[0] as string;
      const ws = mockWorkspaces.find((w) => w.slug === slug);
      return { rows: ws ? [{ id: ws.id, status: ws.status }] : [] };
    }

    // 8. INSERT INTO audit_events
    if (s.includes("insert into audit_events")) {
      return { rows: [{ id: crypto.randomUUID() }] };
    }

    // Default empty
    return { rows: [] };
  });

  // -------------------------------------------------------------------------
  // Suite 1: Authentication & Format Guard Verification
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 1: Authentication & Format Guards ---");
  resetMockDb();

  // 1.1 Unauthenticated request returns HTTP 401
  __setTestSessionOverride(null);
  const unauthReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });
  const unauthRes = await deleteWorkspace(unauthReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  check(unauthRes.status === 401, "1.1 Unauthenticated request fails closed with HTTP 401");

  // 1.2 Invalid Non-UUID workspace ID rejected with HTTP 400
  __setTestSessionOverride({
    userId: adminUserId,
    userName: "Admin Sarah",
    userEmail: "sarah@lumina.com",
    role: "admin",
    workspaceId: targetWorkspaceId,
    workspaceSlug: targetOrgSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const badIdReq = new NextRequest("http://localhost:3000/api/workspaces/invalid-slug-123", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });
  const badIdRes = await deleteWorkspace(badIdReq, { params: Promise.resolve({ id: "invalid-slug-123" }) });
  check(badIdRes.status === 400, "1.2 Non-UUID workspace ID rejected with HTTP 400");

  // -------------------------------------------------------------------------
  // Suite 2: Multi-Tenant RBAC & Cross-Tenant Protection
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 2: Multi-Tenant RBAC & Cross-Tenant Rejection ---");
  resetMockDb();

  // 2.1 Non-member attempting archival rejected with HTTP 403
  const outsiderUserId = crypto.randomUUID();
  __setTestSessionOverride({
    userId: outsiderUserId,
    userName: "Attacker Outside",
    userEmail: "hacker@evil.com",
    role: "admin", // Admin in their own company, but has no membership in target workspace
    workspaceId: otherWorkspaceId,
    workspaceSlug: "other",
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const outsiderReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });
  const outsiderRes = await deleteWorkspace(outsiderReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  check(outsiderRes.status === 403, "2.1 Cross-tenant user rejected with HTTP 403");

  // 2.2 Member with non-admin role (compliance_reviewer) rejected with HTTP 403
  __setTestSessionOverride({
    userId: reviewerUserId,
    userName: "Reviewer Marcus",
    userEmail: "marcus@lumina.com",
    role: "compliance_reviewer",
    workspaceId: targetWorkspaceId,
    workspaceSlug: targetOrgSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const reviewerReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });
  const reviewerRes = await deleteWorkspace(reviewerReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  check(reviewerRes.status === 403, "2.2 Compliance Reviewer role rejected with HTTP 403");

  // -------------------------------------------------------------------------
  // Suite 3: Confirmation Requirements & Regulatory Protections
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 3: Name Confirmation & Regulatory Protections ---");
  resetMockDb();

  // Set authenticated admin session
  __setTestSessionOverride({
    userId: adminUserId,
    userName: "Admin Sarah",
    userEmail: "sarah@lumina.com",
    role: "admin",
    workspaceId: targetWorkspaceId,
    workspaceSlug: targetOrgSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  });

  // 3.1 Mismatched confirmation name rejected with HTTP 400
  const mismatchReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: "Wrong Company Name" }),
  });
  const mismatchRes = await deleteWorkspace(mismatchReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  const mismatchBody = await mismatchRes.json();
  check(mismatchRes.status === 400, "3.1 Mismatched organization name returns HTTP 400");
  check(
    mismatchBody.error.includes("confirmation does not match"),
    "3.2 Informative confirmation mismatch error returned",
    mismatchBody.error
  );

  // 3.2 Permanent hard delete request explicitly blocked with regulatory compliance notice
  const hardDeleteReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName, hardDelete: true }),
  });
  const hardDeleteRes = await deleteWorkspace(hardDeleteReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  const hardDeleteBody = await hardDeleteRes.json();
  check(hardDeleteRes.status === 400, "3.3 Hard delete request strictly rejected with HTTP 400");
  check(
    hardDeleteBody.error.includes("FDA 21 CFR Part 11"),
    "3.4 Cites FDA 21 CFR Part 11 and FTC compliance retention requirement",
    hardDeleteBody.error
  );

  // -------------------------------------------------------------------------
  // Suite 4: Authorized Archival Execution & Atomic Transition
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 4: Authorized Archival Execution & Atomic State Transition ---");
  resetMockDb();

  const archiveReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmName: targetOrgName,
      reason: "Product line sunsetting following FDA approval revision",
    }),
  });

  const archiveRes = await deleteWorkspace(archiveReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  const archiveBody = await archiveRes.json();

  check(archiveRes.status === 200, "4.1 Authorized admin archival succeeds with HTTP 200");
  check(archiveBody.success === true, "4.2 Response indicates success = true");
  check(archiveBody.workspace.status === "archived", "4.3 Response payload returns workspace.status = 'archived'");

  // Verify DB state updates
  const updatedWs = mockWorkspaces.find((w) => w.id === targetWorkspaceId);
  check(updatedWs?.status === "archived", "4.4 Workspace table status set to 'archived'");
  check(!!updatedWs?.archived_at, "4.5 Workspace table archived_at timestamp recorded");
  check(updatedWs?.archived_by === adminUserId, "4.6 Workspace table archived_by records administrator UUID");

  // Verify memberships suspended
  const targetMembers = mockMemberships.filter((m) => m.workspace_id === targetWorkspaceId);
  const allSuspended = targetMembers.every((m) => m.status === "suspended");
  check(allSuspended, "4.7 All active memberships for the archived workspace are set to 'suspended'");

  // Verify other workspace memberships unaffected
  const otherMembers = mockMemberships.filter((m) => m.workspace_id === otherWorkspaceId);
  const otherActive = otherMembers.every((m) => m.status === "active");
  check(otherActive, "4.8 Other workspace memberships remain 'active' (no cross-tenant leakage)");

  // Verify invitations revoked
  const targetInvites = mockInvitations.filter((i) => i.workspace_id === targetWorkspaceId);
  check(targetInvites[0]?.status === "revoked", "4.9 Pending invitations transition to 'revoked'");

  // Verify Audit log entry
  const auditEvents = AuditService.getInMemoryEvents();
  const archiveEvent = auditEvents.find((e) => e.action === "workspace_archived" && e.workspace_id === targetWorkspaceId);
  check(!!archiveEvent, "4.10 Append-only audit trail records 'workspace_archived' event");
  check(archiveEvent?.actor_id === adminUserId, "4.11 Audit record correctly attributes actor UUID");
  check(archiveEvent?.after_state?.status === "archived", "4.12 Audit after_state records archived status");

  // 4.13 Re-archiving already archived workspace returns HTTP 400
  const dupReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });
  const dupRes = await deleteWorkspace(dupReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  check(dupRes.status === 400, "4.13 Attempting to re-archive an already archived organization returns HTTP 400");

  // -------------------------------------------------------------------------
  // Suite 5: Post-Archival Invariants & Workspace Lifecycle Protection
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 5: Post-Archival Filtering & Workspace Isolation ---");

  // 5.1 GET /api/workspaces excludes archived organizations by default
  const listReq = new NextRequest("http://localhost:3000/api/workspaces");
  const listRes = await getWorkspaces(listReq);
  const listBody = await listRes.json();
  const containsArchived = listBody.data?.some((w: any) => w.id === targetWorkspaceId);
  check(!containsArchived, "5.1 GET /api/workspaces omits archived organization from active list");

  // 5.2 GET /api/workspaces?includeArchived=true includes archived organizations
  const listAllReq = new NextRequest("http://localhost:3000/api/workspaces?includeArchived=true");
  const listAllRes = await getWorkspaces(listAllReq);
  const listAllBody = await listAllRes.json();
  const containsArchivedWhenRequested = listAllBody.data?.some((w: any) => w.id === targetWorkspaceId);
  check(
    containsArchivedWhenRequested,
    "5.2 GET /api/workspaces?includeArchived=true includes archived workspaces for audit reviews"
  );

  // 5.3 Creating submissions on an archived workspace is strictly blocked
  __setTestSessionOverride({
    userId: adminUserId,
    userName: "Admin Sarah",
    userEmail: "sarah@lumina.com",
    role: "admin",
    workspaceId: targetWorkspaceId,
    workspaceSlug: targetOrgSlug,
    isAuthenticated: true,
    isDemoFallback: false,
  });

  const subReq = new NextRequest("http://localhost:3000/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "New Marketing Campaign",
      content: "Clinically proven to reduce wrinkles in 2 weeks",
      channel: "Instagram",
    }),
  });

  const subRes = await postSubmission(subReq);
  check(subRes.status === 403, "5.3 Submission creation on archived workspace blocked with HTTP 403 Forbidden");

  // -------------------------------------------------------------------------
  // Suite 6: Atomic Transaction Rollback on Failure
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 6: Transaction Atomicity & Failure Rollback ---");
  resetMockDb();

  // Temporarily force query error when updating memberships
  let queryCount = 0;
  __setTestQueryOverride(async (sql: string, params: unknown[] = []) => {
    const s = sql.toLowerCase();
    if (s.includes("from workspaces") && s.includes("where id = $1")) {
      return { rows: [mockWorkspaces[0]] };
    }
    if (s.includes("from workspace_memberships") && s.includes("workspace_id = $1 and user_id = $2")) {
      return { rows: [mockMemberships[0]] };
    }
    if (s.includes("update workspaces")) {
      // Simulate workspace update
      return { rows: [] };
    }
    if (s.includes("update workspace_memberships")) {
      // Simulated database network failure during membership suspension
      throw new Error("Simulated database connection failure during membership suspension");
    }
    return { rows: [] };
  });

  const failReq = new NextRequest(`http://localhost:3000/api/workspaces/${targetWorkspaceId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName: targetOrgName }),
  });

  const failRes = await deleteWorkspace(failReq, { params: Promise.resolve({ id: targetWorkspaceId }) });
  const failBody = await failRes.json();

  check(failRes.status === 500, "6.1 Database failure returns HTTP 500");
  check(!!failBody.correlationId, "6.2 Returns sanitized correlationId for audit telemetry", failBody.correlationId);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log(` RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${passedCount + failedCount})`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal exception:", err);
  process.exit(1);
});
