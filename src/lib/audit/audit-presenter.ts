/**
 * BrandShield AI — Enterprise Audit Log Presentation & Formatting Utilities
 *
 * Provides pure, deterministic formatting functions to transform raw audit
 * logs and metadata JSON into human-readable summaries, structured labels,
 * enum descriptions, and status badges.
 */

// Regular expression to detect valid UUIDv4 strings
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Regular expression to detect ISO 8601 timestamps
export const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// Common acronyms that should be fully capitalized in labels
const ACRONYMS = new Set([
  "id",
  "uuid",
  "sku",
  "url",
  "uri",
  "api",
  "fda",
  "iso",
  "rag",
  "ai",
  "llm",
  "rbac",
  "ip",
  "http",
  "json",
]);

// Sensitive keys that must be redacted from audit presentation
export const SENSITIVE_PRESENTATION_KEYS = new Set([
  "password",
  "token",
  "secret",
  "api_key",
  "apikey",
  "authorization",
  "credentials",
  "private_key",
  "access_token",
  "refresh_token",
  "bearer",
]);

/**
 * Converts snake_case or kebab-case keys into human-readable labels.
 * Handles acronyms like ID, UUID, SKU, API, FDA, and RAG.
 *
 * Examples:
 * - "run_id" -> "Run ID"
 * - "policy_compliance_status" -> "Policy Compliance Status"
 * - "triggered_policies_count" -> "Triggered Policies Count"
 * - "sku" -> "SKU"
 */
