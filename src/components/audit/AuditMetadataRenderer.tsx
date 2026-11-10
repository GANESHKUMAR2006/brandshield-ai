"use client";

import React, { useState } from "react";
import {
  formatSnakeCaseLabel,
  formatEnumValue,
  isUuid,
  isIsoTimestamp,
  getStatusBadgeInfo,
  redactSensitiveMetadata,
} from "@/lib/audit/audit-presenter";
import { AuditStatusBadge } from "./AuditStatusBadge";
import {
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Sliders,
  ExternalLink,
  Layers,
} from "lucide-react";

interface CopyableUuidProps {
  uuid: string;
  label?: string;
}

export function CopyableUuid({ uuid, label }: CopyableUuidProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = uuid;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-mono text-cyan-300 text-xs bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 break-all select-all">
        {uuid}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        title={`Copy ${label || "UUID"} to clipboard`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

interface AuditMetadataRendererProps {
  metadata: Record<string, unknown> | null | undefined;
  className?: string;
  emptyMessage?: string;
}

export function AuditMetadataRenderer({
  metadata,
  className = "",
  emptyMessage = "No structured metadata recorded for this event.",
}: AuditMetadataRendererProps) {
  if (!metadata || typeof metadata !== "object" || Object.keys(metadata).length === 0) {
    return (
      <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 text-center text-slate-400 text-xs italic">
        {emptyMessage}
      </div>
    );
  }

  // Redact any sensitive tokens before rendering
  const safeData = redactSensitiveMetadata(metadata) as Record<string, unknown>;

  // Check if this metadata represents a verification result
  const isVerificationResult =
    "verification_status" in safeData ||
    "risk_level" in safeData ||
    "policy_compliance_status" in safeData ||
    "evidence_sufficiency" in safeData;

  // Check if this metadata represents a review decision
  const isReviewDecision =
    "decision" in safeData ||
    "review_status" in safeData ||
    "override_reason" in safeData;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Specialized View: Verification Result */}
      {isVerificationResult && <VerificationResultSection data={safeData} />}

      {/* Specialized View: Human Review Decision */}
      {isReviewDecision && <ReviewDecisionSection data={safeData} />}

      {/* Dynamic Generic Section for any remaining or general metadata */}
      {!isVerificationResult && !isReviewDecision && (
        <DynamicKeyValueRenderer data={safeData} />
      )}
    </div>
  );
}

/**
 * Section A, B, C renderer for Verification Result metadata according to Section 2 specification.
 */
