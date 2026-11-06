/**
 * BrandShield AI — Baseline Evaluation Metrics Calculator
 * Phase 10D: Controlled Baseline Evaluation Harness
 *
 * Implements precision, recall, F1, exact-span accuracy, category accuracy,
 * entity alignment accuracy, zero-claim false positive rate, and category-level breakdowns.
 */

import { CLAIM_TYPES, ClaimType } from "../../src/lib/ai/extraction/extraction-schema";
import {
  AggregateMetrics,
  CategoryMetricSummary,
  ClaimMatchPair,
  RecordEvalSummary,
  StratifiedMetrics,
} from "./types";

export class MetricsCalculator {
  /**
   * Safely calculates division, returning 0 on 0/0.
   */
  private static safeDivide(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Number((numerator / denominator).toFixed(4));
  }

  /**
   * Computes F1 score from precision and recall.
   */
  private static computeF1(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return Number(((2 * precision * recall) / (precision + recall)).toFixed(4));
  }

  /**
   * Computes aggregate metrics from an array of per-record summaries.
   */
  public static computeAggregateMetrics(
    recordSummaries: RecordEvalSummary[],
    totalZodValid: number
  ): AggregateMetrics {
    const totalRecords = recordSummaries.length;
    let humanApprovedCount = 0;
    let humanModifiedCount = 0;
    let ambiguousCount = 0;
    let zeroClaimCount = 0;
    let zeroClaimFpCount = 0;

    let totalGt = 0;
    let totalPred = 0;

    let tpStrict = 0;
    let tpRelaxed = 0;
    let matchedCategoryExact = 0;

    let entityScoreSum = 0;
    let entityPairsCount = 0;

    for (const r of recordSummaries) {
      if (r.is_human_modified) humanModifiedCount++;
      else humanApprovedCount++;

      if (r.has_ambiguity) ambiguousCount++;
      if (r.is_zero_claim) {
        zeroClaimCount++;
        if (r.zero_claim_false_positive) zeroClaimFpCount++;
      }

      totalGt += r.ground_truth_count;
      totalPred += r.predicted_count;

      for (const m of r.matches) {
        if (m.match_type === "exact_span") {
          tpStrict++;
          tpRelaxed++;
          if (m.category_exact) matchedCategoryExact++;
          if (m.entity_match_score !== undefined) {
            entityScoreSum += m.entity_match_score;
            entityPairsCount++;
          }
        } else if (m.match_type === "relaxed_overlap") {
          tpRelaxed++;
          if (m.category_exact) matchedCategoryExact++;
          if (m.entity_match_score !== undefined) {
            entityScoreSum += m.entity_match_score;
            entityPairsCount++;
          }
        }
      }
    }

    // Strict metrics
    const fpStrict = totalPred - tpStrict;
    const fnStrict = totalGt - tpStrict;
    const strictPrecision = this.safeDivide(tpStrict, tpStrict + fpStrict);
    const strictRecall = this.safeDivide(tpStrict, tpStrict + fnStrict);
    const strictF1 = this.computeF1(strictPrecision, strictRecall);

    // Relaxed metrics
    const fpRelaxed = totalPred - tpRelaxed;
    const fnRelaxed = totalGt - tpRelaxed;
    const relaxedPrecision = this.safeDivide(tpRelaxed, tpRelaxed + fpRelaxed);
    const relaxedRecall = this.safeDivide(tpRelaxed, tpRelaxed + fnRelaxed);
    const relaxedF1 = this.computeF1(relaxedPrecision, relaxedRecall);

    // Alignment accuracies
    const exactSpanAccuracy = this.safeDivide(tpStrict, tpRelaxed);
    const categoryAccuracy = this.safeDivide(matchedCategoryExact, tpRelaxed);
    const entityAccuracy = this.safeDivide(entityScoreSum, entityPairsCount);

    // False positive rate on zero-claim records
    const zeroClaimFpr = this.safeDivide(zeroClaimFpCount, zeroClaimCount);
    const structuredOutputSuccessRate = this.safeDivide(totalZodValid, totalRecords);

    return {
      total_records_evaluated: totalRecords,
      human_approved_count: humanApprovedCount,
      human_modified_count: humanModifiedCount,
      ambiguous_record_count: ambiguousCount,
      zero_claim_records_count: zeroClaimCount,
      total_ground_truth_claims: totalGt,
      total_predicted_claims: totalPred,
      strict_true_positives: tpStrict,
      strict_false_positives: fpStrict,
      strict_false_negatives: fnStrict,
      strict_precision: strictPrecision,
      strict_recall: strictRecall,
      strict_f1: strictF1,
      relaxed_true_positives: tpRelaxed,
      relaxed_false_positives: fpRelaxed,
      relaxed_false_negatives: fnRelaxed,
      relaxed_precision: relaxedPrecision,
      relaxed_recall: relaxedRecall,
      relaxed_f1: relaxedF1,
      exact_span_accuracy: exactSpanAccuracy,
      category_accuracy: categoryAccuracy,
      entity_accuracy: entityAccuracy,
      zero_claim_false_positive_rate: zeroClaimFpr,
      structured_output_success_rate: structuredOutputSuccessRate,
    };
  }

