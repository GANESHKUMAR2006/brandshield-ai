export interface LiveSourceDocument {
  id: string;
  title: string;
  document_type: string;
  description: string | null;
  approval_status: string;
  created_at: string;
  updated_at: string;
  current_version_id: string | null;
  current_version_number: number | null;
  storage_path: string | null;
  content_hash: string | null;
  approval_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_expired: boolean;
  is_superseded: boolean;
}

export interface LiveDocumentVersion {
  id: string;
  source_document_id: string;
  version_number: number;
  storage_path: string;
  content_hash: string;
  approval_date: string | null;
  valid_from: string;
  valid_until: string | null;
  superseded_at: string | null;
  approval_status: string;
  created_at: string;
  is_expired: boolean;
  is_superseded: boolean;
  is_current: boolean;
}

export interface LiveProduct {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  reference_price: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LiveApprovedFact {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  fact_key: string;
  fact_value: Record<string, unknown> | unknown;
  fact_type: string;
  approval_status: string;
  source_document_id: string | null;
  source_document_title: string | null;
  valid_from: string;
  valid_until: string | null;
  is_expired: boolean;
  created_at: string;
}

export interface LivePromotion {
  id: string;
  product_id: string;
  product_name: string;
  promotion_name: string;
  discount_type: string;
  discount_value: number;
  resulting_price: number;
  currency: string;
  start_date: string;
  end_date: string;
  applicable_channels: string[] | unknown;
  terms: string | null;
  status: string;
  is_currently_active: boolean;
  created_at: string;
}

export interface SourcesResponseData {
  documents: LiveSourceDocument[];
  documentVersions: LiveDocumentVersion[];
  products: LiveProduct[];
  approvedFacts: LiveApprovedFact[];
  promotions: LivePromotion[];
}

export interface LiveSubmission {
  id: string;
  workspace_id: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  title: string;
  content: string;
  channel: string;
  status: string;
  publication_status?: string | null;
  publicationStatus?: string | null;
  submitted_by: string;
  submission_date: string;
  created_at: string;
  updated_at: string;
  current_version_id?: string | null;
  current_version_number: number;
  total_versions_count: number;
  total_claims_count: number;
  supported_claims_count: number;
  review_claims_count: number;
}

export interface LiveSubmissionVersion {
  id: string;
  version_number: number;
  content: string;
  created_at: string;
  created_by: string;
}

export interface LiveClaimDetail {
  id: string;
  submission_version_id: string;
  claim_text: string;
  claim_type: string;
  text_start?: number | null;
  text_end?: number | null;
  product_id?: string | null;
  extracted_entities?: Record<string, unknown>;
  extraction_confidence: number;
  verification_status: string;
  risk_level?: "low" | "medium" | "high" | "critical" | null;
  verified_at?: string | null;
  evidence_sufficiency: string | null;
  explanation: string | null;
  suggested_correction: string | null;
  created_at: string;
}

export interface LiveSubmissionDetails extends LiveSubmission {
  versions: LiveSubmissionVersion[];
  claims: LiveClaimDetail[];
  publication_status?: string | null;
  publication_eligibility_details?: unknown;
}

export async function fetchSourcesData(): Promise<SourcesResponseData> {
  const res = await fetch("/api/sources", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch sources: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchSubmissions(): Promise<LiveSubmission[]> {
  const res = await fetch("/api/submissions", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch submissions: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchSubmissionDetails(id: string): Promise<LiveSubmissionDetails> {
  const res = await fetch(`/api/submissions/${id}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch submission details: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function createSubmission(payload: {
  title: string;
  content: string;
  channel: string;
  productId?: string | null;
  submittedBy?: string;
}): Promise<LiveSubmission> {
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.details?.join(", ") || json.error || "Failed to create submission");
  }
  return json.data;
}

export async function updateSubmission(
  id: string,
  payload: {
    title?: string;
    content?: string;
    channel?: string;
    status?: string;
    productId?: string | null;
    actor?: string;
  }
): Promise<LiveSubmission> {
  const res = await fetch(`/api/submissions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.details?.join(", ") || json.error || "Failed to update submission");
  }
  return json.data;
}

// Phase 4: Extraction Engine API Clients

export interface ExtractionResultPayload {
  runId: string;
  submissionId: string;
  versionId: string;
  versionNumber: number;
  provider: string;
  model: string;
  promptVersion: string;
  claimsCount: number;
  claims: Array<{
    id: string;
    claim_text: string;
    claim_type: string;
    text_start: number;
    text_end: number;
    product_id: string | null;
    extracted_entities: Record<string, unknown>;
    extraction_confidence: number;
    verification_status: string;
  }>;
  executionTimeMs: number;
}

export async function extractClaims(
  submissionId: string,
  options?: { versionId?: string; forceReextract?: boolean }
): Promise<ExtractionResultPayload> {
  const res = await fetch(`/api/submissions/${submissionId}/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.details?.join(", ") || json.error || "Claim extraction failed");
  }
  return json.data;
}

export interface LiveClaimRecord {
  id: string;
  submission_id: string;
  submission_version_id: string;
  extraction_run_id: string | null;
  claim_text: string;
  claim_type: string;
  text_start: number | null;
  text_end: number | null;
  product_id: string | null;
  extracted_entities: Record<string, unknown>;
  extraction_confidence: number;
  verification_status: string;
  risk_level?: "low" | "medium" | "high" | "critical" | null;
  verified_at?: string | null;
  evidence_sufficiency: string | null;
  explanation: string | null;
  suggested_correction: string | null;
  review_status?: string | null;
  assigned_reviewer?: string | null;
  last_reviewed_at?: string | null;
  review_notes?: string | null;
  original_claim_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_name: string | null;
  product_sku: string | null;
  submission_title: string | null;
  version_number: number | null;
  extraction_provider?: string | null;
  extraction_model?: string | null;
  version_content?: string | null;
  submission_channel?: string | null;
  extraction_timestamp?: string | null;
  evidence_count?: number;
  policy_compliance_status?: string | null;
  mandatory_reviewer_role?: string | null;
  required_evidence_types?: string[] | null;
  triggered_policy_rules?: unknown;
  evidence?: Array<{
    id: string;
    approved_fact_id: string | null;
    document_version_id: string | null;
    evidence_excerpt: string;
    relevance_score: number;
    evidence_type: string;
    fact_key?: string;
    document_title?: string;
    stance?: string;
    superseded_at?: string | null;
    version_number?: number | null;
    page_number?: number | null;
    section_reference?: string | null;
    retrieval_rationale?: string | null;
  }>;
  verification_history?: Array<{
    id: string;
    engine_version: string;
    verification_status: string;
    risk_level: string;
    explanation: string;
    evidence_snapshot: Record<string, unknown>;
    created_at: string;
  }>;
  review_history?: Array<{
    id: string;
    reviewer_id: string;
    reviewer_role?: string;
    decision: string;
    comments: string | null;
    override_reason?: string | null;
    modified_claim_text?: string | null;
    child_claim_id?: string | null;
    created_at: string;
  }>;
}

export async function fetchClaims(filters?: {
  submissionId?: string;
  claimType?: string;
  status?: string;
  riskLevel?: string;
  productId?: string;
  search?: string;
}): Promise<LiveClaimRecord[]> {
  const params = new URLSearchParams();
  if (filters?.submissionId) params.append("submissionId", filters.submissionId);
  if (filters?.claimType) params.append("claimType", filters.claimType);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.riskLevel) params.append("riskLevel", filters.riskLevel);
  if (filters?.productId) params.append("productId", filters.productId);
  if (filters?.search) params.append("search", filters.search);

  const url = `/api/claims${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.error || errJson?.details || "";
    } catch {
      // Fall back to status text
    }
    const reason = detail ? `: ${detail}` : (res.statusText ? `: ${res.statusText}` : ` (HTTP ${res.status})`);
    throw new Error(`Failed to fetch claims${reason}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchClaimDetail(id: string): Promise<LiveClaimRecord> {
  const res = await fetch(`/api/claims/${id}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch claim detail: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export interface VerificationResultPayload {
  runId: string;
  claimId: string;
  status: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  explanation: string;
  suggestedCorrection: string | null;
  evidenceSufficiency: string;
  evidenceCount: number;
  verifiedAt: string;
}

export async function verifyClaim(id: string): Promise<VerificationResultPayload> {
  const res = await fetch(`/api/claims/${id}/verify`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Claim verification failed");
  }
  return json.data;
}

export async function verifySubmissionClaims(
  submissionId: string
): Promise<VerificationResultPayload[]> {
  const res = await fetch(`/api/submissions/${submissionId}/verify`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Bulk claim verification failed");
  }
  return json.data;
}

// ============================================================================
// Phase 6: Human Review & Publication API Clients
// ============================================================================

export interface ReviewQueueResponse {
  data: LiveClaimRecord[];
  reviewer: {
    id: string;
    name: string;
    role: string;
  };
  totalCount: number;
}

export async function fetchReviewQueue(filters?: {
  riskLevel?: string;
  reviewStatus?: string;
  claimType?: string;
  search?: string;
}): Promise<ReviewQueueResponse> {
  const params = new URLSearchParams();
  if (filters?.riskLevel) params.append("riskLevel", filters.riskLevel);
  if (filters?.reviewStatus) params.append("reviewStatus", filters.reviewStatus);
  if (filters?.claimType) params.append("claimType", filters.claimType);
  if (filters?.search) params.append("search", filters.search);

  const res = await fetch(`/api/reviews?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch review queue");
  }
  return await res.json();
}

export async function submitReviewDecision(input: {
  claimId: string;
  decision: "approved" | "rejected" | "escalated" | "modified";
  comments?: string;
  overrideReason?: string;
  escalationCategory?: string;
  modifiedClaimText?: string;
}): Promise<unknown> {
  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit review decision");
  }
  return await res.json();
}

export async function publishSubmission(submissionId: string): Promise<{
  submissionId: string;
  title: string;
  status: string;
  publicationStatus: string;
  publishedAt: string;
}> {
  const res = await fetch(`/api/submissions/${submissionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Campaign publication failed");
  }
  const json = await res.json();
  return json.data;
}

// ============================================================================
// Phase 7: Evidence Intelligence API Clients
// ============================================================================

export async function discoverClaimEvidence(
  claimId: string,
  options?: { similarityThreshold?: number; limit?: number }
): Promise<{
  success: boolean;
  message: string;
  data: {
    claimId: string;
    retrievedCount: number;
    linkedEvidence: Array<{
      id: string;
      sourceDocumentTitle: string;
      documentType: string;
      versionNumber: number;
      content: string;
      relevanceScore: number;
      retrievalRationale: string;
      stance: string;
      pageNumber?: number;
      sectionHeading?: string;
    }>;
  };
}> {
  const res = await fetch(`/api/claims/${claimId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to discover evidence");
  }
  return json;
}

// ============================================================================
// Phase 8: Audit Logging & Analytics API Clients
// ============================================================================

export interface AuditLogItem {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_role?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  correlation_id?: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAuditEvents(filters?: {
  search?: string;
  entityType?: string;
  action?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: AuditLogItem[];
  stats: {
    total_events: number;
    human_signoffs: number;
    policy_overrides?: number;
    publication_events?: number;
  };
}> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.entityType) params.append("entityType", filters.entityType);
  if (filters?.action) params.append("action", filters.action);
  if (filters?.actorId) params.append("actorId", filters.actorId);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);

  const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch audit events");
  }
  return await res.json();
}

// ============================================================================
// Phase 9: Policy Intelligence & Compliance Configuration API Clients
// ============================================================================

export async function fetchPolicies(filters?: {
  category?: string;
  status?: string;
  severity?: string;
  productId?: string;
  search?: string;
}): Promise<{ data: import("@/types").Policy[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.productId) params.set("productId", filters.productId);
  if (filters?.search) params.set("search", filters.search);

  const res = await fetch(`/api/policies?${params.toString()}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to fetch policies");
  }
  return json;
}

export async function fetchPolicyById(id: string): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${id}`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to fetch policy details");
  }
  return json.data;
}

export async function createPolicy(data: {
  name: string;
  code: string;
  description?: string;
  category: import("@/types").PolicyCategory;
  severity?: import("@/types").RuleSeverity;
  productId?: string | null;
  rules?: import("@/types").PolicyRule[];
  validFrom?: string;
}): Promise<import("@/types").Policy> {
  const res = await fetch("/api/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to create policy");
  }
  return json.data;
}

export async function createPolicyVersion(
  policyId: string,
  data: {
    description?: string;
    rules: import("@/types").PolicyRule[];
    validFrom?: string;
    validUntil?: string | null;
  }
): Promise<import("@/types").PolicyVersion> {
  const res = await fetch(`/api/policies/${policyId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to create policy draft version");
  }
  return json.data;
}

export async function activatePolicyVersion(
  policyId: string,
  versionId: string
): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${policyId}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to activate policy version");
  }
  return json.data;
}

export async function archivePolicy(policyId: string): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${policyId}/archive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to archive policy");
  }
  return json.data;
}

export async function updateDraftPolicy(
  policyId: string,
  data: {
    name?: string;
    description?: string;
    category?: import("@/types").PolicyCategory;
    severity?: import("@/types").RuleSeverity;
    productId?: string | null;
    rules?: import("@/types").PolicyRule[];
    validFrom?: string;
    validUntil?: string | null;
  }
): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${policyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to update policy");
  }
  return json.data;
}

export async function rollbackPolicyVersion(
  policyId: string,
  targetVersionNumber: number
): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${policyId}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetVersionNumber }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to rollback policy version");
  }
  return json.data;
}

