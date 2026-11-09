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
  | "pending_review"
  | "approved"
  | "changes_requested"
  | "escalated"
  | "rejected"
  | "published";

export type ActivityType =
  | "submission_created"
  | "claim_extracted"
  | "evidence_matched"
  | "review_requested"
  | "approval_granted"
  | "claim_reviewed"
  | "claim_modified"
  | "claim_escalated"
  | "claim_overridden"
  | "publication_status_updated"
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
  review_status?: ReviewStatus;
  assigned_reviewer?: string | null;
  last_reviewed_at?: string | null;
  review_notes?: string | null;
  original_claim_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Associated metadata
  product_name?: string | null;
  product_sku?: string | null;
  submission_title?: string | null;
  version_number?: number | null;
  // Phase 9 Policy Intelligence fields
  policy_compliance_status?: PolicyComplianceStatus | null;
  mandatory_reviewer_role?: ReviewerRole | null;
  required_evidence_types?: string[] | null;
  triggered_policy_rules?: TriggeredRule[] | null;
}

// Phase 6: Human Compliance Review & Publication Gate Types
export type ReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "modified"
  | "escalated";

export type ReviewDecisionType = "approved" | "rejected" | "escalated" | "modified";

export type ReviewerRole = "admin" | "compliance_reviewer" | "legal_reviewer" | "creator" | "viewer";

export interface WorkspaceMembership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: ReviewerRole;
  status: "active" | "suspended" | "revoked";
  created_at: string;
  updated_at: string;
  workspace_name?: string;
  workspace_slug?: string;
  user_email?: string;
  user_name?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: ReviewerRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  token_hash?: string;
  invited_by?: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at?: string;
  workspace_name?: string;
  workspace_slug?: string;
}

export type EscalationCategory =
  | "legal"
  | "regulatory"
  | "clinical"
  | "brand_compliance"
  | "evidence_conflict"
  | "other";

export type PublicationStatus = "ineligible" | "eligible" | "published";

export interface PublicationEligibilityDetails {
  isEligible: boolean;
  eligible?: boolean;
  totalActiveClaims: number;
  approvedClaims: number;
  unreviewedClaims: number;
  contradictedClaims: number;
  rejectedClaims: number;
  escalatedClaims: number;
  hasHighOrCriticalRisk: boolean;
  blockingReasons: string[];
  evaluatedAt: string;
  // Phase 9 Policy Intelligence
  policyViolationsCount?: number;
  unmetEvidenceRequirementsCount?: number;
  missingMandatorySignoffsCount?: number;
}

export interface ReviewDecisionRecord {
  id: string;
  claim_id: string;
  reviewer_id: string;
  decision: ReviewDecisionType;
  comments: string | null;
  workspace_id: string;
  submission_id: string;
  reviewer_role: ReviewerRole;
  verification_run_id: string | null;
  original_claim_text: string | null;
  modified_claim_text: string | null;
  escalation_category: EscalationCategory | null;
  override_reason: string | null;
  previous_workflow_state: string | null;
  new_workflow_state: string;
  created_at: string;
}

export interface ReviewQueueItem extends ClaimRecord {
  submission_channel?: string | null;
  submission_status?: string | null;
  decisions_count?: number;
  latest_decision?: ReviewDecisionType | null;
}

// ============================================================================
// Phase 8: Audit Logging, Analytics & Admin Intelligence Types
// ============================================================================

export type AuditEntityType =
  | "submission"
  | "submission_version"
  | "claim"
  | "source_document"
  | "document_version"
  | "document_chunk"
  | "review_decision"
  | "verification_run"
  | "extraction_run"
  | "publication"
  | "workspace"
  | "policy"
  | "policy_version";

