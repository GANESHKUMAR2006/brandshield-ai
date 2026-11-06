/**
 * BrandShield AI — Phase 10D Baseline Evaluation Unit Tests
 * Controlled Baseline Extraction Evaluation Harness & Alignment Invariants
 *
 * Verifies:
 * 1. Eligible cohort filtering: exactly 56 human-reviewed records (31 approved, 25 modified, 64 AI excluded)
 * 2. Deterministic claim matcher: exact span matching, character IoU calculation, relaxed matching (IoU >= 0.5)
 * 3. False positive and false negative classification
 * 4. Entity evaluation logic: matching, missing, and value comparison
 * 5. Metrics calculation: strict/relaxed precision, recall, F1, category accuracy, span accuracy
 * 6. Zero-claim hard negative false positive rate (7 records)
 * 7. Token and cost estimation formulas
 */

import { ClaimMatcher } from "../tools/baseline-eval/matcher";
import { MetricsCalculator } from "../tools/baseline-eval/metrics";
import { BaselineEvaluator } from "../tools/baseline-eval/evaluator";
import { EvaluationClaim } from "../tools/dataset-builder/phase10b/types";
import { RawExtractedClaim } from "../src/lib/ai/extraction/extraction-schema";
import { RecordEvalSummary } from "../tools/baseline-eval/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