export async function duplicatePolicy(
  sourcePolicyId: string,
  newCode: string,
  newName: string
): Promise<import("@/types").Policy> {
  const res = await fetch(`/api/policies/${sourcePolicyId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newCode, newName }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to duplicate policy");
  }
  return json.data;
}

export async function validatePolicyRulesApi(
  policyData: unknown
): Promise<{ isValid: boolean; issues: { path: string; code: string; message: string }[] }> {
  const res = await fetch("/api/policies/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policyData),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to validate policy rules");
  }
  return json.data;
}

export async function simulatePolicy(
  request: import("@/types").PolicySimulationRequest
): Promise<import("@/types").PolicySimulationResult> {
  const res = await fetch("/api/policies/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to run policy simulation");
  }
  return json.data;
}


// ============================================================================
// Phase 15: System Health & Diagnostics API Client
// ============================================================================

export interface SystemHealthData {
  status: "ok" | "degraded" | "error";
  application: {
    name: string;
    version: string;
    environment: string;
    timestamp: string;
  };
  services: {
    database: {
      name: string;
      status: "connected" | "disconnected" | "unconfigured";
      latencyMs?: number;
      workspace: string;
      error?: string;
    };
    ollama: {
      name: string;
      status: "connected" | "disconnected" | "unconfigured";
      model: string;
      modelInstalled?: boolean;
      availableModels?: string[];
      latencyMs?: number;
      endpoint: string;
      recoveryHint?: string;
      error?: string;
    };
    verificationEngine: {
      name: string;
      status: "operational" | "degraded";
      promptVersion: string;
      deterministicOffsetCorrection: "active";
      rulesCount: number;
    };
  };
}

export async function fetchSystemHealth(): Promise<SystemHealthData> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok && res.status !== 503) {
    throw new Error(`Health check request failed: ${res.statusText}`);
  }
  return await res.json();
}


// ============================================================================
// Phase 1: Enterprise Multi-Tenancy & Workspace Memberships Client
// ============================================================================

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: string;
  createdAt: string;
  memberCount: number;
  submissionCount?: number;
}

export interface WorkspaceMemberItem {
  id: string;
  userId: string;
  role: string;
  status: string;
  email: string;
  name: string;
  joinedAt: string;
}

export interface WorkspaceInvitationItem {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export async function fetchWorkspaces(): Promise<WorkspaceItem[]> {
  const res = await fetch("/api/workspaces", { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load workspaces");
  }
  const data = await res.json();
  return data.data;
}

export async function createWorkspace(payload: { name: string; slug?: string; domain?: string }): Promise<WorkspaceItem> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to create workspace");
  }
  return data.workspace;
}

export async function fetchWorkspaceDetails(id: string): Promise<WorkspaceItem> {
  const res = await fetch(`/api/workspaces/${id}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load workspace details");
  }
  return data.workspace;
}

