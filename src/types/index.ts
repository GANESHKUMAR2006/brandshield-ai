export type ClaimStatus =
  | "supported"
  | "requires_review"
  | "unsupported"
  | "flagged";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "processing"
  | "under_review"
  | "in_review"
  | "approved"
  | "changes_requested"
  | "rejected";

export type ActivityType =
  | "submission_created"
  | "claim_extracted"
  | "evidence_matched"
  | "review_requested"
  | "approval_granted"
  | "source_updated";

export interface Workspace {
  id: string;
  name: string;
  domain: string;
  plan: string;
  complianceTier: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

export interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  description?: string;
}

export interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  change?: string;
  changeType?: "increase" | "decrease" | "neutral";
  helperText?: string;
  isSample: boolean;
}

export interface SubmissionItem {
  id: string;
  title: string;
  channel: string;
  status: SubmissionStatus;
  totalClaims: number;
  supportedClaims: number;
  reviewRequiredClaims: number;
  submittedBy: string;
  submittedAt: string;
}

export interface ClaimItem {
  id: string;
  submissionId: string;
  claimText: string;
  category: "efficacy" | "ingredient" | "safety" | "sustainability";
  status: ClaimStatus;
  confidenceScore: number;
  evidenceSource?: string;
  evidencePage?: number;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  entityId?: string;
}

export interface SourceDocumentItem {
  id: string;
  title: string;
  category: "clinical_trial" | "regulatory_dossier" | "brand_guidelines" | "spec_sheet";
  fileType: "pdf" | "docx";
  claimsVerifiedCount: number;
  status: "active" | "archived" | "processing";
  uploadedAt: string;
  fileSize: string;
}

// Phase 4: Extraction Engine Types
export type ClaimType =
  | "price"
  | "discount"
  | "product_attribute"
  | "efficacy"
  | "guarantee"
  | "comparative"
  | "clinical"
  | "availability"
  | "promotional"
  | "other";

export interface ClaimEntities {
  ingredient?: string;
  concentration?: number | string;
  unit?: string;
  price?: number;
  currency?: string;
  discount_percentage?: number;
  discount_amount?: number;
  timeline?: string;
  comparison_target?: string;
  [key: string]: unknown;
}

export interface ExtractedClaimPayload {
  claim_text: string;
  claim_type: ClaimType;
  text_start: number;
  text_end: number;
  product_hint?: string | null;
  entities?: ClaimEntities;
  extraction_confidence: number;
}

export interface ExtractionRun {
  id: string;
  workspace_id: string;
  submission_id: string;
  submission_version_id: string;
  provider: string;
  model_identifier: string;
  prompt_version: string;
  status: "running" | "completed" | "failed";
  claims_count: number;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
}

export interface ClaimRecord {
  id: string;
  submission_id: string;
  submission_version_id: string;
  extraction_run_id?: string | null;
  claim_text: string;
  claim_type: ClaimType | string;
  text_start: number | null;
  text_end: number | null;
  product_id: string | null;
  extracted_entities: ClaimEntities;
  extraction_confidence: number;
  verification_status: "supported" | "contradicted" | "outdated" | "unverified" | "needs_review";
  risk_level?: "low" | "medium" | "high" | "critical" | null;
  verified_at?: string | null;
  evidence_sufficiency?: string | null;
  explanation?: string | null;
  suggested_correction?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Associated metadata
  product_name?: string | null;
  product_sku?: string | null;
  submission_title?: string | null;
  version_number?: number | null;
}