  /**
   * Computes per-category metrics across all matches.
   */
  public static computePerCategoryMetrics(
    allMatches: ClaimMatchPair[]
  ): Record<ClaimType, CategoryMetricSummary> {
    const summary = {} as Record<ClaimType, CategoryMetricSummary>;

    for (const cat of CLAIM_TYPES) {
      summary[cat] = {
        category: cat,
        ground_truth_count: 0,
        predicted_count: 0,
        true_positives: 0,
        false_positives: 0,
        false_negatives: 0,
        precision: 0,
        recall: 0,
        f1: 0,
        exact_span_accuracy: 0,
        category_accuracy: 0,
        insufficient_samples: false,
      };
    }

    for (const m of allMatches) {
      if (m.match_type === "exact_span" || m.match_type === "relaxed_overlap") {
        const gtCat = m.ground_truth?.claim_type as ClaimType;
        const predCat = m.predicted?.claim_type as ClaimType;

        if (gtCat) summary[gtCat].ground_truth_count++;
        if (predCat) summary[predCat].predicted_count++;

        if (gtCat && predCat) {
          if (gtCat === predCat) {
            summary[gtCat].true_positives++;
            if (m.match_type === "exact_span") {
              summary[gtCat].exact_span_accuracy++;
            }
          } else {
            // Category mismatch: gtCat gets a FN for that category, predCat gets a FP
            summary[gtCat].false_negatives++;
            summary[predCat].false_positives++;
          }
        }
      } else if (m.ground_truth) {
        // Unmatched GT (False Negative)
        const gtCat = m.ground_truth.claim_type as ClaimType;
        if (gtCat) {
          summary[gtCat].ground_truth_count++;
          summary[gtCat].false_negatives++;
        }
      } else if (m.predicted) {
        // Unmatched Pred (False Positive)
        const predCat = m.predicted.claim_type as ClaimType;
        if (predCat) {
          summary[predCat].predicted_count++;
          summary[predCat].false_positives++;
        }
      }
    }

    // Finalize precision, recall, f1, and flags
    for (const cat of CLAIM_TYPES) {
      const c = summary[cat];
      const tp = c.true_positives;
      c.precision = this.safeDivide(tp, tp + c.false_positives);
      c.recall = this.safeDivide(tp, tp + c.false_negatives);
      c.f1 = this.computeF1(c.precision, c.recall);
      c.exact_span_accuracy = this.safeDivide(c.exact_span_accuracy, tp);
      c.category_accuracy = this.safeDivide(tp, c.ground_truth_count);
      c.insufficient_samples = c.ground_truth_count < 10;
    }

    return summary;
  }

  /**
   * Computes stratified metrics across subgroups.
   */
  public static computeStratifiedMetrics(
    recordSummaries: RecordEvalSummary[],
    totalZodValid: number
  ): StratifiedMetrics {
    const overall = this.computeAggregateMetrics(recordSummaries, totalZodValid);

    const approvedOnly = recordSummaries.filter((r) => !r.is_human_modified);
    const modifiedOnly = recordSummaries.filter((r) => r.is_human_modified);
    const ambiguousCases = recordSummaries.filter((r) => r.has_ambiguity);

    return {
      overall,
      human_approved_only: this.computeAggregateMetrics(approvedOnly, approvedOnly.length),
      human_modified_only: this.computeAggregateMetrics(modifiedOnly, modifiedOnly.length),
      ambiguous_cases: this.computeAggregateMetrics(ambiguousCases, ambiguousCases.length),
    };
  }
}