export async function updateWorkspace(id: string, payload: { name: string }): Promise<WorkspaceItem> {
  const res = await fetch(`/api/workspaces/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update workspace");
  }
  return data.workspace;
}

export async function fetchWorkspaceMembers(id: string): Promise<WorkspaceMemberItem[]> {
  const res = await fetch(`/api/workspaces/${id}/members`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load workspace members");
  }
  return data.members;
}

export async function updateMemberRole(workspaceId: string, memberId: string, role: string): Promise<void> {
  const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update member role");
  }
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void> {
  const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to remove workspace member");
  }
}

export async function fetchWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitationItem[]> {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to load invitations");
  }
  return data.invitations;
}

export async function createWorkspaceInvitation(
  workspaceId: string,
  payload: { email: string; role: string }
): Promise<{ id: string; email: string; role: string; inviteToken?: string }> {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to create invitation");
  }
  return data.invitation;
}

export async function revokeWorkspaceInvitation(workspaceId: string, inviteId: string): Promise<void> {
  const res = await fetch(`/api/workspaces/${workspaceId}/invitations/${inviteId}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to revoke invitation");
  }
}

export async function acceptWorkspaceInvitation(token: string): Promise<{ success: boolean; workspace: WorkspaceItem }> {
  const res = await fetch("/api/workspaces/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to accept invitation");
  }
  return data;
}

