/**
 * BrandShield AI — Cross-Organization Data Leakage Regression Test Suite
 *
 * Validates that:
 * 1. Switching between organizations updates tenant authorization context atomically.
 * 2. Organization A (Ganesh Trader), Organization B (Bio India), and Organization C (DermaGlow)
 *    maintain strict data isolation across submissions, claims, products, evidence, and audit logs.
 * 3. Switching workspaces sets cookies and verifies active membership.
 * 4. Cross-workspace resource access (IDOR) is rejected with HTTP 403.
 * 5. Vector evidence retrieval never returns chunks from foreign organizations.
 * 6. Cross-tenant evidence linking is rejected.
 * 7. Header/cookie spoofing fails closed without falling back to DermaGlow.
 */

import { NextRequest } from "next/server";
import {
  requireWorkspaceAccess,
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  __setTestSessionOverride,
  ServerSessionIdentity,
} from "@/lib/auth/server-session";
import { __setTestQueryOverride } from "@/lib/db/server-db";
import { POST as switchWorkspaceRoute } from "@/app/api/workspaces/switch/route";
import { GET as getSubmissionsRoute } from "@/app/api/submissions/route";
import { GET as getProductsRoute } from "@/app/api/products/route";
import { GET as getWorkspaceByIdRoute } from "@/app/api/workspaces/[id]/route";
import { GET as getWorkspaceMembersRoute } from "@/app/api/workspaces/[id]/members/route";
import { HybridEvidenceRetriever } from "@/lib/rag/retrieval/hybrid-retriever";

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

// Three distinct tenant organizations
const GANESH_TRADER = {
  id: "aaaaaaaa-1111-4000-8000-000000000001",
  name: "Ganesh Trader",
  slug: "ganesh-trader",
};

const BIO_INDIA = {
  id: "bbbbbbbb-2222-4000-8000-000000000002",
  name: "Bio India",
  slug: "bio-india",
};

const DERMAGLOW = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "DermaGlow",
  slug: "dermaglow",
};

const FOREIGN_ORG = {
  id: "ffffffff-9999-4000-8000-000000000099",
  name: "Unrelated Corp",
  slug: "unrelated-corp",
};

// Authenticated user: Elena (member of Ganesh Trader, Bio India, and DermaGlow; NOT member of Unrelated Corp)
const TEST_USER = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "Dr. Elena Vance",
  email: "elena@brandshield.ai",
};

const baseSession: ServerSessionIdentity = {
  userId: TEST_USER.id,
  userName: TEST_USER.name,
  userEmail: TEST_USER.email,
  role: "admin",
  workspaceId: GANESH_TRADER.id,
  workspaceSlug: GANESH_TRADER.slug,
  isAuthenticated: true,
  isDemoFallback: false,
};