export function formatSnakeCaseLabel(key: string): string {
  if (!key || typeof key !== "string") return "";

  // Split on underscores, hyphens, or camelCase boundaries
  const parts = key
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .split(/[_\-\s]+/)
    .filter(Boolean);

  return parts
    .map((part) => {
      const lower = part.toLowerCase();
      if (ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Formats enum values into clean, professional title-case or hyphenated text.
 *
 * Examples:
 * - "non_compliant" -> "Non-compliant"
 * - "needs_review" -> "Needs Review"
 * - "unverified" -> "Unverified"
 * - "insufficient" -> "Insufficient"
 * - "in_review" -> "In Review"
 */
export function formatEnumValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value !== "string") return String(value);

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  // Known standardized enum presentations
  switch (lower) {
    case "non_compliant":
      return "Non-compliant";
    case "compliant":
      return "Compliant";
    case "insufficient":
      return "Insufficient";
    case "sufficient":
      return "Sufficient";
    case "partial":
      return "Partial Evidence";
    case "unverified":
      return "Unverified";
    case "verified":
      return "Verified";
    case "supported":
      return "Supported";
    case "contradicted":
      return "Contradicted";
    case "needs_review":
      return "Needs Review";
    case "in_review":
      return "In Review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "escalated":
      return "Escalated";
    case "modified":
      return "Modified";
    case "superseded":
      return "Superseded";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "critical":
      return "Critical";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "published":
      return "Published";
    case "draft":
      return "Draft";
    case "not_applicable":
    case "n_a":
      return "Not Applicable";
    default:
      // General snake_case converter
      return trimmed
        .split(/[_\-\s]+/)
        .map((p) => (p.length > 0 ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ""))
        .join(" ");
  }
}

export type BadgeTone = "red" | "amber" | "green" | "cyan" | "violet" | "slate";

export interface StatusBadgeInfo {
  label: string;
  tone: BadgeTone;
  className: string;
}

/**
 * Maps risk levels, verification statuses, policy compliance, and review decisions
 * to consistent enterprise status badges and tone classes.
 */
export function getStatusBadgeInfo(key: string, value: unknown): StatusBadgeInfo | null {
  if (value === null || value === undefined) return null;

  const str = String(value).toLowerCase().trim();
  const keyLower = key.toLowerCase();

  // 1. Risk Level
  if (keyLower.includes("risk")) {
    if (str === "high" || str === "critical") {
      return {
        label: formatEnumValue(value),
        tone: "red",
        className: "bg-rose-950/80 text-rose-300 border-rose-800/70 shadow-[0_0_6px_rgba(244,63,94,0.2)]",
      };
    }
    if (str === "medium") {
      return {
        label: formatEnumValue(value),
        tone: "amber",
        className: "bg-amber-950/80 text-amber-300 border-amber-800/70 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
      };
    }
    if (str === "low" || str === "negligible") {
      return {
        label: formatEnumValue(value),
        tone: "green",
        className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70 shadow-[0_0_6px_rgba(16,185,129,0.2)]",
      };
    }
  }

  // 2. Policy Compliance Status
  if (keyLower.includes("compliance")) {
    if (str === "non_compliant" || str === "failed") {
      return {
        label: "Non-compliant",
        tone: "red",
        className: "bg-rose-950/80 text-rose-300 border-rose-800/70 shadow-[0_0_6px_rgba(244,63,94,0.2)]",
      };
    }
    if (str === "compliant" || str === "passed") {
      return {
        label: "Compliant",
        tone: "green",
        className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70 shadow-[0_0_6px_rgba(16,185,129,0.2)]",
      };
    }
  }

  // 3. Evidence Sufficiency
  if (keyLower.includes("sufficiency")) {
    if (str === "insufficient" || str === "missing") {
      return {
        label: "Insufficient",
        tone: "amber",
        className: "bg-amber-950/80 text-amber-300 border-amber-800/70 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
      };
    }
    if (str === "sufficient" || str === "complete") {
      return {
        label: "Sufficient",
        tone: "green",
        className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70 shadow-[0_0_6px_rgba(16,185,129,0.2)]",
      };
    }
    if (str === "partial") {
      return {
        label: "Partial",
        tone: "amber",
        className: "bg-amber-950/80 text-amber-300 border-amber-800/70",
      };
    }
  }

  // 4. Verification Status
  if (keyLower.includes("verification_status") || (keyLower === "status" && ["unverified", "verified", "supported", "contradicted"].includes(str))) {
    if (str === "verified" || str === "supported") {
      return {
        label: formatEnumValue(value),
        tone: "green",
        className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70 shadow-[0_0_6px_rgba(16,185,129,0.2)]",
      };
    }
    if (str === "unverified" || str === "needs_review") {
      return {
        label: formatEnumValue(value),
        tone: "amber",
        className: "bg-amber-950/80 text-amber-300 border-amber-800/70 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
      };
    }
    if (str === "contradicted") {
      return {
        label: "Contradicted",
        tone: "red",
        className: "bg-rose-950/80 text-rose-300 border-rose-800/70 shadow-[0_0_6px_rgba(244,63,94,0.2)]",
      };
    }
  }

  // 5. Review Decision
  if (keyLower.includes("decision") || keyLower.includes("review_status")) {
    if (str === "approved") {
      return {
        label: "Approved",
        tone: "green",
        className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70",
      };
    }
    if (str === "rejected") {
      return {
        label: "Rejected",
        tone: "red",
        className: "bg-rose-950/80 text-rose-300 border-rose-800/70",
      };
    }
    if (str === "escalated" || str === "overridden") {
      return {
        label: formatEnumValue(value),
        tone: "amber",
        className: "bg-amber-950/80 text-amber-300 border-amber-800/70",
      };
    }
    if (str === "modified") {
      return {
        label: "Modified",
        tone: "violet",
        className: "bg-violet-950/80 text-violet-300 border-violet-800/70",
      };
    }
  }

  // 6. Booleans
  if (typeof value === "boolean") {
    return value
      ? {
          label: "Yes",
          tone: "green",
          className: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70",
        }
      : {
          label: "No",
          tone: "slate",
          className: "bg-slate-800/80 text-slate-400 border-slate-700/70",
        };
  }

  return null;
}

/**
 * Checks whether a string represents a valid UUIDv4.
 */
export function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Checks whether a string represents a valid ISO 8601 timestamp.
 */
export function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!ISO_TIMESTAMP_REGEX.test(value.trim())) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/**
 * Sanitizes arbitrary metadata to prevent accidental display of sensitive tokens or keys.
 */
export function redactSensitiveMetadata(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveMetadata(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_PRESENTATION_KEYS.has(lowerKey) ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("api_key")
    ) {
      result[key] = "[REDACTED_SENSITIVE]";
    } else if (val && typeof val === "object") {
      result[key] = redactSensitiveMetadata(val);
    } else {
      result[key] = val;
    }
  }

  return result;
}

/**
 * Generates human-readable, executive summaries for audit activity stream items
 * based on the action type and recorded metadata.
 *
 * Adheres strictly to the prompt specifications:
 * - CLAIM VERIFIED → "Verification completed with high risk. Evidence was insufficient."
 * - CLAIM APPROVED → "Claim approved by compliance reviewer."
 * - CLAIM REJECTED → "Claim rejected following compliance review."
 * - CLAIM MODIFIED → "Claim information was updated."
 * - CLAIM ESCALATED → "Claim escalated for additional review."
 * - CLAIM EVIDENCE LINKED → "Evidence document linked to this claim."
 * - DOCUMENT CHUNKS INGESTED → "Document successfully processed and indexed."
 * - PUBLICATION STATUS UPDATED → "Publication status changed."
 *
 * Supports missing or optional metadata gracefully without inventing facts.
 */
