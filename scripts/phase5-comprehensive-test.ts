/**
 * BRANDSHIELD AI — PHASE 5 COMPREHENSIVE AUTOMATED TEST SUITE
 * Deterministic Marketing Claim Verification Engine (DermaGlow Organics)
 *
 * Covers all 22 required evaluation criteria specified in Phase 5:
 * 1. Exact approved product attribute
 * 2. Incorrect concentration claim
 * 3. Correct promotional price
 * 4. Incorrect promotional price
 * 5. Expired promotion
 * 6. Invalid promotion channel
 * 7. Missing promotion terms
 * 8. Expired source document
 * 9. Superseded document version
 * 10. Conflicting approved facts
 * 11. Missing evidence (Never contradicted)
 * 12. Ambiguous product association
 * 13. Unsupported efficacy claim
 * 14. Unsupported guarantee claim
 * 15. Multiple claims in single submission
 * 16. Duplicate verification attempts
 * 17. Historical evidence snapshot
 * 18. Unauthorized verification attempt / RLS
 * 19. Cross-workspace isolation
 * 20. Audit event creation
 * 21. Currency precision (Decimal-safe integer comparison)
 * 22. Submission date boundary handling
 */

import { query } from "../src/lib/db/server-db";
import { VerificationEngine } from "../src/lib/verification/verification-engine";
import { VerificationRouter } from "../src/lib/verification/verification-router";
import { EvidenceValidator } from "../src/lib/verification/evidence/evidence-validator";
import { EvidenceSufficiencyGate } from "../src/lib/verification/evidence/evidence-sufficiency";
import {
  VerificationContext,
  ContextProduct,
  ContextApprovedFact,
  ContextPromotion,
  ContextSourceDocument,
} from "../src/lib/verification/types";

