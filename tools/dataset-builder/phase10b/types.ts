/**
 * BrandShield AI — Phase 10B Real-World Evaluation Dataset Types
 * Standalone Quality Measurement & Human Review Annotation Engine
 *
 * Strictly decoupled from Phase 10A synthetic generation and vendor formats.
 * Enforces review provenance: automated reviews are explicitly distinguished
 * from genuine human reviews.
 */

import {
  ClaimType,
  ClaimEntities,
} from "../../../src/lib/ai/extraction/extraction-schema";

export type { ClaimType, ClaimEntities };

export type EvaluationChannel =
  | "social_media_ad"
  | "landing_page"
  | "ecommerce_pdp"
  | "email_promotion"
  | "packaging"
  | "search_ad";

export type HumanReviewStatus =
  | "unreviewed"
  | "reviewed_approved"
  | "reviewed_modified"
  | "rejected"
  | "ai_audited_approved"
  | "ai_audited_modified"
  | "needs_human_adjudication"
  | "human_verified"
  | "human_modified";

export type AnnotationClaimState =
  | "draft_proposal"
  | "human_verified"
  | "human_corrected"
  | "human_added"
  | "ai_audited_verified"
  | "ai_audited_corrected"
  | "flagged_ambiguous";

export interface EvaluationClaim {
  claim_id: string;
  claim_text: string;
  claim_type: ClaimType;
  text_start: number; // UTF-16 code unit offset (inclusive)
  text_end: number;   // UTF-16 code unit offset (exclusive)
  product_hint: string | null; // Null where association is ambiguous or unstated
  entities: ClaimEntities;
  extraction_confidence: number;
  annotation_state: AnnotationClaimState;
}

export interface ReviewChangeLogEntry {
  action:
    | "approved"
    | "modified_claim"
    | "added_claim"
    | "removed_claim"
    | "rejected"
    | "ai_audited_approved"
    | "ai_audited_modified"
    | "flagged_ambiguous"
    | "human_verified"
    | "human_modified"
    | "automated_remediation";
  timestamp: string; // ISO 8601
  reviewer_name: string;
  details: string;
  before_snapshot?: EvaluationClaim[];
  after_snapshot?: EvaluationClaim[];
}

export interface HumanAnnotationMetadata {
  review_status: HumanReviewStatus;
  reviewer_name: string | null;
  reviewer_email: string | null;
  reviewed_at: string | null; // ISO 8601
  review_notes: string | null;
  previous_ai_audit?: {
    review_status: HumanReviewStatus;
    reviewer_name: string;
    reviewer_email: string;
    reviewed_at: string;
    review_notes: string;
  };
  change_log: ReviewChangeLogEntry[];
}

export interface EvaluationMetadata {
  has_claims: boolean;
  claim_count: number;
  claim_types: ClaimType[];
  has_ambiguity: boolean;
  has_numerical_claim: boolean;
  has_promotional_conditions: boolean;
  has_high_risk_language: boolean;
  risk_types?: Array<
    | "disease_claim"
    | "absolute_guarantee"
    | "exaggerated_clinical"
    | "unsubstantiated_efficacy"
  >;
}

export interface EvaluationProvenance {
  source_type: "curated_real_world" | "expert_authored";
  curator: string;
  created_at: string; // ISO 8601
}

export interface EvaluationExample {
  example_id: string; // e.g. "eval_10b_001"
  channel: EvaluationChannel;
  brand_or_product_name: string;
  product_id: string | null; // Null where ambiguous
  content: string; // Verbatim raw marketing copy
  claims: EvaluationClaim[];
  metadata: EvaluationMetadata;
  provenance: EvaluationProvenance;
  human_annotation: HumanAnnotationMetadata;
}

export interface Phase10BManifest {
  manifest_version: string;
  dataset_name: string;
  created_at: string;
  file_name: string;
  file_size_bytes: number;
  sha256: string;
  statistics: {
    total_prepared: number;
    genuinely_reviewed_by_humans: number;
    ai_audited_approved_count: number;
    ai_audited_modified_count: number;
    needs_human_adjudication_count: number;
    awaiting_human_review: number;
    rejected_count: number;
    status_breakdown: Record<HumanReviewStatus, number>;
    category_counts: Record<ClaimType, number>;
    channel_counts: Record<EvaluationChannel, number>;
    zero_claim_count: number;
    single_claim_count: number;
    multi_claim_count: number;
    ambiguous_count: number;
    numerical_claim_count: number;
    promotional_condition_count: number;
    high_risk_count: number;
  };
  cross_split_leakage_audit: {
    exact_duplicates_with_phase10a_train: number;
    exact_duplicates_with_phase10a_val: number;
    exact_duplicates_with_phase10a_test: number;
    intra_phase10b_duplicates: number;
    max_jaccard_similarity_with_phase10a: number;
  };
  reviewer_audit_log: Array<{
    reviewer_name: string;
    reviewer_email: string;
    reviews_completed: number;
    last_active: string;
  }>;
}
