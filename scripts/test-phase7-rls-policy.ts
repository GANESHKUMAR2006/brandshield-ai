/**
 * BRANDSHIELD AI — PHASE 7 RLS POLICY TEST SUITE
 * Verification of Multi-Tenant Evidence Isolation, Source Completeness & Legacy Policy Transitions
 *
 * Runs completely in-memory, evaluating the exact SQL predicate semantics
 * of PostgreSQL Row Level Security (RLS) policies and table constraints.
 */

interface JWT {
  role?: string;
  app_metadata?: {
    workspace_slug?: string;
    workspace_id?: string;
    workspaces?: string[];
  };
}

interface Workspace {
  id: string;
  slug: string;
}

interface Submission {
  id: string;
  workspace_id: string;
}

interface Claim {
  id: string;
  submission_id: string;
}

interface Product {
  id: string;
  workspace_id: string;
}

interface ApprovedFact {
  id: string;
  product_id: string;
}

interface SourceDocument {
  id: string;
  workspace_id: string;
}

interface DocumentVersion {
  id: string;
  source_document_id: string;
}

interface ClaimEvidence {
  id: string;
  claim_id: string;
  document_version_id: string | null;
  approved_fact_id: string | null;
}

// Database Mock Universe
const workspaces: Workspace[] = [
  { id: "ws-native-01", slug: "dermaglow" },
  { id: "ws-foreign-02", slug: "competitor-pharma" },
];

const submissions: Submission[] = [
  { id: "sub-native-01", workspace_id: "ws-native-01" },
  { id: "sub-foreign-02", workspace_id: "ws-foreign-02" },
];

const claims: Claim[] = [
  { id: "claim-native-01", submission_id: "sub-native-01" },
  { id: "claim-foreign-02", submission_id: "sub-foreign-02" },
];

const products: Product[] = [
  { id: "prod-native-01", workspace_id: "ws-native-01" },
  { id: "prod-foreign-02", workspace_id: "ws-foreign-02" },
];

const approvedFacts: ApprovedFact[] = [
  { id: "fact-native-01", product_id: "prod-native-01" },
  { id: "fact-foreign-02", product_id: "prod-foreign-02" },
];

const sourceDocs: SourceDocument[] = [
  { id: "doc-native-01", workspace_id: "ws-native-01" },
  { id: "doc-foreign-02", workspace_id: "ws-foreign-02" },
];

const docVersions: DocumentVersion[] = [
  { id: "ver-native-01", source_document_id: "doc-native-01" },
  { id: "ver-foreign-02", source_document_id: "doc-foreign-02" },
];

/**
 * Simulates table-level constraint:
 * CHECK (document_version_id IS NOT NULL OR approved_fact_id IS NOT NULL)
 */
function evaluateTableSourceConstraint(row: ClaimEvidence): boolean {
  return row.document_version_id !== null || row.approved_fact_id !== null;
}

/**
 * Simulates PostgreSQL RLS WITH CHECK predicate for the UNCORRECTED (buggy) policy:
 * - Fails when document_version_id IS NULL because `NULL IN (SELECT ...)` evaluates to UNKNOWN (rejected).
 */
function evaluateUncorrectedInsertPolicy(jwt: JWT | null, row: ClaimEvidence): boolean {
  if (!jwt || jwt.role !== "authenticated") return false;

  const claim = claims.find((c) => c.id === row.claim_id);
  if (!claim) return false;
  const sub = submissions.find((s) => s.id === claim.submission_id);
  if (!sub) return false;
  const ws = workspaces.find((w) => w.id === sub.workspace_id);
  if (!ws) return false;

  const jwtSlug = jwt.app_metadata?.workspace_slug;
  const jwtWorkspaces = jwt.app_metadata?.workspaces || [];
  const jwtWsId = jwt.app_metadata?.workspace_id;
  const isWorkspaceMatch = ws.slug === jwtSlug || jwtWorkspaces.includes(ws.slug) || ws.id === jwtWsId;
  if (!isWorkspaceMatch) return false;

  // Clause 2: Buggy check - document_version_id IN (...) without NULL check
  if (row.document_version_id === null) {
    return false; // SQL UNKNOWN
  }

  const docVer = docVersions.find((dv) => dv.id === row.document_version_id);
  if (!docVer) return false;
  const doc = sourceDocs.find((sd) => sd.id === docVer.source_document_id);
  if (!doc) return false;

  return doc.workspace_id === sub.workspace_id;
}