// ============================================================================
// Phase 2: Citation Viewer & Source Document Content API Clients
// ============================================================================

export interface CitationCoordinate {
  evidenceId: string;
  claimId: string;
  claimText: string;
  claimType: string;
  verificationStatus: string;
  riskLevel: string;
  sourceDocumentId: string;
  documentTitle: string;
  documentType: string;
  versionNumber: number;
  pageNumber: number;
  sectionReference: string;
  evidenceExcerpt: string;
  stance: string;
  relevanceScore: number;
  charStart?: number | null;
  charEnd?: number | null;
  boundingBox?: unknown;
  extractionMethod: string;
  extractionConfidence: number;
  sourceValidity: {
    approvalStatus: string;
    validFrom: string;
    validUntil?: string | null;
    isCurrentlyValid: boolean;
    supersededAt?: string | null;
  };
  extractedPages?: Array<{ pageNumber: number; text: string }>;
}

export interface SourceDocumentContent {
  id: string;
  title: string;
  documentType: string;
  approvalStatus: string;
  createdAt: string;
  currentVersion?: {
    id: string;
    versionNumber: number;
    approvalStatus: string;
    validFrom: string;
    validUntil?: string | null;
    supersededAt?: string | null;
    contentHash?: string;
  } | null;
  totalPages: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    sections?: Array<{ heading?: string; text: string }>;
  }>;
}