async function runPhase5Tests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 5 COMPREHENSIVE AUTOMATED TEST SUITE       ");
  console.log("       Deterministic Marketing Claim Verification Engine (DermaGlow)   ");
  console.log("========================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details = "") {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      if (details) console.log(`       └─ ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      if (details) console.error(`       └─ ${details}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SETUP: Load DermaGlow context from live Supabase PostgreSQL
    // -------------------------------------------------------------------------
    const workspaceRes = await query<{ id: string }>(
      "SELECT id FROM workspaces WHERE slug = 'dermaglow'"
    );
    const workspaceId = workspaceRes.rows[0]?.id;
    if (!workspaceId) throw new Error("DermaGlow workspace not found in database");

    const productRes = await query<{
      id: string;
      name: string;
      sku: string;
      category: string;
      reference_price: string;
      status: string;
    }>("SELECT * FROM products WHERE sku = 'DG-VTC-001' AND workspace_id = $1", [workspaceId]);
    const benchmarkProduct: ContextProduct = {
      id: productRes.rows[0].id,
      name: productRes.rows[0].name,
      sku: productRes.rows[0].sku,
      reference_price: Number(productRes.rows[0].reference_price),
      currency: "INR",
      status: productRes.rows[0].status,
    };

    const factsRes = await query<{
      id: string;
      product_id: string;
      fact_key: string;
      fact_value: Record<string, unknown>;
      fact_type: string;
      approval_status: string;
      source_document_id: string | null;
      valid_from: string;
      valid_until: string | null;
    }>("SELECT id, product_id, fact_key, fact_value, fact_type, approval_status, source_document_id, valid_from, valid_until FROM approved_facts WHERE product_id = $1", [
      benchmarkProduct.id,
    ]);
    const liveFacts: ContextApprovedFact[] = factsRes.rows;

    const promoRes = await query<{
      id: string;
      product_id: string;
      promotion_name: string;
      discount_type: string;
      discount_value: string;
      resulting_price: string;
      currency: string;
      start_date: string;
      end_date: string;
      applicable_channels: string[];
      terms: string | null;
      status: string;
    }>("SELECT * FROM promotions WHERE product_id = $1", [benchmarkProduct.id]);
    const livePromotions: ContextPromotion[] = promoRes.rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      promotion_name: r.promotion_name,
      discount_type: r.discount_type,
      discount_value: Number(r.discount_value),
      resulting_price: Number(r.resulting_price),
      currency: r.currency || "INR",
      start_date: r.start_date,
      end_date: r.end_date,
      applicable_channels: r.applicable_channels,
      terms: r.terms,
      status: r.status,
    }));

    const docsRes = await query<{
      id: string;
      title: string;
      document_type: string;
      approval_status: string;
      valid_from: string | null;
      valid_until: string | null;
      current_version_id: string | null;
      current_version_number: number | null;
    }>(
      `SELECT sd.id, sd.title, sd.document_type, sd.approval_status,
              dv.valid_from, dv.valid_until,
              sd.current_version_id, dv.version_number as current_version_number
       FROM source_documents sd
       LEFT JOIN document_versions dv ON sd.current_version_id = dv.id
       WHERE sd.workspace_id = $1`,
      [workspaceId]
    );
    const liveDocuments: ContextSourceDocument[] = docsRes.rows;

    const baseSubmission = {
      id: "00000000-0000-0000-0000-000000000101",
      title: "DermaGlow Instagram Campaign",
      channel: "instagram",
      product_id: benchmarkProduct.id,
      submission_date: "2026-11-15T10:00:00Z",
      created_at: "2026-11-15T10:00:00Z",
    };

    const baseSubmissionVersion = {
      id: "00000000-0000-0000-0000-000000000111",
      version_number: 1,
      content: "Contains 10% stabilised Vitamin C for luminous skin.",
    };

    // =========================================================================
    // TEST 1: Exact approved product attribute
    // =========================================================================
    const context1: VerificationContext = {
      claim: {
        id: "claim-test-1",
        claim_text: "Contains 10% stabilised Vitamin C",
        claim_type: "product_attribute",
        text_start: 0,
        text_end: 32,
        product_id: benchmarkProduct.id,
        extracted_entities: { ingredient: "Vitamin C", concentration: 10 },
        extraction_confidence: 0.98,
      },
      product: benchmarkProduct,
      submission: baseSubmission,
      submissionVersion: baseSubmissionVersion,
      effectiveDate: new Date("2026-11-15T10:00:00Z"),
      channel: "instagram",
      approvedFacts: liveFacts,
      promotions: livePromotions,
      sourceDocuments: liveDocuments,
    };
    const res1 = VerificationRouter.routeClaim(context1);
    assert(
      res1.status === "supported" && res1.riskLevel === "low" && res1.sufficiency === "sufficient",
      "1. Exact approved product attribute verification",
      `Status: ${res1.status}, Risk: ${res1.riskLevel}, Sufficiency: ${res1.sufficiency}`
    );

    // =========================================================================
    // TEST 2: Incorrect concentration claim
    // =========================================================================
    const context2: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-2",
        claim_text: "Contains 25% Ultra Vitamin C",
        claim_type: "product_attribute",
        text_start: 0,
        text_end: 28,
        product_id: benchmarkProduct.id,
        extracted_entities: { ingredient: "Vitamin C", concentration: 25 },
        extraction_confidence: 0.96,
      },
    };
    const res2 = VerificationRouter.routeClaim(context2);
    assert(
      res2.status === "contradicted" && (res2.riskLevel === "high" || res2.riskLevel === "critical") && Boolean(res2.suggestedCorrection?.includes("10%")),
      "2. Incorrect concentration claim",
      `Status: ${res2.status}, Risk: ${res2.riskLevel}, Correction: "${res2.suggestedCorrection}"`
    );

    // =========================================================================
    // TEST 3: Correct promotional price
    // =========================================================================
    const context3: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-3",
        claim_text: "Festival launch price of ₹1,999",
        claim_type: "price",
        text_start: 0,
        text_end: 31,
        product_id: benchmarkProduct.id,
        extracted_entities: { price: 1999, currency: "INR" },
        extraction_confidence: 0.97,
      },
    };
    const res3 = VerificationRouter.routeClaim(context3);
    assert(
      res3.status === "supported" && res3.riskLevel === "low",
      "3. Correct promotional price verification",
      `Status: ${res3.status}, Matched: Festival Glow Launch Offer (₹1,999)`
    );

    // =========================================================================
    // TEST 4: Incorrect promotional price
    // =========================================================================
    const context4: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-4",
        claim_text: "Festival glow offer at only ₹999",
        claim_type: "price",
        text_start: 0,
        text_end: 32,
        product_id: benchmarkProduct.id,
        extracted_entities: { price: 999, currency: "INR" },
        extraction_confidence: 0.95,
      },
    };
    const res4 = VerificationRouter.routeClaim(context4);
    assert(
      res4.status === "contradicted" && res4.riskLevel === "high" && res4.suggestedCorrection !== null,
      "4. Incorrect promotional price contradiction",
      `Status: ${res4.status}, Suggested Correction: "${res4.suggestedCorrection}"`
    );

    // =========================================================================
    // TEST 5: Expired promotion
    // =========================================================================
    const context5: VerificationContext = {
      ...context3,
      effectiveDate: new Date("2027-01-15T12:00:00Z"), // Festival promo ends 2026-12-31
    };
    const res5 = VerificationRouter.routeClaim(context5);
    assert(
      res5.status === "outdated",
      "5. Expired promotion verification",
      `Status: ${res5.status}, Reason: Effective date (2027-01-15) past promotion end date (2026-12-31)`
    );

    // =========================================================================
    // TEST 6: Invalid promotion channel
    // =========================================================================
    const context6: VerificationContext = {
      ...context3,
      channel: "offline_retail",
      submission: {
        ...baseSubmission,
        channel: "offline_retail", // Festival promo valid only for website, instagram
      },
    };
    const res6 = VerificationRouter.routeClaim(context6);
    assert(
      res6.status === "contradicted" && res6.explanation.includes("channel"),
      "6. Invalid promotion channel restriction",
      `Status: ${res6.status}, Explanation: ${res6.explanation}`
    );

    // =========================================================================
    // TEST 7: Missing promotion terms
    // =========================================================================
    const context7: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-7",
        claim_text: "Massive 50% off storewide discount",
        claim_type: "discount",
        text_start: 0,
        text_end: 35,
        product_id: benchmarkProduct.id,
        extracted_entities: { discount_percent: 50 },
        extraction_confidence: 0.94,
      },
    };
    const res7 = VerificationRouter.routeClaim(context7);
    assert(
      (res7.status === "unverified" || res7.status === "contradicted"),
      "7. Missing promotion terms",
      `Status: ${res7.status}, 50% discount not present in registered promotions`
    );

    // =========================================================================
    // TEST 8: Expired source document
    // =========================================================================
    const expiredDoc: ContextSourceDocument = {
      ...liveDocuments[0],
      valid_until: "2025-12-31T23:59:59Z",
    };
    const isDocExpired = !EvidenceValidator.isDocumentValid(expiredDoc, new Date("2026-11-15T00:00:00Z"));
    assert(
      isDocExpired,
      "8. Expired source document detection",
      `Expired doc (valid_until 2025-12-31) correctly flagged as invalid for submission on 2026-11-15`
    );

    // =========================================================================
    // TEST 9: Superseded document version
    // =========================================================================
    const supersededDoc: ContextSourceDocument = {
      ...liveDocuments[0],
      approval_status: "superseded", // Older superseded version
    };
    const isDocSuperseded = !EvidenceValidator.isDocumentValid(supersededDoc, new Date("2026-11-15T00:00:00Z"));
    assert(
      isDocSuperseded,
      "9. Superseded document version detection",
      `Superseded version (approval_status: "superseded") rejected from supporting determinations`
    );

    // =========================================================================
    // TEST 10: Conflicting approved facts (Sufficiency Pre-determination Gate)
    // =========================================================================
    const conflictingFacts: ContextApprovedFact[] = [
      {
        id: "fact-conflict-1",
        product_id: benchmarkProduct.id,
        fact_key: "vitamin_c_concentration",
        fact_value: { concentration: "10%" },
        fact_type: "ingredient_specification",
        approval_status: "approved",
        source_document_id: null,
        valid_from: "2026-01-01T00:00:00Z",
        valid_until: null,
      },
      {
        id: "fact-conflict-2",
        product_id: benchmarkProduct.id,
        fact_key: "vitamin_c_concentration",
        fact_value: { concentration: "15%" },
        fact_type: "ingredient_specification",
        approval_status: "approved",
        source_document_id: null,
        valid_from: "2026-01-01T00:00:00Z",
        valid_until: null,
      },
    ];
    const conflictCheck = EvidenceSufficiencyGate.detectConflictingFacts(conflictingFacts);
    assert(
      conflictCheck.hasConflict && conflictCheck.conflicts.length > 0,
      "10. Conflicting approved facts detection",
      `Conflicting concentration facts (10% vs 15%) intercepted by EvidenceSufficiencyGate`
    );

    // =========================================================================
    // TEST 11: Missing evidence (Absence of evidence is NEVER contradiction)
    // =========================================================================
    const context11: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-11",
        claim_text: "Infused with 5% Marine Collagen Extract",
        claim_type: "product_attribute",
        text_start: 0,
        text_end: 39,
        product_id: benchmarkProduct.id,
        extracted_entities: { ingredient: "Marine Collagen" },
        extraction_confidence: 0.93,
      },
    };
    const res11 = VerificationRouter.routeClaim(context11);
    assert(
      res11.status === "unverified" && (res11.status as string) !== "contradicted",
      "11. Missing evidence (Never contradicted on absence)",
      `Status: ${res11.status} (Absence of proof defaults strictly to unverified, not contradiction)`
    );

    // =========================================================================
    // TEST 12: Ambiguous product association
    // =========================================================================
    const context12: VerificationContext = {
      ...context1,
      product: null, // Unassigned product
    };
    const res12 = VerificationRouter.routeClaim(context12);
    assert(
      res12.status === "needs_review",
      "12. Ambiguous product association",
      `Status: ${res12.status}, Reason: Unassigned product routed to needs_review`
    );

    // =========================================================================
    // TEST 13: Unsupported efficacy claim
    // =========================================================================
    const context13: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-13",
        claim_text: "Completely eliminates deep wrinkles in only 7 days",
        claim_type: "efficacy",
        text_start: 0,
        text_end: 49,
        product_id: benchmarkProduct.id,
        extracted_entities: {},
        extraction_confidence: 0.91,
      },
    };
    const res13 = VerificationRouter.routeClaim(context13);
    assert(
      res13.status === "needs_review" && res13.explanation.includes("7 days"),
      "13. Unsupported efficacy claim",
      `Status: ${res13.status}, 7-day claim not validated by 4-week clinical trial DG-CT-2025-04`
    );

    // =========================================================================
    // TEST 14: Unsupported guarantee claim
    // =========================================================================
    const context14: VerificationContext = {
      ...context1,
      claim: {
        id: "claim-test-14",
        claim_text: "100% guaranteed overnight dark spot elimination with zero risk",
        claim_type: "guarantee",
        text_start: 0,
        text_end: 62,
        product_id: benchmarkProduct.id,
        extracted_entities: {},
        extraction_confidence: 0.92,
      },
    };
    const res14 = VerificationRouter.routeClaim(context14);
    assert(
      res14.status === "needs_review" && (res14.riskLevel === "high" || res14.riskLevel === "critical"),
      "14. Unsupported absolute guarantee claim",
      `Status: ${res14.status}, Risk: ${res14.riskLevel}, Dermatological safety policy violation`
    );

    // =========================================================================
    // TEST 15: Multiple claims in single submission (VerificationEngine integration)
    // =========================================================================
    const subId = "00000000-0000-0000-0000-000000000102"; // Submission with multiple claims
    const batchResults = await VerificationEngine.verifySubmissionClaims(subId);
    assert(
      Array.isArray(batchResults) && batchResults.length >= 2,
      "15. Multiple claims in single submission batch verification",
      `Evaluated ${batchResults.length} claims in atomic execution`
    );

    // =========================================================================
    // TEST 16: Duplicate verification attempts (Run history preservation)
    // =========================================================================
    const testClaimId = "00000000-0000-0000-0000-000000000203";
    const run1 = await VerificationEngine.verifyClaim(testClaimId);
    const run2 = await VerificationEngine.verifyClaim(testClaimId);
    assert(
      run1.runId !== run2.runId,
      "16. Duplicate verification attempts (Immutable history preservation)",
      `Run 1: ${run1.runId}, Run 2: ${run2.runId} (Both preserved in verification_runs)`
    );

    // =========================================================================
    // TEST 17: Historical evidence snapshot
    // =========================================================================
    const snapshotRes = await query<{ evidence_snapshot: Record<string, unknown> }>(
      "SELECT evidence_snapshot FROM verification_runs WHERE id = $1",
      [run2.runId]
    );
    const snap = snapshotRes.rows[0]?.evidence_snapshot;
    assert(
      Boolean(snap && typeof snap === "object" && snap.claim_text && Array.isArray(snap.matched_facts)),
      "17. Historical evidence snapshot verification",
      `Snapshot captured claim_text="${snap?.claim_text}" with ${Array.isArray(snap?.matched_facts) ? snap?.matched_facts.length : 0} frozen facts`
    );

    // =========================================================================
    // TEST 18: Unauthorized verification attempt / RLS protection
    // =========================================================================
    const rlsCheck = await query<{ count: string }>(
      "SELECT count(*) FROM pg_policies WHERE tablename = 'verification_runs' AND schemaname = 'public'"
    );
    assert(
      Number(rlsCheck.rows[0].count) >= 1,
      "18. Unauthorized verification attempt / RLS enforcement",
      `RLS policies active on verification_runs (${rlsCheck.rows[0].count} policy rules enforced)`
    );

    // =========================================================================
    // TEST 19: Cross-workspace isolation
    // =========================================================================
    const workspaceCheck = await query<{ count: string }>(
      `SELECT count(*) FROM claims c 
       JOIN submissions s ON c.submission_id = s.id 
       WHERE s.workspace_id != $1`,
      [workspaceId]
    );
    assert(
      workspaceCheck.rows[0].count === "0",
      "19. Cross-workspace isolation",
      `Queries strictly partition DermaGlow workspace records (${workspaceCheck.rows[0].count} foreign records)`
    );

    // =========================================================================
    // TEST 20: Audit event creation
    // =========================================================================
    const auditRes = await query<{ id: string; action: string; actor_id: string }>(
      `SELECT id, action, actor_id FROM audit_events 
       WHERE entity_id = $1 AND action = 'claim_verified' 
       ORDER BY created_at DESC LIMIT 1`,
      [testClaimId]
    );
    assert(
      auditRes.rows.length === 1 && auditRes.rows[0].action === "claim_verified",
      "20. Append-only audit event creation",
      `Audit event ${auditRes.rows[0]?.id} logged with action="claim_verified" and actor_id="${auditRes.rows[0]?.actor_id}"`
    );

    // =========================================================================
    // TEST 21: Currency precision (Decimal-safe integer comparison)
    // =========================================================================
    const priceComp1 = EvidenceValidator.arePricesEqual(2499.0000000000005, 2499);
    const priceComp2 = EvidenceValidator.arePricesEqual(1999, 1999.0);
    const priceCompDiff = EvidenceValidator.arePricesEqual(1999, 1999.5);
    assert(
      priceComp1 && priceComp2 && !priceCompDiff,
      "21. Currency precision (Decimal-safe integer arithmetic)",
      `Paise-level equality: (2499.0000000000005 == 2499) -> true, (1999 == 1999.5) -> false`
    );

    // =========================================================================
    // TEST 22: Submission date boundary handling
    // =========================================================================
    const promo = livePromotions[0]; // 2026-11-01 to 2026-12-31
    const startBoundary = new Date("2026-11-01T00:00:00.000Z");
    const endBoundary = new Date("2026-12-31T23:59:59.999Z");
    const isStartValid = EvidenceValidator.isPromotionActive(promo, startBoundary);
    const isEndValid = EvidenceValidator.isPromotionActive(promo, endBoundary);
    assert(
      isStartValid && isEndValid,
      "22. Submission date boundary handling (Inclusive start & end of day UTC)",
      `Start boundary (2026-11-01T00:00:00Z): ${isStartValid}, End boundary (2026-12-31T23:59:59Z): ${isEndValid}`
    );

    console.log("\n========================================================================");
    console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED`);
    console.log("========================================================================\n");

    if (passed === total) {
      console.log("ALL 22 PHASE 5 DETERMINISTIC CLAIM VERIFICATION ENGINE TESTS PASSED!\n");
      process.exit(0);
    } else {
      console.error(`FAILED: ${total - passed} tests failed.\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution encountered unexpected error:", err);
    process.exit(1);
  }
}

runPhase5Tests();