export type AuditActionType =
  | "submission_created"
  | "submission_edited"
  | "submission_submitted"
  | "claims_extracted"
  | "claims_reextracted"
  | "verification_started"
  | "verification_completed"
  | "claim_evidence_linked"
  | "document_uploaded"
  | "document_chunks_ingested"
  | "document_approved"
  | "document_superseded"
  | "document_expired"
  | "claim_reviewed"
  | "claim_approved"
  | "claim_rejected"
  | "claim_modified"
  | "claim_escalated"
  | "claim_overridden"
  | "policy_override_applied"
  | "publication_eligibility_evaluated"
  | "submission_published"
  | "publication_status_updated"
  | "policy_created"
  | "policy_updated"
  | "policy_activated"
  | "policy_archived"
  | "policy_overridden";

export interface AuditEventRecord {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_role?: ReviewerRole | string;
  entity_type: AuditEntityType | string;
  entity_id: string;
  action: AuditActionType | string;
  correlation_id?: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditTrailQuery {
  workspaceSlug?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailStats {
  total_events: number;
  human_signoffs: number;
  policy_overrides: number;
  publication_events: number;
}

export interface ComplianceAnalyticsSummary {
  workspaceSlug: string;
  // Submission Metrics
  totalSubmissions: number;
  publishedSubmissions: number;
  draftSubmissions: number;
  publicationBlockedSubmissions: number;
  // Claim Volume & Lineage Metrics
  totalExtractedClaims: number;
  activeClaims: number;
  supersededClaims: number;
  claimsAwaitingReview: number;
  // Verification Status Breakdown (Active Claims)
  claimsByVerificationStatus: {
    supported: number;
    contradicted: number;
    needs_review: number;
    unverified: number;
    outdated: number;
  };
  // Risk Level Breakdown (Active Claims)
  claimsByRiskLevel: {
    low: number;
    medium: number;
    high: number;
    critical: number;
    unclassified: number;
  };
  // Review Status Breakdown (Active Claims)
  claimsByReviewStatus: {
    pending: number;
    in_review: number;
    approved: number;
    rejected: number;
    modified: number;
    escalated: number;
  };
  // Governance Ratios & Turnaround (Calculated across UNIQUE active claims)
  totalDecidedClaims: number;
  approvalRate: number; // 0.0 - 100.0% (Unique active claims approved / total unique decided claims)
  rejectionRate: number; // 0.0 - 100.0%
  escalationRate: number; // 0.0 - 100.0%
  modificationRate: number; // 0.0 - 100.0%
  evidenceCoveragePercentage: number; // Active claims with >= 1 linked evidence (0.0 - 100.0%)
  averageReviewTurnaroundHours: number; // Hours between creation and decision
  // Historical Review Decision Events (tracking all historical decision attempts in review_decisions)
  historicalDecisionEvents: {
    totalEvents: number;
    approvedEvents: number;
    rejectedEvents: number;
    modifiedEvents: number;
    escalatedEvents: number;
    overrideEvents: number;
  };
  decisionEventApprovalRate: number; // 0.0 - 100.0% (approved events / total events)
  // Source Document Validity
  sourceDocumentMetrics: {
    totalApproved: number;
    expiredCount: number;
    expiringSoonCount: number; // Valid until within next 30 days
  };
  calculatedAt: string;
}

export type InsightSeverity = "critical" | "high" | "medium" | "low";

export type InsightType =
  | "high_risk_unreviewed"
  | "repeatedly_contradicted"
  | "source_expiring"
  | "low_evidence_coverage"
  | "slow_review_turnaround"
  | "frequent_modifications";

export interface ComplianceInsight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  metricContext: string;
  suggestedInvestigation: string;
  affectedEntityIds?: string[];
}

// ============================================================================
// Phase 9: Policy Intelligence & Compliance Configuration Types
// ============================================================================

export type PolicyCategory =
  | "prohibited_claims"
  | "restricted_efficacy"
  | "clinical_requirements"
  | "guarantee_restrictions"
  | "comparative_advertising"
  | "price_discount_rules"
  | "promotion_validity"
  | "required_disclaimers"
  | "mandatory_human_review"
  | "product_restrictions";

export type RuleSeverity = "low" | "medium" | "high" | "critical";

export type RuleConditionOperator =
  | "contains_phrase"
  | "matches_regex"
  | "equals"
  | "not_equals"
  | "in_list"
  | "not_in_list"
  | "lacks_evidence_type"
  | "lacks_disclaimer"
  | "claim_type_is"
  | "price_deviation_exceeds"
  | "discount_exceeds";

export type PolicyRuleAction =
  | "flag_violation"
  | "require_evidence"
  | "require_human_review"
  | "block_publication";

export interface PolicyCondition {
  field: "claim_text" | "claim_type" | "product_id" | "channel" | "extracted_entities" | "evidence_types" | "disclaimer";
  operator: RuleConditionOperator;
  value: string | string[] | number | boolean;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: RuleSeverity;
  conditions: PolicyCondition[];
  logic: "ALL" | "ANY";
  action: PolicyRuleAction;
  requiredEvidenceTypes?: string[];
  mandatoryReviewerRole?: ReviewerRole;
  suggestedCorrection?: string;
  explanationTemplate: string;
}

export type PolicyStatus = "draft" | "active" | "archived";
export type PolicyVersionStatus = "draft" | "active" | "archived" | "superseded";

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version_number: number;
  status: PolicyVersionStatus;
  description?: string | null;
  valid_from: string;
  valid_until?: string | null;
  rules: PolicyRule[];
  metadata?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  activated_at?: string | null;
  archived_at?: string | null;
}