function VerificationResultSection({ data }: { data: Record<string, unknown> }) {
  const hasResult =
    "verification_status" in data ||
    "risk_level" in data ||
    "evidence_sufficiency" in data ||
    "policy_compliance_status" in data;

  const hasPolicyInfo =
    "triggered_policies_count" in data ||
    "triggered_policies" in data ||
    "missing_mandatory_evidence" in data;

  const runId = typeof data.run_id === "string" ? data.run_id : null;

  return (
    <div className="space-y-3.5">
      {/* A. Verification Result */}
      {hasResult && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              A. Verification Result
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {"verification_status" in data && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Verification Status:</span>
                <AuditStatusBadge
                  fieldKey="verification_status"
                  value={data.verification_status}
                />
              </div>
            )}

            {"risk_level" in data && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Risk Level:</span>
                <AuditStatusBadge fieldKey="risk_level" value={data.risk_level} />
              </div>
            )}

            {"evidence_sufficiency" in data && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Evidence Sufficiency:</span>
                <AuditStatusBadge
                  fieldKey="evidence_sufficiency"
                  value={data.evidence_sufficiency}
                />
              </div>
            )}

            {"policy_compliance_status" in data && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Policy Compliance:</span>
                <AuditStatusBadge
                  fieldKey="policy_compliance_status"
                  value={data.policy_compliance_status}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* B. Policy Information */}
      {hasPolicyInfo && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/80">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              B. Policy Information
            </h4>
          </div>

          <div className="space-y-2 text-xs">
            {"triggered_policies_count" in data && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Triggered Policies:</span>
                <span className="px-2 py-0.5 rounded font-mono font-bold text-white bg-slate-800 border border-slate-700">
                  {String(data.triggered_policies_count)}
                </span>
              </div>
            )}

            {Array.isArray(data.triggered_policies) && data.triggered_policies.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-slate-400 font-medium block mb-1.5">
                  Triggered Policy Codes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.triggered_policies.map((pol, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/60"
                    >
                      {String(pol)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(data.missing_mandatory_evidence) && data.missing_mandatory_evidence.length > 0 && (
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60">
                <span className="text-amber-400 font-medium block mb-1.5">
                  Missing Mandatory Evidence Types:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {data.missing_mandatory_evidence.map((ev, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800/60"
                    >
                      {String(ev)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* C. Verification Reference */}
      {runId && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              C. Verification Reference
            </h4>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60 text-xs">
            <span className="text-slate-400 font-medium">Run ID:</span>
            <CopyableUuid uuid={runId} label="Run ID" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Specialized renderer for Human Review and Policy Override decisions.
 */
function ReviewDecisionSection({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/80">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          Compliance Review Decision
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {"decision" in data && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
            <span className="text-slate-400 font-medium">Review Decision:</span>
            <AuditStatusBadge fieldKey="decision" value={data.decision} />
          </div>
        )}

        {"review_status" in data && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
            <span className="text-slate-400 font-medium">New Status:</span>
            <AuditStatusBadge fieldKey="review_status" value={data.review_status} />
          </div>
        )}

        {Boolean("escalation_category" in data && data.escalation_category) && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
            <span className="text-slate-400 font-medium">Escalation Category:</span>
            <span className="font-semibold text-amber-300 capitalize">
              {formatEnumValue(data.escalation_category)}
            </span>
          </div>
        )}

        {typeof data.decision_id === "string" && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
            <span className="text-slate-400 font-medium">Decision ID:</span>
            <CopyableUuid uuid={data.decision_id} label="Decision ID" />
          </div>
        )}

        {typeof data.child_claim_id === "string" && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/60">
            <span className="text-slate-400 font-medium">Replacement Claim ID:</span>
            <CopyableUuid uuid={data.child_claim_id} label="Child Claim ID" />
          </div>
        )}
      </div>

      {/* Documented Override Reason Callout */}
      {Boolean(typeof data.override_reason === "string" && data.override_reason.trim()) && (
        <div className="mt-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-bold mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Documented Policy Override Justification</span>
          </div>
          <p className="text-amber-100/90 leading-relaxed italic bg-slate-950/60 p-2.5 rounded-lg border border-amber-900/40">
            &ldquo;{String(data.override_reason)}&rdquo;
          </p>
        </div>
      )}

      {/* Modified Text Phrasing */}
      {Boolean(typeof data.suggested_correction === "string" && data.suggested_correction.trim()) && (
        <div className="mt-2 p-3 rounded-xl bg-violet-950/30 border border-violet-800/60 text-xs">
          <span className="text-violet-300 font-bold block mb-1">
            Approved Replacement Phrasing:
          </span>
          <p className="text-slate-200 leading-relaxed font-mono bg-slate-950/60 p-2.5 rounded-lg border border-violet-900/40">
            {String(data.suggested_correction)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic Key-Value Renderer supporting arbitrary nested objects, arrays,
 * primitives, UUIDs, and ISO timestamps.
 */
export function DynamicKeyValueRenderer({
  data,
  depth = 0,
}: {
  data: Record<string, unknown>;
  depth?: number;
}) {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <span className="text-slate-500 italic text-xs">Empty object</span>;
  }

  return (
    <div
      className={`grid grid-cols-1 ${
        depth === 0 ? "sm:grid-cols-2" : "grid-cols-1"
      } gap-2.5 text-xs`}
    >
      {entries.map(([key, value]) => {
        const label = formatSnakeCaseLabel(key);
        const badgeInfo = getStatusBadgeInfo(key, value);

        return (
          <div
            key={key}
            className={`p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between gap-1 overflow-hidden ${
              typeof value === "object" && value !== null && !Array.isArray(value)
                ? "sm:col-span-2"
                : ""
            }`}
          >
            <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              {label}
            </span>

            <div className="mt-0.5">
              <FieldValueRenderer fieldKey={key} value={value} depth={depth} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders individual values according to their runtime type.
 */
function FieldValueRenderer({
  fieldKey,
  value,
  depth,
}: {
  fieldKey: string;
  value: unknown;
  depth: number;
}) {
  // 1. Null / Undefined
  if (value === null || value === undefined) {
    return <span className="text-slate-500 italic font-mono text-xs">None</span>;
  }

  // 2. Status Badge match
  const badge = getStatusBadgeInfo(fieldKey, value);
  if (badge) {
    return <AuditStatusBadge fieldKey={fieldKey} value={value} />;
  }

  // 3. UUID
  if (isUuid(value)) {
    return <CopyableUuid uuid={String(value)} label={formatSnakeCaseLabel(fieldKey)} />;
  }

  // 4. ISO Timestamp
  if (isIsoTimestamp(value)) {
    const d = new Date(String(value));
    return (
      <span className="text-slate-200 font-mono text-xs">
        {d.toLocaleString("en-US", {
          timeZone: "UTC",
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}{" "}
        UTC
      </span>
    );
  }

  // 5. Booleans
  if (typeof value === "boolean") {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
          value
            ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
            : "bg-slate-800 text-slate-400 border-slate-700"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  // 6. Numbers
  if (typeof value === "number") {
    return <span className="font-mono text-cyan-300 font-semibold">{value}</span>;
  }

  // 7. Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500 italic text-xs">Empty list</span>;
    }

    // Array of primitives -> chips
    const allPrimitives = value.every(
      (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    );

    if (allPrimitives) {
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded text-[11px] bg-slate-900 text-slate-200 border border-slate-800 font-mono"
            >
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    // Array of objects
    return (
      <div className="space-y-2 mt-1">
        {value.map((item, idx) => (
          <div key={idx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
            {typeof item === "object" && item !== null ? (
              <DynamicKeyValueRenderer
                data={item as Record<string, unknown>}
                depth={depth + 1}
              />
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    );
  }

  // 8. Nested Objects
  if (typeof value === "object") {
    return (
      <div className="mt-1 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/70">
        <DynamicKeyValueRenderer
          data={value as Record<string, unknown>}
          depth={depth + 1}
        />
      </div>
    );
  }

  // 9. Strings
  return <span className="text-slate-200 font-medium break-words">{String(value)}</span>;
}
