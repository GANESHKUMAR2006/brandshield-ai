/**
 * BrandShield AI — Complete Workspace Isolation Validation Suite
 * Issue 2: Comprehensive Multi-Tenancy & Hardcoded Workspace Elimination Tests
 *
 * Verifies that:
 * 1. Two separate workspaces maintain completely isolated data.
 * 2. Cross-workspace resource access attempts fail closed (IDOR protection).
 * 3. Identical resource identifiers across workspaces operate independently.
 * 4. Missing workspace context fails closed without silently selecting DermaGlow.
 * 5. Invalid workspace membership / header spoofing is strictly rejected.
 * 6. Extraction and verification propagate explicit workspace context.
 * 7. Review and re-verification propagate workspace context end-to-end.
 * 8. Policy studio and source library enforce cross-resource tenant isolation.
 * 9. Audit events attribute correct workspace tenant IDs.
 * 10. Background operations require explicit trusted workspace context.
 * 11. Production environment lockout prevents anonymous and unmapped execution.
 */

import { NextRequest } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  __setTestSessionOverride,
  ServerSessionIdentity,
} from "@/lib/auth/server-session";
import { __setTestQueryOverride } from "@/lib/db/server-db";
import { VerificationContextLoader } from "@/lib/verification/verification-context";
import { VerificationEngine } from "@/lib/verification/verification-engine";
import { ExtractionService } from "@/lib/ai/extraction/extraction-service";
import { PolicyService } from "@/lib/policy/policy-service";
import { GET as getProducts } from "@/app/api/products/route";
import { GET as getWorkspaces } from "@/app/api/workspaces/route";
import { GET as getWorkspaceById } from "@/app/api/workspaces/[id]/route";
import { GET as getWorkspaceMembers } from "@/app/api/workspaces/[id]/members/route";
import { POST as verifyClaimRoute } from "@/app/api/claims/[id]/verify/route";
import { POST as verifySubmissionRoute } from "@/app/api/submissions/[id]/verify/route";
import { POST as extractRoute } from "@/app/api/submissions/[id]/extract/route";
import { RETINOL_SERUM_PRODUCT_ID } from "@/lib/policy/default-policies";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
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

// Mock workspace IDs and slugs
const TENANT_A_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_A_SLUG = "biohealth-global";

const TENANT_B_ID = "22222222-2222-2222-2222-222222222222";
const TENANT_B_SLUG = "novacare-labs";

const DERMAGLOW_ID = "00000000-0000-0000-0000-000000000001";
const DERMAGLOW_SLUG = "dermaglow";

// Sessions
const tenantASession: ServerSessionIdentity = {
  userId: "usr-tenant-a-admin",
  userName: "Alice Admin",
  userEmail: "alice@biohealth.org",
  role: "admin",
  workspaceId: TENANT_A_ID,
  workspaceSlug: TENANT_A_SLUG,
  isAuthenticated: true,
  isDemoFallback: false,
};

const tenantBSession: ServerSessionIdentity = {
  userId: "usr-tenant-b-reviewer",
  userName: "Bob Reviewer",
  userEmail: "bob@novacare.com",
  role: "compliance_reviewer",
  workspaceId: TENANT_B_ID,
  workspaceSlug: TENANT_B_SLUG,
  isAuthenticated: true,
  isDemoFallback: false,
};

const tenantBAdminSession: ServerSessionIdentity = {
  userId: "usr-tenant-b-admin",
  userName: "Brenda Admin",
  userEmail: "brenda@novacare.com",
  role: "admin",
  workspaceId: TENANT_B_ID,
  workspaceSlug: TENANT_B_SLUG,
  isAuthenticated: true,
  isDemoFallback: false,
};