/**
 * Simulates PostgreSQL RLS WITH CHECK predicate for the FINAL CORRECTED policy:
 * 1. Target claim belongs to authenticated user's workspace
 * 2. At least one valid evidence source must be present: (document_version_id IS NOT NULL OR approved_fact_id IS NOT NULL)
 * 3. When document_version_id is present, must match claim's workspace
 * 4. When approved_fact_id is present, must match claim's workspace
 */
function evaluateFinalCorrectedInsertPolicy(jwt: JWT | null, row: ClaimEvidence): boolean {
  if (!jwt || jwt.role !== "authenticated") return false;

  // 1. Tenant workspace isolation: Claim must belong to an authenticated workspace
  const claim = claims.find((c) => c.id === row.claim_id);
  if (!claim) return false;
  const sub = submissions.find((s) => s.id === claim.submission_id);
  if (!sub) return false;
  const ws = workspaces.find((w) => w.id === sub.workspace_id);
  if (!ws) return false;

  const jwtSlug = jwt.app_metadata?.workspace_slug;
  const jwtWorkspaces = jwt.app_metadata?.workspaces || [];
  const jwtWsId = jwt.app_metadata?.workspace_id;
  const isWorkspaceMatch = ws.slug === jwtSlug || jwtWorkspaces.includes(ws.slug) || ws.id === jwtWsId;
  if (!isWorkspaceMatch) return false;

  // 2. Evidence source requirement: At least one valid evidence source must be provided
  if (row.document_version_id === null && row.approved_fact_id === null) {
    return false;
  }

  // 3. Anti-cross-tenant leakage: When document version is present, it must belong to the SAME workspace as the claim
  if (row.document_version_id !== null) {
    const docVer = docVersions.find((dv) => dv.id === row.document_version_id);
    if (!docVer) return false;
    const doc = sourceDocs.find((sd) => sd.id === docVer.source_document_id);
    if (!doc) return false;
    if (doc.workspace_id !== sub.workspace_id) return false;
  }

  // 4. Anti-cross-tenant leakage: When approved fact is present, it must belong to the SAME workspace as the claim
  if (row.approved_fact_id !== null) {
    const fact = approvedFacts.find((af) => af.id === row.approved_fact_id);
    if (!fact) return false;
    const prod = products.find((p) => p.id === fact.product_id);
    if (!prod) return false;
    if (prod.workspace_id !== sub.workspace_id) return false;
  }

  return true;
}

/**
 * Simulates PostgreSQL RLS USING predicate for SELECT:
 * - Authenticated users can read evidence linked to claims in their workspace
 */
function evaluateAuthenticatedSelectPolicy(jwt: JWT | null, row: ClaimEvidence): boolean {
  if (!jwt || jwt.role !== "authenticated") return false;

  const claim = claims.find((c) => c.id === row.claim_id);
  if (!claim) return false;
  const sub = submissions.find((s) => s.id === claim.submission_id);
  if (!sub) return false;
  const ws = workspaces.find((w) => w.id === sub.workspace_id);
  if (!ws) return false;

  const jwtSlug = jwt.app_metadata?.workspace_slug;
  const jwtWorkspaces = jwt.app_metadata?.workspaces || [];
  const jwtWsId = jwt.app_metadata?.workspace_id;

  return ws.slug === jwtSlug || jwtWorkspaces.includes(ws.slug) || ws.id === jwtWsId;
}

/**
 * Simulates legacy single-tenant "Public read claim evidence" policy:
 * - Unauthenticated / public users can read claims in 'dermaglow' workspace only
 */