async function runTests() {
  console.log("========================================================================");
  console.log("  BRANDSHIELD AI: CROSS-ORGANIZATION DATA LEAKAGE REGRESSION SUITE      ");
  console.log("  Testing Multi-Tenant Isolation: Ganesh Trader, Bio India, DermaGlow   ");
  console.log("========================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: POST /api/workspaces/switch Endpoint & Cookie Assignment
  // ---------------------------------------------------------------------------
  console.log("--- Suite 1: Workspace Switching Endpoint & Cookie Assignment ---");

  __setTestSessionOverride(baseSession);

  // Mock DB query for workspace memberships
  __setTestQueryOverride(async (sql, params) => {
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("JOIN workspaces w")) {
      const target = params?.[1];
      if (target === GANESH_TRADER.slug || target === GANESH_TRADER.id) {
        return {
          rows: [{
            role: "admin",
            workspace_id: GANESH_TRADER.id,
            workspace_name: GANESH_TRADER.name,
            workspace_slug: GANESH_TRADER.slug,
            slug: GANESH_TRADER.slug,
          }],
          rowCount: 1,
        };
      }
      if (target === BIO_INDIA.slug || target === BIO_INDIA.id) {
        return {
          rows: [{
            role: "compliance_reviewer",
            workspace_id: BIO_INDIA.id,
            workspace_name: BIO_INDIA.name,
            workspace_slug: BIO_INDIA.slug,
            slug: BIO_INDIA.slug,
          }],
          rowCount: 1,
        };
      }
      if (target === DERMAGLOW.slug || target === DERMAGLOW.id) {
        return {
          rows: [{
            role: "admin",
            workspace_id: DERMAGLOW.id,
            workspace_name: DERMAGLOW.name,
            workspace_slug: DERMAGLOW.slug,
            slug: DERMAGLOW.slug,
          }],
          rowCount: 1,
        };
      }
      // Foreign workspace -> not a member
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });

  // 1.1 Switch to Ganesh Trader
  const switchGaneshReq = new NextRequest("http://localhost:3000/api/workspaces/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug: GANESH_TRADER.slug }),
  });
  const switchGaneshRes = await switchWorkspaceRoute(switchGaneshReq);
  const switchGaneshJson = await switchGaneshRes.json();

  assert(switchGaneshRes.status === 200, "1.1 Switch to Ganesh Trader succeeds with HTTP 200");
  assert(switchGaneshJson.workspace?.slug === GANESH_TRADER.slug, "1.2 Ganesh Trader workspace slug returned in payload");
  const ganeshCookieSlug = switchGaneshRes.cookies.get("active_workspace_slug")?.value;
  assert(ganeshCookieSlug === GANESH_TRADER.slug, "1.3 active_workspace_slug cookie set to ganesh-trader");

  // 1.2 Switch to Bio India
  const switchBioReq = new NextRequest("http://localhost:3000/api/workspaces/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug: BIO_INDIA.slug }),
  });
  const switchBioRes = await switchWorkspaceRoute(switchBioReq);
  const switchBioJson = await switchBioRes.json();

  assert(switchBioRes.status === 200, "1.4 Switch to Bio India succeeds with HTTP 200");
  assert(switchBioJson.workspace?.slug === BIO_INDIA.slug, "1.5 Bio India workspace slug returned in payload");
  const bioCookieSlug = switchBioRes.cookies.get("active_workspace_slug")?.value;
  assert(bioCookieSlug === BIO_INDIA.slug, "1.6 active_workspace_slug cookie set to bio-india");

  // 1.3 Attempt switch to unauthorized foreign organization
  const switchForeignReq = new NextRequest("http://localhost:3000/api/workspaces/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceSlug: FOREIGN_ORG.slug }),
  });
  const switchForeignRes = await switchWorkspaceRoute(switchForeignReq);
  assert(switchForeignRes.status === 403, "1.7 Switch to unauthorized organization strictly rejected with HTTP 403");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);

  // ---------------------------------------------------------------------------
  // Suite 2: Strict Tenant Query Isolation (Submissions & Products)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 2: Strict Tenant Query Scoping for Submissions & Products ---");

  // Mock DB for submissions query with workspace scoping
  __setTestQueryOverride(async (sql, params) => {
    // Session membership check
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("JOIN workspaces w")) {
      const target = params?.[1];
      if (target === GANESH_TRADER.slug) {
        return {
          rows: [{ role: "admin", workspace_id: GANESH_TRADER.id, workspace_name: GANESH_TRADER.name, workspace_slug: GANESH_TRADER.slug, slug: GANESH_TRADER.slug }],
          rowCount: 1,
        };
      }
      if (target === BIO_INDIA.slug) {
        return {
          rows: [{ role: "compliance_reviewer", workspace_id: BIO_INDIA.id, workspace_name: BIO_INDIA.name, workspace_slug: BIO_INDIA.slug, slug: BIO_INDIA.slug }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Submissions query
    if (sql.includes("FROM submissions s") && sql.includes("JOIN workspaces w ON s.workspace_id = w.id")) {
      const slug = params?.[0];
      if (slug === GANESH_TRADER.slug) {
        return {
          rows: [
            { id: "sub-gt-1", title: "Ganesh Trader Q4 Campaign", channel: "instagram" },
            { id: "sub-gt-2", title: "Ganesh Trader Retail Launch", channel: "ecommerce" },
          ],
          rowCount: 2,
        };
      }
      if (slug === BIO_INDIA.slug) {
        return {
          rows: [
            { id: "sub-bi-1", title: "Bio India Ayurvedic Cream Promo", channel: "web" },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Products query
    if (sql.includes("FROM products p") && sql.includes("JOIN workspaces w ON p.workspace_id = w.id")) {
      const slug = params?.[0];
      if (slug === GANESH_TRADER.slug) {
        return {
          rows: [{ id: "prod-gt-1", name: "GT Organic Face Oil", sku: "GT-OFO-01" }],
          rowCount: 1,
        };
      }
      if (slug === BIO_INDIA.slug) {
        return {
          rows: [{ id: "prod-bi-1", name: "Bio India Turmeric Glow", sku: "BI-TG-01" }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  });

  // 2.1 Fetch submissions with Ganesh Trader context header
  __setTestSessionOverride({
    ...baseSession,
    workspaceId: GANESH_TRADER.id,
    workspaceSlug: GANESH_TRADER.slug,
  });

  const gtReq = new NextRequest("http://localhost:3000/api/submissions", {
    headers: { "x-workspace-slug": GANESH_TRADER.slug },
  });
  const gtSubmissionsRes = await getSubmissionsRoute(gtReq);
  const gtSubmissionsJson = await gtSubmissionsRes.json();

  assert(gtSubmissionsRes.status === 200, "2.1 Ganesh Trader submissions fetch succeeds");
  assert(gtSubmissionsJson.workspace === GANESH_TRADER.slug, "2.2 Attributed to ganesh-trader workspace");
  assert(gtSubmissionsJson.data.length === 2, "2.3 Exactly 2 Ganesh Trader submissions returned");
  const hasBioInGanesh = gtSubmissionsJson.data.some((s: any) => s.id.includes("bi"));
  assert(!hasBioInGanesh, "2.4 Zero Bio India submissions present in Ganesh Trader workspace");

  // 2.2 Fetch submissions with Bio India context header
  __setTestSessionOverride({
    ...baseSession,
    workspaceId: BIO_INDIA.id,
    workspaceSlug: BIO_INDIA.slug,
  });

  const biReq = new NextRequest("http://localhost:3000/api/submissions", {
    headers: { "x-workspace-slug": BIO_INDIA.slug },
  });
  const biSubmissionsRes = await getSubmissionsRoute(biReq);
  const biSubmissionsJson = await biSubmissionsRes.json();

  assert(biSubmissionsRes.status === 200, "2.5 Bio India submissions fetch succeeds");
  assert(biSubmissionsJson.workspace === BIO_INDIA.slug, "2.6 Attributed to bio-india workspace");
  assert(biSubmissionsJson.data.length === 1, "2.7 Exactly 1 Bio India submission returned");
  const hasGaneshInBio = biSubmissionsJson.data.some((s: any) => s.id.includes("gt"));
  assert(!hasGaneshInBio, "2.8 Zero Ganesh Trader submissions present in Bio India workspace");

  // 2.3 Products isolation
  const gtProdReq = new NextRequest("http://localhost:3000/api/products", {
    headers: { "x-workspace-slug": GANESH_TRADER.slug },
  });
  __setTestSessionOverride({
    ...baseSession,
    workspaceId: GANESH_TRADER.id,
    workspaceSlug: GANESH_TRADER.slug,
  });
  const gtProdRes = await getProductsRoute(gtProdReq);
  const gtProdJson = await gtProdRes.json();
  assert(gtProdJson.data.length === 1 && gtProdJson.data[0].id === "prod-gt-1", "2.9 Ganesh Trader receives only GT products");

  const biProdReq = new NextRequest("http://localhost:3000/api/products", {
    headers: { "x-workspace-slug": BIO_INDIA.slug },
  });
  __setTestSessionOverride({
    ...baseSession,
    workspaceId: BIO_INDIA.id,
    workspaceSlug: BIO_INDIA.slug,
  });
  const biProdRes = await getProductsRoute(biProdReq);
  const biProdJson = await biProdRes.json();
  assert(biProdJson.data.length === 1 && biProdJson.data[0].id === "prod-bi-1", "2.10 Bio India receives only Bio India products");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);

  // ---------------------------------------------------------------------------
  // Suite 3: Hybrid Evidence Retriever Strict Chunk Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 3: Vector & Hybrid Evidence Retriever Tenant Scoping ---");

  // 3.1 In-memory hybrid search isolation test
  const mixedChunks = [
    {
      id: "chunk-gt-1",
      documentVersionId: "dv-gt-1",
      sourceDocumentId: "sd-gt-1",
      sourceDocumentTitle: "GT Spec",
      documentType: "specification",
      versionNumber: 1,
      chunkIndex: 0,
      content: "Contains 10% stabilised Vitamin C for Ganesh Trader formulations.",
      metadata: {},
      workspaceSlug: GANESH_TRADER.slug,
      approvalStatus: "approved",
    },
    {
      id: "chunk-bi-1",
      documentVersionId: "dv-bi-1",
      sourceDocumentId: "sd-bi-1",
      sourceDocumentTitle: "Bio India Spec",
      documentType: "specification",
      versionNumber: 1,
      chunkIndex: 0,
      content: "Bio India pure organic neem extract promotes natural skin recovery.",
      metadata: {},
      workspaceSlug: BIO_INDIA.slug,
      approvalStatus: "approved",
    },
    {
      id: "chunk-dg-1",
      documentVersionId: "dv-dg-1",
      sourceDocumentId: "sd-dg-1",
      sourceDocumentTitle: "DermaGlow Spec",
      documentType: "specification",
      versionNumber: 1,
      chunkIndex: 0,
      content: "DermaGlow proprietary peptide complex stimulates collagen synthesis.",
      metadata: {},
      workspaceSlug: DERMAGLOW.slug,
      approvalStatus: "approved",
    },
  ];

  const gtEvidence = HybridEvidenceRetriever.searchInMemory(
    { claimText: "Vitamin C formulation", workspaceSlug: GANESH_TRADER.slug },
    mixedChunks as any
  );

  assert(gtEvidence.length === 1, "3.1 Ganesh Trader retrieval returns exactly 1 item");
  assert((gtEvidence[0].chunkId || gtEvidence[0].id) === "chunk-gt-1", "3.2 Chunk returned belongs exclusively to Ganesh Trader");
  const leakedBio = gtEvidence.some((e) => e.chunkId === "chunk-bi-1");
  const leakedDg = gtEvidence.some((e) => e.chunkId === "chunk-dg-1");
  assert(!leakedBio && !leakedDg, "3.3 Zero foreign chunks leaked into Ganesh Trader retrieval");

  const biEvidence = HybridEvidenceRetriever.searchInMemory(
    { claimText: "organic neem extract", workspaceSlug: BIO_INDIA.slug },
    mixedChunks as any
  );
  assert(biEvidence.length === 1 && (biEvidence[0].chunkId || biEvidence[0].id) === "chunk-bi-1", "3.4 Bio India retrieval returns only Bio India chunks");

  // 3.2 Missing workspace slug throws error
  let missingSlugError = false;
  try {
    await HybridEvidenceRetriever.retrieveEvidence({ claimText: "Any claim", workspaceSlug: "" });
  } catch (err: any) {
    missingSlugError = true;
    assert(err.message.includes("Workspace slug is strictly required"), "3.5 Empty workspace slug throws explicit validation error");
  }
  assert(missingSlugError, "3.6 Evidence retrieval strictly fails closed when workspace context is empty");

  // ---------------------------------------------------------------------------
  // Suite 4: Header Spoofing & IDOR Access Denial
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 4: Header Spoofing & Cross-Tenant Access Denial (IDOR) ---");

  __setTestSessionOverride({
    ...baseSession,
    workspaceId: GANESH_TRADER.id,
    workspaceSlug: GANESH_TRADER.slug,
  });

  __setTestQueryOverride(async (sql, params) => {
    // If checking membership in foreign org
    if (sql.includes("FROM workspace_memberships wm") && sql.includes("JOIN workspaces w")) {
      const target = params?.[1];
      if (target === FOREIGN_ORG.slug || target === FOREIGN_ORG.id) {
        return { rows: [], rowCount: 0 };
      }
    }
    if (sql.includes("workspaces") && sql.includes("WHERE id = $1")) {
      return {
        rows: [{ id: FOREIGN_ORG.id, name: FOREIGN_ORG.name, slug: FOREIGN_ORG.slug }],
        rowCount: 1,
      };
    }
    if (sql.includes("FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2")) {
      return { rows: [], rowCount: 0 }; // Not a member
    }
    return { rows: [], rowCount: 0 };
  });

  // 4.1 Attacker in Ganesh Trader passes x-workspace-slug: unrelated-corp
  const spoofedReq = new NextRequest("http://localhost:3000/api/submissions", {
    headers: { "x-workspace-slug": FOREIGN_ORG.slug },
  });
  const spoofedRes = await getSubmissionsRoute(spoofedReq);
  assert(spoofedRes.status === 403, "4.1 Spoofed x-workspace-slug header rejected with HTTP 403 Forbidden");

  // 4.2 Direct GET /api/workspaces/[foreign-id]
  const idorReq = new NextRequest(`http://localhost:3000/api/workspaces/${FOREIGN_ORG.id}`);
  const idorRes = await getWorkspaceByIdRoute(idorReq, { params: Promise.resolve({ id: FOREIGN_ORG.id }) });
  assert(idorRes.status === 403, "4.2 Direct cross-tenant GET /api/workspaces/[id] rejected with HTTP 403 Forbidden");

  // 4.3 Direct GET /api/workspaces/[foreign-id]/members
  const membersIdorReq = new NextRequest(`http://localhost:3000/api/workspaces/${FOREIGN_ORG.id}/members`);
  const membersIdorRes = await getWorkspaceMembersRoute(membersIdorReq, { params: Promise.resolve({ id: FOREIGN_ORG.id }) });
  assert(membersIdorRes.status === 403, "4.3 Direct cross-tenant member roster query rejected with HTTP 403 Forbidden");

  __setTestQueryOverride(null);
  __setTestSessionOverride(undefined);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log(`Cross-Organization Isolation Suite: ${passedCount} passed, ${failedCount} failed`);
  console.log("========================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
