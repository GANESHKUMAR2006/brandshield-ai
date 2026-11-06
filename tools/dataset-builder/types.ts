/**
 * BrandShield AI — Standalone Dataset Builder Types
 * Phase 10A: Training Dataset Builder for Offline Claim Extraction
 *
 * Defines the internal dataset representation, provenance tracking,
 * metadata schemas, and partition contracts. Kept strictly independent
 * of external vendor formats (e.g. Adaption AI).
 */

import {
  ClaimType,
  RawExtractedClaim,
  ClaimEntities,
} from "../../src/lib/ai/extraction/extraction-schema";

export type { ClaimType, RawExtractedClaim, ClaimEntities };

export type MarketingChannel =
  | "instagram"
  | "email"
  | "packaging"
  | "landing_page"
  | "amazon_pdp"
  | "google_ads";

export type ProvenanceSourceType =
  | "synthetic_combinatorial"
  | "manually_authored_gold"
  | "curated_public_domain";

export type RiskCategory =
  | "disease_claim"
  | "absolute_guarantee"
  | "prohibited_substance"
  | "exaggerated_clinical";

export interface ProvenanceMetadata {
  source_type: ProvenanceSourceType;
  author_or_generator: string;
  generation_seed?: number;
  created_at: string;
}

export interface ExampleMetadata {
  has_claims: boolean;
  claim_count: number;
  claim_types: ClaimType[];
  is_hard_negative: boolean;
  is_ambiguous: boolean;
  is_high_risk: boolean;
  risk_category?: RiskCategory;
}

export interface HumanReviewAudit {
  status: "approved" | "rejected" | "pending";
  reviewed_by: string;
  reviewed_at: string;
  rejection_reason?: string;
  review_notes?: string;
}

/**
 * Core internal example record.
 * Complete, self-contained, and format-agnostic.
 */
export interface DatasetExample {
  example_id: string;
  campaign_id: string;
  product_id: string;
  product_name: string;
  channel: MarketingChannel;
  content: string; // The verbatim raw marketing copy
  claims: RawExtractedClaim[];
  metadata: ExampleMetadata;
  provenance: ProvenanceMetadata;
  human_review: HumanReviewAudit;
}

export interface PartitionSplit {
  train: DatasetExample[];
  validation: DatasetExample[];
  test: DatasetExample[];
}

export interface ManifestFileEntry {
  file_name: string;
  record_count: number;
  byte_size: number;
  sha256: string;
}

export interface DatasetManifest {
  manifest_version: string;
  dataset_name: string;
  generated_at: string;
  seed: number;
  schema_version: string;
  prompt_version: string;
  statistics: {
    total_generated: number;
    total_approved: number;
    total_rejected: number;
    splits: {
      train: number;
      validation: number;
      test: number;
    };
    category_counts: Record<ClaimType, number>;
    channel_counts: Record<MarketingChannel, number>;
    risk_counts: Record<string, number>;
    zero_claim_count: number;
    multi_claim_count: number;
    single_claim_count: number;
  };
  provenance_distribution: Record<ProvenanceSourceType, number>;
  files: Record<string, ManifestFileEntry>;
  reviewer_signoffs: Array<{
    reviewer_id: string;
    role: string;
    approved_count: number;
    timestamp: string;
  }>;
}

