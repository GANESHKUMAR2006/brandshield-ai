/**
 * BrandShield AI — Claim Verification Engine Types
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Types and contracts for deterministic verification rules, evidence matching,
 * risk scoring, and snapshot recording.
 */

export type VerificationStatus =
  | "supported"
  | "contradicted"
  | "outdated"
  | "unverified"
  | "needs_review";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type EvidenceSufficiencyLevel =
  | "sufficient"
  | "insufficient"
  | "conflicting"
  | "outdated";

export type EvidenceType =
  | "approved_fact"
  | "promotional_rule"
  | "clinical_dossier"
  | "catalog_price";

export interface EvidenceMatch {
  approvedFactId?: string | null;
  documentVersionId?: string | null;
  promotionId?: string | null;
  evidenceExcerpt: string;
  evidenceType: EvidenceType;
  relevanceScore: number;
}

export interface RuleResult {
  ruleId: string;
  status: VerificationStatus;
  riskLevel: RiskLevel;
  sufficiency: EvidenceSufficiencyLevel;
  explanation: string;
  suggestedCorrection?: string | null;
  evidenceMatches: EvidenceMatch[];
}

export interface ContextProduct {
  id: string;
  name: string;
  sku: string;
  reference_price: number;
  currency: string;
  status: string;
}

export interface ContextApprovedFact {
  id: string;
  product_id: string;
  fact_key: string;
  fact_value: Record<string, unknown>;
  fact_type: string;
  approval_status: string;
  source_document_id: string | null;
  valid_from: string;
  valid_until: string | null;
}

export interface ContextPromotion {
  id: string;
  product_id: string;
  promotion_name: string;
  discount_type: string; // 'fixed' | 'percentage' | 'bundle'
  discount_value: number;
  resulting_price: number;
  currency: string;
  start_date: string;
  end_date: string;
  applicable_channels: string[] | unknown;
  terms: string | null;
  status: string;
}

export interface ContextSourceDocument {
  id: string;
  title: string;
  document_type: string;
  current_version_id: string | null;
  current_version_number: number | null;
  approval_status: string;
  valid_from: string | null;
  valid_until: string | null;
}

export interface VerificationContext {
  claim: {
    id: string;
    claim_text: string;
    claim_type: string;
    text_start: number | null;
    text_end: number | null;
    product_id: string | null;
    extracted_entities: Record<string, unknown>;
    extraction_confidence: number;
  };
  submission: {
    id: string;
    title: string;
    channel: string;
    product_id: string | null;
    submission_date: string;
    created_at: string;
  };
  submissionVersion: {
    id: string;
    version_number: number;
    content: string;
  };
  product: ContextProduct | null;
  approvedFacts: ContextApprovedFact[];
  promotions: ContextPromotion[];
  sourceDocuments: ContextSourceDocument[];
  effectiveDate: Date;
  channel: string;
}

export interface VerificationRunSnapshot {
  claim_id: string;
  claim_text: string;
  claim_type: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  submission_id: string;
  submission_version_id: string;
  verification_date: string;
  effective_evidence_date: string;
  rule_id: string;
  rule_engine_version: string;
  verification_status: VerificationStatus;
  risk_level: RiskLevel;
  evidence_sufficiency: EvidenceSufficiencyLevel;
  explanation: string;
  suggested_correction: string | null;
  matched_facts: Array<{
    id: string;
    fact_key: string;
    fact_value: Record<string, unknown>;
  }>;
  matched_promotions: Array<{
    id: string;
    name: string;
    resulting_price: number;
  }>;
  evidence_links: EvidenceMatch[];
}

export interface VerificationExecutionResult {
  runId: string;
  claimId: string;
  status: VerificationStatus;
  riskLevel: RiskLevel;
  explanation: string;
  suggestedCorrection: string | null;
  evidenceSufficiency: EvidenceSufficiencyLevel;
  evidenceCount: number;
  evidence: EvidenceMatch[];
  snapshot: VerificationRunSnapshot;
  verifiedAt: string;
}