export function formatAuditSummary(
  action: string,
  metadata?: Record<string, unknown> | null
): string {
  const normAction = (action || "").toLowerCase().trim();
  const m = metadata || {};

  switch (normAction) {
    case "claim_verified": {
      const risk = typeof m.risk_level === "string" ? m.risk_level.toLowerCase() : null;
      const sufficiency = typeof m.evidence_sufficiency === "string" ? m.evidence_sufficiency.toLowerCase() : null;
      const status = typeof m.verification_status === "string" ? m.verification_status.toLowerCase() : null;

      if (risk && sufficiency) {
        return `Verification completed with ${risk} risk. Evidence was ${sufficiency}.`;
      }
      if (risk && status) {
        return `Verification completed with ${risk} risk (${formatEnumValue(status)}).`;
      }
      if (risk) {
        return `Verification completed with ${risk} risk.`;
      }
      if (status) {
        return `Verification completed with status ${formatEnumValue(status)}.`;
      }
      return "Claim verification completed.";
    }

    case "claim_approved":
      return "Claim approved by compliance reviewer.";

    case "claim_rejected":
      return "Claim rejected following compliance review.";

    case "claim_modified": {
      if (typeof m.suggested_correction === "string" && m.suggested_correction.trim()) {
        return "Claim information was updated with approved replacement phrasing.";
      }
      return "Claim information was updated.";
    }

    case "claim_escalated": {
      if (typeof m.escalation_category === "string" && m.escalation_category.trim()) {
        return `Claim escalated for ${formatEnumValue(m.escalation_category)} review.`;
      }
      return "Claim escalated for additional review.";
    }

    case "claim_overridden": {
      if (typeof m.override_reason === "string" && m.override_reason.trim()) {
        return "Documented policy override applied by compliance reviewer.";
      }
      return "Documented policy override recorded.";
    }

    case "claim_reviewed": {
      // Handles generic claim_reviewed when decision is stored in after_state
      const decision = typeof m.decision === "string" ? m.decision.toLowerCase() : null;
      if (decision === "approved") {
        return "Claim approved by compliance reviewer.";
      }
      if (decision === "rejected") {
        return "Claim rejected following compliance review.";
      }
      if (decision === "modified") {
        return "Claim information was updated.";
      }
      if (decision === "escalated") {
        return "Claim escalated for additional review.";
      }
      if (m.override_reason) {
        return "Documented policy override applied by compliance reviewer.";
      }
      return "Claim compliance review recorded.";
    }

    case "claim_evidence_linked": {
      const count = typeof m.linked_count === "number" ? m.linked_count : null;
      if (count !== null && count > 1) {
        return `${count} evidence documents linked to this claim.`;
      }
      return "Evidence document linked to this claim.";
    }

    case "document_chunks_ingested": {
      const chunksCount = typeof m.chunks_count === "number" ? m.chunks_count : null;
      if (chunksCount !== null && chunksCount > 0) {
        return `Document successfully processed and indexed into ${chunksCount} vector chunk${chunksCount === 1 ? "" : "s"}.`;
      }
      return "Document successfully processed and indexed.";
    }

    case "publication_status_updated": {
      const pubStatus = typeof m.publication_status === "string" ? m.publication_status.toLowerCase() : null;
      if (pubStatus === "published") {
        return "Publication status changed: Approved for live distribution.";
      }
      if (pubStatus === "blocked" || pubStatus === "locked") {
        return "Publication status changed: Distribution gate locked.";
      }
      return "Publication status changed.";
    }

    case "claims_extracted": {
      const count = typeof m.claims_count === "number" ? m.claims_count : null;
      if (count !== null) {
        return `AI Claim Extraction complete: Identified ${count} claim${count === 1 ? "" : "s"}.`;
      }
      return "AI Claim Extraction complete.";
    }

    case "submission_created":
      return "Marketing submission submitted for compliance audit.";

    case "submission_approved":
      return "Submission approved following verification.";

    case "dossier_uploaded": {
      const title = typeof m.title === "string" ? m.title : null;
      if (title) {
        return `Evidence dossier "${title}" uploaded to library.`;
      }
      return "Evidence dossier uploaded to repository.";
    }

    case "workspace_initialized": {
      const name = typeof m.name === "string" ? m.name : null;
      if (name) {
        return `Workspace "${name}" initialized with tamper-evident governance.`;
      }
      return "Workspace initialized and governance rules configured.";
    }

    case "product_created": {
      const name = typeof m.name === "string" ? m.name : null;
      if (name) {
        return `Product "${name}" registered in workspace catalog.`;
      }
      return "Product registered in workspace catalog.";
    }

    case "promotion_created": {
      const name = typeof m.name === "string" ? m.name : null;
      if (name) {
        return `Promotion "${name}" registered in workspace.`;
      }
      return "Promotion terms registered in workspace.";
    }

    default: {
      // Graceful fallback for any unspecified actions
      const formatted = formatSnakeCaseLabel(normAction);
      return `${formatted} event recorded.`;
    }
  }
}