export interface Policy {
  id: string;
  workspace_id: string;
  product_id?: string | null;
  product_name?: string | null;
  product_sku?: string | null;
  name: string;
  code: string;
  description?: string | null;
  category: PolicyCategory;
  status: PolicyStatus;
  active_version_id?: string | null;
  active_version_number?: number | null;
  versions_count?: number;
  rules_count?: number;
  created_at: string;
  updated_at: string;
  active_version?: PolicyVersion | null;
  versions?: PolicyVersion[];
}

export type PolicyComplianceStatus = "compliant" | "non_compliant" | "review_required" | "pending";

export interface TriggeredRule {
  ruleId: string;
  ruleName: string;
  policyId: string;
  policyCode: string;
  policyVersionNumber: number;
  category: PolicyCategory;
  severity: RuleSeverity;
  action: PolicyRuleAction;
  matchedConditions: string[];
  requiredEvidenceTypes: string[];
  mandatoryReviewerRole?: ReviewerRole;
  explanation: string;
  suggestedCorrection?: string;
}

export interface PolicyEvaluationResult {
  claimId: string;
  complianceStatus: PolicyComplianceStatus;
  maxSeverity: RuleSeverity | null;
  triggeredRules: TriggeredRule[];
  requiredEvidenceTypes: string[];
  mandatoryReviewerRoles: ReviewerRole[];
  effectivePolicyVersions: {
    policyId: string;
    versionId: string;
    versionNumber: number;
    policyCode: string;
  }[];
  summary: string;
}

export interface PolicySimulationSampleClaim {
  id?: string;
  claim_text: string;
  claim_type?: string;
  product_id?: string | null;
  channel?: string;
  submission_content?: string;
  evidence_types?: string[];
}

export interface PolicySimulationRequest {
  policyId?: string;
  draftRules?: PolicyRule[];
  sampleClaims: PolicySimulationSampleClaim[];
  productId?: string | null;
  channel?: string;
}

export interface PolicySimulationResult {
  evaluatedClaimsCount: number;
  compliantCount: number;
  reviewRequiredCount: number;
  nonCompliantCount: number;
  claimResults: {
    claimText: string;
    claimType: string;
    complianceStatus: PolicyComplianceStatus;
    maxSeverity: RuleSeverity | null;
    triggeredRules: TriggeredRule[];
    requiredEvidenceTypes: string[];
    mandatoryReviewerRoles: ReviewerRole[];
    summary: string;
  }[];
  timestamp: string;
}