async function runPhase10DTests() {
  console.log("================================================================================");
  console.log(" BrandShield AI — Phase 10D Baseline Evaluation Unit Tests");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: Dataset Population & Provenance Invariants
  // ---------------------------------------------------------------------------
  console.log("[Suite 1] Cohort Filtering & Provenance Invariants");

  const evaluator = new BaselineEvaluator({ dryRun: true });
  const { eligibleRecords, totalDatasetCount, excludedAiCount } = evaluator.loadEligibleRecords();

  assert(totalDatasetCount === 120, "Total evaluation dataset records = 120");
  assert(excludedAiCount === 64, "Exactly 64 AI-only records are excluded from evaluation");
  assert(eligibleRecords.length === 56, "Exactly 56 human-reviewed records selected for evaluation");

  const approved = eligibleRecords.filter((r) => r.is_human_approved);
  const modified = eligibleRecords.filter((r) => r.is_human_modified);
  assert(approved.length === 31, "Cohort contains exactly 31 human-approved records");
  assert(modified.length === 25, "Cohort contains exactly 25 human-modified records");

  const zeroClaim = eligibleRecords.filter((r) => r.ground_truth_claims.length === 0);
  assert(zeroClaim.length === 7, "Cohort contains exactly 7 zero-claim hard negative records");

  const ambiguous = eligibleRecords.filter((r) => r.has_ambiguity);
  assert(ambiguous.length === 9, "Cohort preserves all 9 ambiguous cases");

  // ---------------------------------------------------------------------------
  // Suite 2: IoU & Span Matching Logic
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 2] Deterministic Claim Matching & IoU Alignment");

  const iouExact = ClaimMatcher.calculateIoU(10, 30, 10, 30);
  assert(iouExact === 1.0, "Identical spans yield exact IoU = 1.0");

  const iouDisjoint = ClaimMatcher.calculateIoU(10, 20, 30, 40);
  assert(iouDisjoint === 0.0, "Disjoint spans yield IoU = 0.0");

  const iouOverlap = ClaimMatcher.calculateIoU(10, 30, 20, 40);
  // Intersection: [20..30] (10), Union: [10..40] (30) => 10/30 = 0.333
  assert(Math.abs(iouOverlap - 1 / 3) < 0.001, "Partial overlap calculates correct IoU (0.333)");

  const mockGt: EvaluationClaim[] = [
    {
      claim_id: "c1",
      claim_text: "Contains 10% Vitamin C",
      claim_type: "product_attribute",
      text_start: 0,
      text_end: 22,
      product_hint: null,
      entities: { ingredient: "Vitamin C", concentration: "10%" },
      extraction_confidence: 1.0,
      annotation_state: "human_verified",
    },
    {
      claim_id: "c2",
      claim_text: "Only ₹1,499",
      claim_type: "price",
      text_start: 26,
      text_end: 37,
      product_hint: null,
      entities: { price: 1499, currency: "INR" },
      extraction_confidence: 1.0,
      annotation_state: "human_verified",
    },
  ];

  const mockPred: RawExtractedClaim[] = [
    // Exact match
    {
      claim_text: "Contains 10% Vitamin C",
      claim_type: "product_attribute",
      text_start: 0,
      text_end: 22,
      product_hint: null,
      entities: { ingredient: "Vitamin C", concentration: "10%" },
      extraction_confidence: 0.95,
    },
    // Relaxed match with category error
    {
      claim_text: "₹1,499",
      claim_type: "discount", // Category mismatch (GT is price)
      text_start: 31,
      text_end: 37,
      product_hint: null,
      entities: { price: 1499 },
      extraction_confidence: 0.9,
    },
    // False positive
    {
      claim_text: "Limited offer",
      claim_type: "promotional",
      text_start: 45,
      text_end: 58,
      product_hint: null,
      entities: {},
      extraction_confidence: 0.8,
    },
  ];

  const matches = ClaimMatcher.matchClaims(mockGt, mockPred);
  assert(matches.length === 3, "Match result contains 3 pairs (1 exact, 1 relaxed, 1 FP)");

  const exactPair = matches.find((m) => m.span_exact);
  assert(exactPair !== undefined, "Detected exact span match");
  assert(exactPair?.category_exact === true, "Exact match correctly identified category agreement");

  const relaxedPair = matches.find((m) => m.match_type === "relaxed_overlap");
  assert(relaxedPair !== undefined, "Detected relaxed match (IoU >= 0.5)");
  assert(relaxedPair?.category_exact === false, "Relaxed match correctly caught category disagreement (price vs discount)");

  const fpPair = matches.find((m) => m.match_type === "unmatched" && m.predicted);
  assert(fpPair !== undefined, "Detected unmatched predicted claim (False Positive)");

  // ---------------------------------------------------------------------------
  // Suite 3: Metrics Calculation & Zero-Claim Error Rates
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3] Metrics Engine & Zero-Claim Invariants");

  const mockSummaries: RecordEvalSummary[] = [
    {
      example_id: "rec_1",
      review_status: "reviewed_approved",
      is_human_modified: false,
      has_ambiguity: false,
      is_zero_claim: false,
      ground_truth_count: 2,
      predicted_count: 3,
      true_positives_exact: 1,
      true_positives_relaxed: 2,
      false_positives: 1,
      false_negatives: 0,
      zero_claim_false_positive: false,
      matches,
    },
    {
      example_id: "rec_zero",
      review_status: "human_verified",
      is_human_modified: false,
      has_ambiguity: false,
      is_zero_claim: true,
      ground_truth_count: 0,
      predicted_count: 1,
      true_positives_exact: 0,
      true_positives_relaxed: 0,
      false_positives: 1,
      false_negatives: 0,
      zero_claim_false_positive: true, // FP on zero-claim
      matches: [
        {
          predicted: mockPred[2],
          match_type: "unmatched",
          iou: 0,
          span_exact: false,
          category_exact: false,
        },
      ],
    },
  ];

  const agg = MetricsCalculator.computeAggregateMetrics(mockSummaries, 2);
  assert(agg.total_records_evaluated === 2, "Evaluated total records = 2");
  assert(agg.total_ground_truth_claims === 2, "Total GT claims = 2");
  assert(agg.total_predicted_claims === 4, "Total Pred claims = 4");
  assert(agg.strict_true_positives === 1, "Strict TP = 1");
  assert(agg.relaxed_true_positives === 2, "Relaxed TP = 2");
  assert(agg.zero_claim_false_positive_rate === 1.0, "Zero-claim FPR correctly computed (1/1 = 100%)");

  // ---------------------------------------------------------------------------
  // Suite 4: Cost & Token Estimation Invariants
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4] Token & Cost Estimation Formula");

  const est = evaluator.estimateTokensAndCost(eligibleRecords);
  assert(est.recordCount === 56, "Estimation covers exactly 56 records");
  assert(est.estimatedTotalTokens > 50000 && est.estimatedTotalTokens < 80000, "Total tokens in expected range (~63,000)");
  assert(est.estimatedCostUsd > 0.01 && est.estimatedCostUsd < 0.03, "Total estimated cost is ~$0.014 USD");
  assert(est.model === "gpt-4o-mini", "Configured model is gpt-4o-mini");
  assert(est.promptVersion === "1.0.0", "Prompt version is 1.0.0");

  console.log("\n================================================================================");
  console.log(` Phase 10D Test Results: ${passed} passed, ${failed} failed`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runPhase10DTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