function evaluateLegacyPublicSelectPolicy(row: ClaimEvidence): boolean {
  const claim = claims.find((c) => c.id === row.claim_id);
  if (!claim) return false;
  const sub = submissions.find((s) => s.id === claim.submission_id);
  if (!sub) return false;
  const ws = workspaces.find((w) => w.id === sub.workspace_id);
  if (!ws) return false;

  return ws.slug === "dermaglow";
}

async function runRLSTests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 7 RLS POLICY VERIFICATION SUITE            ");
  console.log("       Evidence Row-Level Security, Multi-Tenancy & NULL Handling       ");
  console.log("========================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail = "") {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       └─ ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       └─ ${detail}`);
    }
  }

  const nativeJwt: JWT = {
    role: "authenticated",
    app_metadata: {
      workspace_slug: "dermaglow",
      workspace_id: "ws-native-01",
    },
  };

  const foreignJwt: JWT = {
    role: "authenticated",
    app_metadata: {
      workspace_slug: "competitor-pharma",
      workspace_id: "ws-foreign-02",
    },
  };

  // Test 1: Baseline reproduction of uncorrected policy bug on NULL document_version_id
  {
    const factEvidence: ClaimEvidence = {
      id: "ev-1",
      claim_id: "claim-native-01",
      document_version_id: null,
      approved_fact_id: "fact-native-01",
    };

    const uncorrectedResult = evaluateUncorrectedInsertPolicy(nativeJwt, factEvidence);
    assert(
      uncorrectedResult === false,
      "1. Baseline defect reproduced: uncorrected policy incorrectly rejects NULL document_version_id"
    );
  }

  // Test 2: Corrected policy permits approved-fact-only evidence with NULL document_version_id
  {
    const factEvidence: ClaimEvidence = {
      id: "ev-2",
      claim_id: "claim-native-01",
      document_version_id: null,
      approved_fact_id: "fact-native-01",
    };

    const correctedResult = evaluateFinalCorrectedInsertPolicy(nativeJwt, factEvidence);
    assert(
      correctedResult === true,
      "2. Corrected policy permits fact evidence with NULL document_version_id in same workspace"
    );
  }

  // Test 3: Document-only evidence in the same workspace is permitted
  {
    const docEvidence: ClaimEvidence = {
      id: "ev-3",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01",
      approved_fact_id: null,
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, docEvidence);
    assert(
      result === true,
      "3. Document-backed evidence in same workspace passes RLS insertion check"
    );
  }

  // Test 4: Both sources provided and both in same workspace is permitted
  {
    const dualEvidence: ClaimEvidence = {
      id: "ev-4-dual",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01", // native doc
      approved_fact_id: "fact-native-01", // native fact
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, dualEvidence);
    assert(
      result === true,
      "4. Dual-sourced evidence (both document and approved fact in same workspace) is permitted"
    );
  }

  // Test 5: Rejection when BOTH document_version_id and approved_fact_id are NULL
  {
    const orphanEvidence: ClaimEvidence = {
      id: "ev-orphan",
      claim_id: "claim-native-01",
      document_version_id: null,
      approved_fact_id: null,
    };

    const rlsResult = evaluateFinalCorrectedInsertPolicy(nativeJwt, orphanEvidence);
    const tableConstraintResult = evaluateTableSourceConstraint(orphanEvidence);

    assert(
      rlsResult === false && tableConstraintResult === false,
      "5. Zero-source evidence (both document_version_id and approved_fact_id NULL) is strictly rejected by RLS and table constraint"
    );
  }

  // Test 6: Dual sources provided, but document belongs to foreign workspace
  {
    const crossDocDualEvidence: ClaimEvidence = {
      id: "ev-cross-doc",
      claim_id: "claim-native-01",
      document_version_id: "ver-foreign-02", // FOREIGN doc
      approved_fact_id: "fact-native-01", // native fact
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, crossDocDualEvidence);
    assert(
      result === false,
      "6. Dual-source insertion rejected when document version belongs to a foreign workspace"
    );
  }

  // Test 7: Dual sources provided, but approved fact belongs to foreign workspace
  {
    const crossFactDualEvidence: ClaimEvidence = {
      id: "ev-cross-fact",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01", // native doc
      approved_fact_id: "fact-foreign-02", // FOREIGN fact
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, crossFactDualEvidence);
    assert(
      result === false,
      "7. Dual-source insertion rejected when approved fact belongs to a foreign workspace"
    );
  }

  // Test 8: Cross-workspace document-only evidence is strictly rejected
  {
    const crossDocEvidence: ClaimEvidence = {
      id: "ev-8",
      claim_id: "claim-native-01",
      document_version_id: "ver-foreign-02",
      approved_fact_id: null,
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, crossDocEvidence);
    assert(
      result === false,
      "8. Cross-workspace document version is strictly rejected (anti-leakage)"
    );
  }

  // Test 9: Cross-workspace approved-fact-only evidence is strictly rejected
  {
    const crossFactEvidence: ClaimEvidence = {
      id: "ev-9",
      claim_id: "claim-native-01",
      document_version_id: null,
      approved_fact_id: "fact-foreign-02",
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, crossFactEvidence);
    assert(
      result === false,
      "9. Cross-workspace approved fact is strictly rejected (anti-leakage)"
    );
  }

  // Test 10: Cross-workspace target claim insertion is strictly rejected
  {
    const foreignClaimEvidence: ClaimEvidence = {
      id: "ev-10",
      claim_id: "claim-foreign-02", // Foreign claim
      document_version_id: "ver-native-01",
      approved_fact_id: null,
    };

    const result = evaluateFinalCorrectedInsertPolicy(nativeJwt, foreignClaimEvidence);
    assert(
      result === false,
      "10. User cannot insert evidence into another workspace's claim"
    );
  }

  // Test 11: Anonymous caller is strictly rejected from inserting evidence
  {
    const evidence: ClaimEvidence = {
      id: "ev-11",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01",
      approved_fact_id: null,
    };

    const anonResult = evaluateFinalCorrectedInsertPolicy(null, evidence);
    const anonJwtResult = evaluateFinalCorrectedInsertPolicy({ role: "anon" }, evidence);
    assert(
      anonResult === false && anonJwtResult === false,
      "11. Anonymous callers are strictly prohibited from inserting claim evidence"
    );
  }

  // Test 12: Authenticated user cannot SELECT another workspace's evidence
  {
    const foreignEvidence: ClaimEvidence = {
      id: "ev-12",
      claim_id: "claim-foreign-02",
      document_version_id: "ver-foreign-02",
      approved_fact_id: null,
    };

    const readAllowed = evaluateAuthenticatedSelectPolicy(nativeJwt, foreignEvidence);
    assert(
      readAllowed === false,
      "12. Authenticated user in DermaGlow cannot read Competitor Pharma's claim evidence"
    );
  }

  // Test 13: Authenticated user CAN SELECT their own workspace's evidence
  {
    const nativeEvidence: ClaimEvidence = {
      id: "ev-13",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01",
      approved_fact_id: null,
    };

    const readAllowed = evaluateAuthenticatedSelectPolicy(nativeJwt, nativeEvidence);
    assert(
      readAllowed === true,
      "13. Authenticated user in DermaGlow can read DermaGlow claim evidence"
    );
  }

  // Test 14: Legacy public read policy permits unauthenticated read of DermaGlow only for demo
  {
    const nativeEvidence: ClaimEvidence = {
      id: "ev-14-native",
      claim_id: "claim-native-01",
      document_version_id: "ver-native-01",
      approved_fact_id: null,
    };

    const foreignEvidence: ClaimEvidence = {
      id: "ev-14-foreign",
      claim_id: "claim-foreign-02",
      document_version_id: "ver-foreign-02",
      approved_fact_id: null,
    };

    const anonNative = evaluateLegacyPublicSelectPolicy(nativeEvidence);
    const anonForeign = evaluateLegacyPublicSelectPolicy(foreignEvidence);

    assert(
      anonNative === true && anonForeign === false,
      "14. Legacy public read policy permits unauthenticated read of DermaGlow only and rejects foreign tenants"
    );
  }

  console.log("\n========================================================================");
  console.log(`RLS TEST SUMMARY: ${passed}/${total} passing, ${total - passed} failed.`);
  console.log("========================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runRLSTests().catch(console.error);