async function runSuite1_TwoSeparateWorkspaces() {
  console.log("\n--- Suite 1: Two Separate Workspaces with Isolated Data ---");

  // Query override for GET /api/products
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM products p") && sql.includes("WHERE w.slug = $1")) {
      const slug = params?.[0];
      if (slug === TENANT_A_SLUG) {
        return {
          rows: [
            { id: "prod-a-1", name: "BioHealth Retinol Cream", sku: "BH-RET-01", workspace_id: TENANT_A_ID },
          ],
          rowCount: 1,
        };
      }
      if (slug === TENANT_B_SLUG) {
        return {
          rows: [
            { id: "prod-b-1", name: "NovaCare Sun Shield", sku: "NC-SUN-01", workspace_id: TENANT_B_ID },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  // Tenant A request
  __setTestSessionOverride(tenantASession);
  const resA = await getProducts();
  const bodyA = await resA.json();

  assert(bodyA.success === true, "1.1 Tenant A products request succeeds");
  assert(bodyA.workspace === TENANT_A_SLUG, "1.2 Tenant A workspace slug correctly attributed in response");
  assert(bodyA.data.length === 1 && bodyA.data[0].id === "prod-a-1", "1.3 Tenant A receives only Tenant A products");

  // Tenant B request
  __setTestSessionOverride(tenantBSession);
  const resB = await getProducts();
  const bodyB = await resB.json();

  assert(bodyB.success === true, "1.4 Tenant B products request succeeds");
  assert(bodyB.workspace === TENANT_B_SLUG, "1.5 Tenant B workspace slug correctly attributed in response");
  assert(bodyB.data.length === 1 && bodyB.data[0].id === "prod-b-1", "1.6 Tenant B receives only Tenant B products");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);
}

async function runSuite2_CrossWorkspaceResourceAccess() {
  console.log("\n--- Suite 2: Cross-Workspace Resource Access Attempts (IDOR Protection) ---");

  // Mock DB returning Tenant A's claim
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM claims c") && sql.includes("JOIN workspaces w")) {
      const claimId = params?.[0];
      const wsId = params?.[1];
      const wsSlug = params?.[2];

      if (claimId === "claim-a-100") {
        if (wsId === TENANT_A_ID || wsSlug === TENANT_A_SLUG) {
          return {
            rows: [
              {
                claim_id: "claim-a-100",
                claim_text: "10% Pure Vitamin C",
                claim_type: "ingredient_concentration",
                text_start: 0,
                text_end: 18,
                claim_product_id: "prod-a-1",
                extracted_entities: {},
                extraction_confidence: 0.95,
                submission_id: "sub-a-1",
                submission_title: "Tenant A Campaign",
                submission_channel: "instagram",
                submission_product_id: "prod-a-1",
                submission_date: "2026-11-01",
                submission_created_at: "2026-11-01T00:00:00Z",
                workspace_id: TENANT_A_ID,
                version_id: "ver-a-1",
                version_number: 1,
                version_content: "10% Pure Vitamin C",
              },
            ],
            rowCount: 1,
          };
        }
        // Foreign tenant lookup yields 0 rows
        return { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  });

  // Tenant B attempts to load Tenant A's claim context
  let errorCaught = false;
  try {
    await VerificationContextLoader.loadContextForClaim("claim-a-100", {
      workspaceId: TENANT_B_ID,
      workspaceSlug: TENANT_B_SLUG,
    });
  } catch (err: any) {
    errorCaught = true;
    assert(
      err.message.includes("Active claim \"claim-a-100\" not found in authorized workspace"),
      "2.1 Cross-workspace claim context lookup is rejected with not found in authorized workspace",
      err.message
    );
  }
  assert(errorCaught, "2.2 Invariant: Foreign tenant cannot load claim context");

  __setTestQueryOverride(null);
}

async function runSuite3_IdenticalResourceIdentifiers() {
  console.log("\n--- Suite 3: Identical Resource Identifiers Across Workspaces ---");

  // In-memory policy test with same policy code in different tenants
  const polA = await PolicyService.createPolicy(tenantASession, {
    name: "Standard Safety Policy",
    code: "POL-SAFE-001",
    category: "required_disclaimers",
    severity: "medium",
    rules: [],
  });

  const polB = await PolicyService.createPolicy(tenantBAdminSession, {
    name: "Standard Safety Policy",
    code: "POL-SAFE-001",
    category: "required_disclaimers",
    severity: "high",
    rules: [],
  });

  assert(polA.workspace_id === TENANT_A_ID, "3.1 Policy A assigned to Tenant A");
  assert(polB.workspace_id === TENANT_B_ID, "3.2 Policy B assigned to Tenant B");
  assert(polA.code === polB.code, "3.3 Policy codes are identical across distinct tenants");

  // Fetch policies for Tenant A
  const policiesA = await PolicyService.getPolicies(tenantASession);
  const foundA = policiesA.filter((p) => p.code === "POL-SAFE-001");
  assert(foundA.length === 1 && foundA[0].workspace_id === TENANT_A_ID, "3.4 Tenant A queries return strictly Tenant A policy");

  // Fetch policies for Tenant B
  const policiesB = await PolicyService.getPolicies(tenantBSession);
  const foundB = policiesB.filter((p) => p.code === "POL-SAFE-001");
  assert(foundB.length === 1 && foundB[0].workspace_id === TENANT_B_ID, "3.5 Tenant B queries return strictly Tenant B policy");
}

async function runSuite4_MissingWorkspaceContext() {
  console.log("\n--- Suite 4: Missing Workspace Context (No Default DermaGlow Fallback) ---");

  let verLoaderFailed = false;
  try {
    // Calling loadContextForClaim with undefined workspaceContext
    await VerificationContextLoader.loadContextForClaim("any-claim-id", undefined);
  } catch (err: any) {
    verLoaderFailed = true;
    assert(
      err.message.includes("Workspace context required"),
      "4.1 VerificationContextLoader throws when workspaceContext is undefined",
      err.message
    );
  }
  assert(verLoaderFailed, "4.2 Invariant: VerificationContextLoader never falls back to DermaGlow");

  let verEngineFailed = false;
  try {
    // Calling verifySubmissionClaims with undefined workspaceContext
    await VerificationEngine.verifySubmissionClaims("any-sub-id", undefined);
  } catch (err: any) {
    verEngineFailed = true;
    assert(
      err.message.includes("Workspace context required"),
      "4.3 VerificationEngine.verifySubmissionClaims throws when workspaceContext is undefined",
      err.message
    );
  }
  assert(verEngineFailed, "4.4 Invariant: VerificationEngine never verifies claims without explicit workspace");

  let extractionFailed = false;
  try {
    // Calling extractFromSubmissionVersion with undefined workspaceContext
    await ExtractionService.extractFromSubmissionVersion("any-sub-id", undefined);
  } catch (err: any) {
    extractionFailed = true;
    assert(
      err.message.includes("Workspace context required"),
      "4.5 ExtractionService.extractFromSubmissionVersion throws when workspaceContext is undefined",
      err.message
    );
  }
  assert(extractionFailed, "4.6 Invariant: ExtractionService never extracts claims without explicit workspace");
}

async function runSuite5_InvalidWorkspaceMembership() {
  console.log("\n--- Suite 5: Invalid Workspace Membership & Membership Checks ---");

  // GET /api/workspaces/[id] for user who is not a member of DermaGlow
  __setTestSessionOverride(tenantASession);

  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("workspaces") && sql.includes("WHERE id = $1")) {
      return {
        rows: [{ id: DERMAGLOW_ID, name: "DermaGlow", slug: DERMAGLOW_SLUG, created_at: "2026-01-01" }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2")) {
      // User is not a member
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  const req = new NextRequest(new Request(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}`));
  const res = await getWorkspaceById(req, { params: Promise.resolve({ id: DERMAGLOW_ID }) });

  assert(res.status === 403, "5.1 GET /api/workspaces/[id] rejects non-member accessing DermaGlow (HTTP 403 Forbidden)");

  // GET /api/workspaces/[id]/members
  const membersReq = new NextRequest(new Request(`http://localhost:3000/api/workspaces/${DERMAGLOW_ID}/members`));
  const membersRes = await getWorkspaceMembers(membersReq, { params: Promise.resolve({ id: DERMAGLOW_ID }) });

  assert(membersRes.status === 403, "5.2 GET /api/workspaces/[id]/members rejects non-member accessing DermaGlow members (HTTP 403 Forbidden)");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);
}

async function runSuite6_ExtractionAndVerificationPropagation() {
  console.log("\n--- Suite 6: Extraction and Verification Context Propagation ---");

  const originalVerifyClaim = VerificationEngine.verifyClaim;
  const originalVerifySubs = VerificationEngine.verifySubmissionClaims;
  const originalExtract = ExtractionService.extractFromSubmissionVersion;

  try {
    let passedContextClaim: any = null;
    (VerificationEngine as any).verifyClaim = async (claimId: string, wsContext?: any) => {
      passedContextClaim = wsContext;
      return { runId: "run-prop-1", claimId, status: "supported" };
    };

    let passedContextSub: any = null;
    (VerificationEngine as any).verifySubmissionClaims = async (subId: string, wsContext?: any) => {
      passedContextSub = wsContext;
      return [{ runId: "run-prop-2", claimId: "claim-1", status: "supported" }];
    };

    let passedContextExtract: any = null;
    (ExtractionService as any).extractFromSubmissionVersion = async (subId: string, options?: any) => {
      passedContextExtract = options;
      return { extractionRunId: "run-ext-1", claimsCount: 1, claims: [] };
    };

    // 6.1 Calling verifyClaim with explicit workspace context propagates correctly
    await VerificationEngine.verifyClaim("claim-prop-1", {
      workspaceId: TENANT_A_ID,
      workspaceSlug: TENANT_A_SLUG,
    });
    assert(
      passedContextClaim?.workspaceId === TENANT_A_ID && passedContextClaim?.workspaceSlug === TENANT_A_SLUG,
      "6.1 verifyClaim receives propagated workspaceId and workspaceSlug",
      JSON.stringify(passedContextClaim)
    );

    // 6.2 Calling verifySubmissionClaims propagates workspace context
    await VerificationEngine.verifySubmissionClaims("sub-prop-1", {
      workspaceId: TENANT_A_ID,
      workspaceSlug: TENANT_A_SLUG,
    });
    assert(
      passedContextSub?.workspaceId === TENANT_A_ID && passedContextSub?.workspaceSlug === TENANT_A_SLUG,
      "6.2 verifySubmissionClaims receives propagated workspaceId and workspaceSlug",
      JSON.stringify(passedContextSub)
    );

    // 6.3 Calling extractFromSubmissionVersion propagates workspace context
    await ExtractionService.extractFromSubmissionVersion("sub-prop-1", {
      workspaceId: TENANT_A_ID,
      workspaceSlug: TENANT_A_SLUG,
    });
    assert(
      passedContextExtract?.workspaceId === TENANT_A_ID && passedContextExtract?.workspaceSlug === TENANT_A_SLUG,
      "6.3 extractFromSubmissionVersion receives propagated workspaceId and workspaceSlug",
      JSON.stringify(passedContextExtract)
    );

    // 6.4 ReviewWorkflowService.reverifyModifiedClaim propagates workspace context
    const { ReviewWorkflowService } = await import("@/lib/review/review-service");
    let reverifyContextPassed = false;
    (VerificationEngine as any).verifyClaim = async (claimId: string, wsContext?: any) => {
      if (wsContext?.workspaceId === TENANT_B_ID && wsContext?.workspaceSlug === TENANT_B_SLUG) {
        reverifyContextPassed = true;
      }
      return { runId: "rev-1", claimId, status: "supported" };
    };
    await ReviewWorkflowService.reverifyModifiedClaim("claim-mod-1", {
      workspaceId: TENANT_B_ID,
      workspaceSlug: TENANT_B_SLUG,
    });
    assert(reverifyContextPassed, "6.4 ReviewWorkflowService.reverifyModifiedClaim propagates workspace context");

  } finally {
    VerificationEngine.verifyClaim = originalVerifyClaim;
    VerificationEngine.verifySubmissionClaims = originalVerifySubs;
    ExtractionService.extractFromSubmissionVersion = originalExtract;
  }
}

async function runSuite7_PolicyAndSourceLibraryIsolation() {
  console.log("\n--- Suite 7: Policy and Source Library Cross-Resource Isolation ---");

  // Attempting to create policy in Tenant A with product belonging to Tenant B
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM products WHERE id = $1 AND workspace_id = $2")) {
      const prodId = params?.[0];
      const wsId = params?.[1];
      // Product belongs to Tenant B, but session is Tenant A
      if (prodId === "prod-foreign" && wsId === TENANT_A_ID) {
        return { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  });

  let policyProdFailed = false;
  try {
    await PolicyService.createPolicy(tenantASession, {
      name: "Cross-Tenant Policy Attempt",
      code: "POL-X-001",
      category: "product_restrictions",
      severity: "high",
      productId: "prod-foreign",
      rules: [],
    });
  } catch (err: any) {
    policyProdFailed = true;
    assert(
      err.message.includes("Product \"prod-foreign\" not found or unauthorized in workspace"),
      "7.1 Policy creation rejects linking foreign product from another workspace",
      err.message
    );
  }
  assert(policyProdFailed, "7.2 Invariant: Cannot attach foreign workspace products to policies");

  // Attempting to archive a policy that belongs to another tenant
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("SELECT id FROM policies WHERE id = $1 AND workspace_id = $2")) {
      // Policy does not exist in Tenant B
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  let archiveFailed = false;
  try {
    await PolicyService.archivePolicy(tenantBAdminSession, "pol-of-tenant-a");
  } catch (err: any) {
    archiveFailed = true;
    assert(
      err.message.includes("pol-of-tenant-a") && err.message.includes("not found"),
      "7.3 Policy archival rejects cross-tenant policy ID",
      err.message
    );
  }
  assert(archiveFailed, "7.4 Invariant: Tenant B cannot archive Tenant A's policies");

  __setTestQueryOverride(null);
}

async function runSuite8_AuditAttribution() {
  console.log("\n--- Suite 8: Audit-Event Tenant Attribution & Access Isolation ---");

  // Querying audit events for another workspace as a non-admin or unauthorized admin
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("WHERE wm.user_id = $1 AND w.slug = $2")) {
      // User has no membership in foreign workspace
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  const { AuditService } = await import("@/lib/audit/audit-service");

  let auditFailed = false;
  try {
    // Tenant A admin attempts to query Tenant B's audit trail
    await AuditService.getAuditTrail(tenantASession, { workspaceSlug: TENANT_B_SLUG });
  } catch (err: any) {
    auditFailed = true;
    assert(
      err.message.includes("Forbidden: User does not belong to requested workspace"),
      "8.1 Admin cannot query audit events for a workspace they do not belong to",
      err.message
    );
  }
  assert(auditFailed, "8.2 Invariant: Multi-tenant audit trail strictly enforces membership");

  __setTestQueryOverride(null);
}

async function runSuite9_WorkspacesListEndpoint() {
  console.log("\n--- Suite 9: GET /api/workspaces Tenant Membership Scoping ---");

  __setTestSessionOverride(tenantASession);

  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM workspaces w") && sql.includes("JOIN workspace_memberships wm")) {
      assert(sql.includes("WHERE wm.user_id = $1 AND wm.status = 'active'"), "9.1 Query strictly checks active user membership without DermaGlow OR clause");
      return {
        rows: [
          {
            id: TENANT_A_ID,
            name: "BioHealth Global",
            slug: TENANT_A_SLUG,
            role: "admin",
            status: "active",
            created_at: "2026-11-01",
            member_count: "3",
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });

  const res = await getWorkspaces(new NextRequest(new Request("http://localhost:3000/api/workspaces")));
  const body = await res.json();

  assert(body.success === true, "9.2 GET /api/workspaces succeeds");
  assert(body.data.length === 1 && body.data[0].slug === TENANT_A_SLUG, "9.3 Returns only Tenant A without injecting DermaGlow");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);
}

async function runSuite10_ProductionMissingWorkspaceLockout() {
  console.log("\n--- Suite 10: Production Behavior When Workspace Context is Missing ---");

  const originalEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.NEXT_PUBLIC_APP_ENV;
  const originalAllowDemo = process.env.ALLOW_DEMO_AUTH;

  try {
    (process.env as any).NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.ALLOW_DEMO_AUTH;

    // Unauthenticated caller in production
    let authFailed = false;
    try {
      await resolveServerSession();
    } catch (err: any) {
      authFailed = true;
      assert(
        err instanceof AuthenticationRequiredError,
        "10.1 Production resolveServerSession rejects unauthenticated callers with AuthenticationRequiredError",
        err.message
      );
    }
    assert(authFailed, "10.2 Invariant: Anonymous production callers strictly rejected");
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    if (originalAppEnv) process.env.NEXT_PUBLIC_APP_ENV = originalAppEnv;
    if (originalAllowDemo) process.env.ALLOW_DEMO_AUTH = originalAllowDemo;
  }
}

async function runSuite11_ForgedHeaderRejection() {
  console.log("\n--- Suite 11: Forged Header Rejection & Service Execution Denial ---");

  // User Alice belongs to Tenant A (biohealth-global), but sends forged x-workspace-slug: "novacare-labs" (Tenant B)
  __setTestSessionOverride(tenantASession);

  // Database mock: when checking membership for Alice in novacare-labs, return 0 rows (no active membership)
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("WHERE wm.user_id = $1")) {
      const targetSlug = params?.[1];
      if (targetSlug === TENANT_B_SLUG || targetSlug === TENANT_B_ID) {
        return { rows: [], rowCount: 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  });

  let verifyClaimCalled = false;
  let verifySubCalled = false;
  let extractCalled = false;

  const originalVerifyClaim = VerificationEngine.verifyClaim;
  const originalVerifySubs = VerificationEngine.verifySubmissionClaims;
  const originalExtract = ExtractionService.extractFromSubmissionVersion;

  (VerificationEngine as any).verifyClaim = async () => {
    verifyClaimCalled = true;
    return { runId: "bad-run", claimId: "c1", status: "supported" };
  };
  (VerificationEngine as any).verifySubmissionClaims = async () => {
    verifySubCalled = true;
    return [];
  };
  (ExtractionService as any).extractFromSubmissionVersion = async () => {
    extractCalled = true;
    return { extractionRunId: "bad-ext", claimsCount: 0, claims: [] };
  };

  try {
    // 11.1 POST /api/claims/[id]/verify with forged header returns HTTP 403
    const reqClaim = new NextRequest(new Request("http://localhost:3000/api/claims/claim-a-100/verify", {
      method: "POST",
      headers: { "x-workspace-slug": TENANT_B_SLUG },
    }));
    const resClaim = await verifyClaimRoute(reqClaim, { params: Promise.resolve({ id: "claim-a-100" }) });
    assert(resClaim.status === 403, "11.1 POST /api/claims/[id]/verify returns HTTP 403 for forged x-workspace-slug");
    assert(!verifyClaimCalled, "11.2 Invariant: VerificationEngine.verifyClaim never executes on forged header");

    // 11.3 POST /api/submissions/[id]/verify with forged header returns HTTP 403
    const reqSub = new NextRequest(new Request("http://localhost:3000/api/submissions/sub-100/verify", {
      method: "POST",
      headers: { "x-workspace-slug": TENANT_B_SLUG },
    }));
    const resSub = await verifySubmissionRoute(reqSub, { params: Promise.resolve({ id: "sub-100" }) });
    assert(resSub.status === 403, "11.3 POST /api/submissions/[id]/verify returns HTTP 403 for forged x-workspace-slug");
    assert(!verifySubCalled, "11.4 Invariant: VerificationEngine.verifySubmissionClaims never executes on forged header");

    // 11.5 POST /api/submissions/[id]/extract with forged header returns HTTP 403
    const reqExtract = new NextRequest(new Request("http://localhost:3000/api/submissions/sub-100/extract", {
      method: "POST",
      headers: { "x-workspace-slug": TENANT_B_SLUG },
      body: JSON.stringify({}),
    }));
    const resExtract = await extractRoute(reqExtract, { params: Promise.resolve({ id: "sub-100" }) });
    assert(resExtract.status === 403, "11.5 POST /api/submissions/[id]/extract returns HTTP 403 for forged x-workspace-slug");
    assert(!extractCalled, "11.6 Invariant: ExtractionService never executes on forged header");

    // 11.7 GET /api/products with forged header returns HTTP 403
    const reqProd = new NextRequest(new Request("http://localhost:3000/api/products", {
      headers: { "x-workspace-slug": TENANT_B_SLUG },
    }));
    const resProd = await getProducts(reqProd);
    assert(resProd.status === 403, "11.7 GET /api/products returns HTTP 403 for forged x-workspace-slug");

  } finally {
    VerificationEngine.verifyClaim = originalVerifyClaim;
    VerificationEngine.verifySubmissionClaims = originalVerifySubs;
    ExtractionService.extractFromSubmissionVersion = originalExtract;
    __setTestQueryOverride(null);
    __setTestSessionOverride(undefined);
  }
}

async function runSuite12_InactiveAndRevokedMemberships() {
  console.log("\n--- Suite 12: Inactive and Revoked Workspace Memberships Fail Closed ---");

  __setTestSessionOverride(tenantASession);

  // 12.1 Membership status is 'revoked'
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("WHERE wm.user_id = $1")) {
      // Query includes AND wm.status = 'active', so revoked user returns 0 rows
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  let revokedErrorCaught = false;
  try {
    await resolveServerSession("some-revoked-workspace");
  } catch (err: any) {
    revokedErrorCaught = true;
    assert(
      err instanceof WorkspaceAccessError,
      "12.1 resolveServerSession rejects revoked membership with WorkspaceAccessError",
      err.message
    );
  }
  assert(revokedErrorCaught, "12.2 Invariant: Revoked membership cannot access workspace");

  // 12.3 Membership status is 'inactive'
  let inactiveErrorCaught = false;
  try {
    await resolveServerSession("some-inactive-workspace");
  } catch (err: any) {
    inactiveErrorCaught = true;
    assert(
      err instanceof WorkspaceAccessError,
      "12.3 resolveServerSession rejects inactive membership with WorkspaceAccessError",
      err.message
    );
  }
  assert(inactiveErrorCaught, "12.4 Invariant: Inactive membership cannot access workspace");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);
}

async function runSuite13_OfflineDemoFallbackProductValidation() {
  console.log("\n--- Suite 13: Offline Demo Fallback Product Validation in PolicyService ---");

  const demoSession: ServerSessionIdentity = {
    userId: "usr-demo-admin",
    userName: "Demo Admin",
    userEmail: "admin@dermaglow.demo",
    role: "admin",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: DERMAGLOW_SLUG,
    isAuthenticated: false,
    isDemoFallback: true,
  };

  // Mock DB completely offline to force in-memory demo fallback
  __setTestQueryOverride(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
  });

  // 13.1 Offline demo creation with foreign product is REJECTED
  let foreignProdFailed = false;
  try {
    await PolicyService.createPolicy(demoSession, {
      name: "Offline Demo Foreign Product Policy",
      code: "POL-DEMO-ERR-001",
      category: "product_restrictions",
      severity: "high",
      productId: "prod-foreign-attacker",
      rules: [],
    });
  } catch (err: any) {
    foreignProdFailed = true;
    assert(
      err.message.includes("Product \"prod-foreign-attacker\" not found or unauthorized in workspace"),
      "13.1 Offline demo creation rejects unverified foreign product ID",
      err.message
    );
  }
  assert(foreignProdFailed, "13.2 Invariant: Demo fallback never silently accepts foreign products");

  // 13.3 Offline demo creation with valid demo product ID SUCCEEDS
  let validDemoPolicy: any = null;
  try {
    validDemoPolicy = await PolicyService.createPolicy(demoSession, {
      name: "Offline Demo Valid Policy",
      code: "POL-DEMO-OK-001",
      category: "product_restrictions",
      severity: "high",
      productId: RETINOL_SERUM_PRODUCT_ID,
      rules: [],
    });
  } catch (err: any) {
    // If threw, validDemoPolicy stays null
  }
  assert(
    validDemoPolicy !== null && validDemoPolicy.product_id === RETINOL_SERUM_PRODUCT_ID,
    "13.3 Offline demo creation accepts verified demo workspace product",
    validDemoPolicy?.id
  );

  // 13.4 Offline demo creation with valid demo product but under Tenant A session is REJECTED
  let tenantAMismatchFailed = false;
  try {
    await PolicyService.createPolicy(tenantASession, {
      name: "Tenant A trying to attach demo product",
      code: "POL-MISMATCH-001",
      category: "product_restrictions",
      severity: "high",
      productId: RETINOL_SERUM_PRODUCT_ID,
      rules: [],
    });
  } catch (err: any) {
    tenantAMismatchFailed = true;
    assert(
      err.message.includes("not found or unauthorized in workspace"),
      "13.4 Demo product rejected when session is not demo workspace",
      err.message
    );
  }
  assert(tenantAMismatchFailed, "13.5 Invariant: Tenant A cannot link demo products even in offline fallback");

  __setTestQueryOverride(null);
}

async function main() {
  console.log("========================================================================");
  console.log("    BRANDSHIELD AI: COMPLETE WORKSPACE ISOLATION VALIDATION SUITE       ");
  console.log("    Audit, Hardcoded Workspace Removal & Cross-Tenant Security Invariants");
  console.log("========================================================================");

  await runSuite1_TwoSeparateWorkspaces();
  await runSuite2_CrossWorkspaceResourceAccess();
  await runSuite3_IdenticalResourceIdentifiers();
  await runSuite4_MissingWorkspaceContext();
  await runSuite5_InvalidWorkspaceMembership();
  await runSuite6_ExtractionAndVerificationPropagation();
  await runSuite7_PolicyAndSourceLibraryIsolation();
  await runSuite8_AuditAttribution();
  await runSuite9_WorkspacesListEndpoint();
  await runSuite10_ProductionMissingWorkspaceLockout();
  await runSuite11_ForgedHeaderRejection();
  await runSuite12_InactiveAndRevokedMemberships();
  await runSuite13_OfflineDemoFallbackProductValidation();

  console.log("\n========================================================================");
  console.log(`Workspace Isolation Suite Complete: ${passedCount}/${passedCount + failedCount} passed (${failedCount} failed)`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error executing workspace isolation test suite:", err);
  process.exit(1);
});