export async function fetchClaimCitations(claimId: string): Promise<CitationCoordinate[]> {
  const res = await fetch(`/api/claims/${claimId}/citation`, { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to load claim citations");
  }
  const json = await res.json();
  return json.citations;
}

export async function fetchSourceDocumentContent(sourceId: string): Promise<SourceDocumentContent> {
  const res = await fetch(`/api/sources/${sourceId}/content`, { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to load document content");
  }
  const json = await res.json();
  return json.document;
}



// --------------------------------------------------------------------------
// Product Management API Client
// --------------------------------------------------------------------------

export interface CreateProductInput {
  name: string;
  sku: string;
  category: string;
  reference_price: number;
  currency?: string;
  description?: string | null;
  status?: "active" | "draft" | "archived";
}

export interface UpdateProductInput {
  name?: string;
  category?: string;
  reference_price?: number;
  currency?: string;
  description?: string | null;
  status?: "active" | "draft" | "archived";
}

export async function fetchProducts(): Promise<LiveProduct[]> {
  const res = await fetch("/api/products", { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to load products");
  }
  const json = await res.json();
  return json.data;
}

export async function createProduct(input: CreateProductInput): Promise<LiveProduct> {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || (json.details ? json.details.join(", ") : "Failed to create product"));
  }
  return json.data;
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<LiveProduct> {
  const res = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || (json.details ? json.details.join(", ") : "Failed to update product"));
  }
  return json.data;
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to delete product");
  }
}


