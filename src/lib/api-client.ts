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
  evidence?: Array<{
    id: string;
    approved_fact_id: string | null;
    document_version_id: string | null;
    evidence_excerpt: string;
    relevance_score: number;
    evidence_type: string;
    fact_key?: string;
    document_title?: string;
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
    throw new Error(`Failed to fetch claims: ${res.statusText}`);
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

