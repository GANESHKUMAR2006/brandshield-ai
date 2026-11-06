/**
 * BrandShield AI — Baseline Extraction Evaluation Types
 * Phase 10D: Controlled Baseline Evaluation Harness
 *
 * Strict typing for evaluation records, prediction capture, matching results,
 * and aggregate/category compliance metrics.
 */

import { ClaimType, RawExtractedClaim } from "../../src/lib/ai/extraction/extraction-schema";
import { EvaluationClaim, HumanReviewStatus } from "../dataset-builder/phase10b/types";
import { ValidationReport } from "../../src/lib/ai/validation/claim-validator";

export interface EvaluationInputRecord {
  example_id: string;
  channel: string;
  brand_or_product_name: string;
  product_id: string | null;
  content: string;
  ground_truth_claims: EvaluationClaim[];
  review_status: HumanReviewStatus;
  reviewer_name: string;
  has_ambiguity: boolean;
  is_human_approved: boolean; // reviewed_approved or human_verified
  is_human_modified: boolean; // reviewed_modified or human_modified
}

export interface PredictionRecord {
  example_id: string;
  raw_response_text: string;
  parsed_claims: RawExtractedClaim[];
  validation_report: ValidationReport;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  latency_ms: number;
}

export type MatchType = "exact_span" | "relaxed_overlap" | "unmatched";

export interface ClaimMatchPair {
  ground_truth?: EvaluationClaim;
  predicted?: RawExtractedClaim;
  match_type: MatchType;
  iou: number;
  span_exact: boolean;
  category_exact: boolean;
  entity_match_score?: number;
  entity_mismatches?: string[];
}

export interface RecordEvalSummary {
  example_id: string;
  review_status: HumanReviewStatus;
  is_human_modified: boolean;
  has_ambiguity: boolean;
  is_zero_claim: boolean;
  ground_truth_count: number;
  predicted_count: number;
  true_positives_exact: number;
  true_positives_relaxed: number;
  false_positives: number;
  false_negatives: number;
  zero_claim_false_positive: boolean;
  matches: ClaimMatchPair[];
}

export interface CategoryMetricSummary {
  category: ClaimType;
  ground_truth_count: number;
  predicted_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1: number;
  exact_span_accuracy: number;
  category_accuracy: number;
  insufficient_samples: boolean; // Flagged when N < 10
}

export interface AggregateMetrics {
  total_records_evaluated: number;
  human_approved_count: number;
  human_modified_count: number;
  ambiguous_record_count: number;
  zero_claim_records_count: number;

  total_ground_truth_claims: number;
  total_predicted_claims: number;

  // Strict (Exact Span) Metrics
  strict_true_positives: number;
  strict_false_positives: number;
  strict_false_negatives: number;
  strict_precision: number;
  strict_recall: number;
  strict_f1: number;

  // Relaxed (IoU >= 0.5) Metrics
  relaxed_true_positives: number;
  relaxed_false_positives: number;
  relaxed_false_negatives: number;
  relaxed_precision: number;
  relaxed_recall: number;
  relaxed_f1: number;

  // Alignment Accuracies
  exact_span_accuracy: number; // percentage of matched pairs with identical [start..end]
  category_accuracy: number;   // percentage of matched pairs with identical claim_type
  entity_accuracy: number;     // percentage of matched entities with matching values

  // Error Rates
  zero_claim_false_positive_rate: number; // FP on zero-claim records / zero-claim records count
  structured_output_success_rate: number; // schema validity rate
}

export interface StratifiedMetrics {
  overall: AggregateMetrics;
  human_approved_only: AggregateMetrics;
  human_modified_only: AggregateMetrics;
  ambiguous_cases: AggregateMetrics;
}

export interface BaselineEvaluationReport {
  evaluation_metadata: {
    run_timestamp: string;
    model: string;
    provider: string;
    prompt_version: string;
    dataset_file: string;
    dataset_sha256: string;
    total_eligible_records: number;
    total_evaluated_records: number;
    total_excluded_ai_records: number;
  };
  cost_and_usage: {
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    estimated_cost_usd: number;
    actual_cost_usd?: number;
  };
  metrics: StratifiedMetrics;
  per_category: Record<ClaimType, CategoryMetricSummary>;
  error_analysis: {
    false_positives_examples: Array<{
      example_id: string;
      predicted_text: string;
      predicted_type: string;
      reason: string;
    }>;
    false_negatives_examples: Array<{
      example_id: string;
      ground_truth_text: string;
      ground_truth_type: string;
      reason: string;
    }>;
    category_confusion_examples: Array<{
      example_id: string;
      claim_text: string;
      ground_truth_type: string;
      predicted_type: string;
    }>;
    span_drift_examples: Array<{
      example_id: string;
      ground_truth_text: string;
      predicted_text: string;
      iou: number;
    }>;
  };
}