// --------------------------------------------------------------------------
// Promotion Management API Client
// --------------------------------------------------------------------------

export interface CreatePromotionInput {
  productId: string;
  promotionName: string;
  discountType: "fixed" | "percentage" | "bundle";
  discountValue: number;
  resultingPrice: number;
  currency?: string;
  startDate: string;
  endDate: string;
  applicableChannels?: string[];
  terms?: string | null;
  status?: "active" | "expired" | "scheduled" | "cancelled";
}

export interface UpdatePromotionInput {
  promotionName?: string;
  discountType?: "fixed" | "percentage" | "bundle";
  discountValue?: number;
  resultingPrice?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  applicableChannels?: string[];
  terms?: string | null;
  status?: "active" | "expired" | "scheduled" | "cancelled";
}

export async function fetchPromotions(): Promise<LivePromotion[]> {
  const res = await fetch("/api/promotions", { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to load promotions");
  }
  const json = await res.json();
  return json.data;
}

export async function createPromotion(input: CreatePromotionInput): Promise<LivePromotion> {
  const res = await fetch("/api/promotions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || (json.details ? json.details.join(", ") : "Failed to create promotion"));
  }
  return json.data;
}

export async function updatePromotion(id: string, input: UpdatePromotionInput): Promise<LivePromotion> {
  const res = await fetch(`/api/promotions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || (json.details ? json.details.join(", ") : "Failed to update promotion"));
  }
  return json.data;
}

export async function deletePromotion(id: string): Promise<void> {
  const res = await fetch(`/api/promotions/${id}`, {
    method: "DELETE",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to delete promotion");
  }
}

// --------------------------------------------------------------------------
// Evidence Ingestion API Client
// --------------------------------------------------------------------------

export interface IngestEvidenceInput {
  title: string;
  documentType: string;
  content: string;
  format?: string;
  filename?: string;
  description?: string;
  sourceDocumentId?: string;
}

export interface IngestEvidenceResponse {
  success: boolean;
  title: string;
  format: string;
  totalCharacters: number;
  sectionsCount: number;
  chunksGenerated: number;
  chunksPersisted: number;
  embeddingModel: string;
  documentId?: string;
}

export async function ingestEvidenceDocument(input: IngestEvidenceInput): Promise<IngestEvidenceResponse> {
  const res = await fetch("/api/sources/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error || "Failed to ingest evidence document");
  }
  return json;
}


// --------------------------------------------------------------------------
// Onboarding Status API Client
// --------------------------------------------------------------------------

export interface OnboardingStep {
  step: number;
  id: string;
  title: string;
  description: string;
  completed: boolean;
  count: number;
  meta?: Record<string, unknown>;
}

export interface OnboardingStatusResponse {
  success: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
    role: string;
  };
  progress: {
    completedCount: number;
    totalSteps: number;
    percentage: number;
    isFullyOnboarded: boolean;
  };
  steps: OnboardingStep[];
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const res = await fetch("/api/onboarding/status", { cache: "no-store" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Failed to load onboarding status");
  }
  return res.json();
}
