"use client";

import React, { useState, useEffect } from "react";
import { LiveClaimRecord, verifyClaim, fetchClaimDetail, submitReviewDecision, discoverClaimEvidence } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import { CloseIcon, SparklesIcon, CheckCircleIcon, AlertCircleIcon } from "@/components/ui/Icons";
import { formatPercent, formatDateTime } from "@/lib/utils/formatters";
import { EscalationCategory } from "@/types";

interface ClaimDetailModalProps {
  claim: LiveClaimRecord | null;
  onClose: () => void;
  onVerified?: () => void;
}

const riskColorMap: Record<string, "danger" | "warning" | "default" | "success"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};

export function ClaimDetailModal({ claim, onClose, onVerified }: ClaimDetailModalProps) {
  if (!claim) return null;

  return (
    <ClaimDetailModalInner
      key={claim.id}
      initialClaim={claim}
      onClose={onClose}
      onVerified={onVerified}
    />
  );
}

function ClaimDetailModalInner({
  initialClaim,
  onClose,
  onVerified,
}: {
  initialClaim: LiveClaimRecord;
  onClose: () => void;
  onVerified?: () => void;
}) {
  const [claim, setClaim] = useState<LiveClaimRecord>(initialClaim);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review Form States
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"approved" | "rejected" | "escalated" | "modified">("approved");
  const [reviewComments, setReviewComments] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [escalationCategory, setEscalationCategory] = useState<EscalationCategory>("regulatory");
  const [modifiedText, setModifiedText] = useState(claim.suggested_correction || claim.claim_text);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [onClose]);

  const handleRunVerification = async () => {
    setIsVerifying(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await verifyClaim(claim.id);
      setSuccessMsg(
        `Verification executed deterministically: status is ${res.status.toUpperCase()} with ${res.riskLevel.toUpperCase()} compliance risk.`
      );
      // Reload fresh detail with evidence & history
      const fresh = await fetchClaimDetail(claim.id);
      setClaim(fresh);
      if (onVerified) onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification execution failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const [isRetrievingEvidence, setIsRetrievingEvidence] = useState(false);

  const handleRetrieveEvidence = async () => {
    setIsRetrievingEvidence(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await discoverClaimEvidence(claim.id);
      setSuccessMsg(res.message || "Evidence retrieved successfully.");
      const fresh = await fetchClaimDetail(claim.id);
      setClaim(fresh);
      if (onVerified) onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Evidence discovery failed");
    } finally {
      setIsRetrievingEvidence(false);
    }
  };

  const handleSubmitReview = async () => {
    setIsSubmittingReview(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (
        reviewDecision === "approved" &&
        (claim.verification_status === "contradicted" || claim.risk_level === "high" || claim.risk_level === "critical") &&
        (!overrideReason.trim() || overrideReason.trim().length < 10)
      ) {
        throw new Error("A documented override reason of at least 10 characters is mandatory for high-risk or contradicted assertions.");
      }

      await submitReviewDecision({
        claimId: claim.id,
        decision: reviewDecision,
        comments: reviewComments || undefined,
        overrideReason: overrideReason || undefined,
        escalationCategory: reviewDecision === "escalated" ? escalationCategory : undefined,
        modifiedClaimText: reviewDecision === "modified" ? modifiedText : undefined,
      });

      setSuccessMsg(`Review decision "${reviewDecision}" recorded successfully.`);
      setShowReviewForm(false);
      const fresh = await fetchClaimDetail(claim.id);
      setClaim(fresh);
      if (onVerified) onVerified();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record review decision");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Highlight span in submission content if available
  const content = claim.version_content || "";
  const start = claim.text_start ?? -1;
  const end = claim.text_end ?? -1;

  let beforeText = "";
  let highlightedText = claim.claim_text;
  let afterText = "";

  if (start >= 0 && end > start && content.length >= end) {
    beforeText = content.slice(0, start);
    highlightedText = content.slice(start, end);
    afterText = content.slice(end);
  }

  const entities = claim.extracted_entities && typeof claim.extracted_entities === "object"
    ? Object.entries(claim.extracted_entities)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                {claim.claim_type.replace(/_/g, " ")}
              </span>
              <StatusPill status={claim.verification_status} />
              <span className="text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <span className="text-slate-400 text-[10px] uppercase font-medium">Review:</span>
                <StatusPill status={claim.review_status || "pending"} />
              </span>
              {claim.risk_level && (
                <Badge variant={riskColorMap[claim.risk_level] || "default"} size="sm">
                  {claim.risk_level.toUpperCase()} RISK
                </Badge>
              )}
              {claim.text_start !== null && claim.text_end !== null && (
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  UTF-16 Span: [{claim.text_start}..{claim.text_end}]
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Claim Ledger & Verification Record
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: <code className="font-mono text-[11px] text-slate-600">{claim.id}</code>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Action Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Verbatim Claim Statement */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Extracted Factual Assertion (Verbatim Substring)
            </label>
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-indigo-950 font-semibold text-sm leading-relaxed">
              &ldquo;{claim.claim_text}&rdquo;
            </div>
          </div>

          {/* Verification Determination Box */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                <span>Deterministic Verification Determination</span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunVerification}
                  isLoading={isVerifying}
                >
                  {isVerifying ? "Verifying..." : "Verify Claim Deterministically"}
                </Button>
              </div>
            </div>

            {claim.explanation ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 leading-relaxed text-xs">
                {claim.explanation}
              </div>
            ) : (
              <div className="p-3 bg-slate-50/60 rounded-lg border border-dashed border-slate-200 text-slate-500 italic text-xs">
                Awaiting deterministic verification against approved facts and clinical trials.
              </div>
            )}

            {/* Suggested Correction if present */}
            {claim.suggested_correction && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <div className="text-[11px] font-semibold text-emerald-900 uppercase">
                  Suggested Defensible Correction:
                </div>
                <div className="font-semibold text-emerald-950 text-xs mt-0.5">
                  &ldquo;{claim.suggested_correction}&rdquo;
                </div>
              </div>
            )}
          </div>

          {/* Human Review & Governance Section */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-xs">Human Compliance Review</span>
                <StatusPill status={claim.review_status || "pending"} />
              </div>

              <Button
                variant={showReviewForm ? "outline" : "primary"}
                size="sm"
                onClick={() => setShowReviewForm(!showReviewForm)}
              >
                {showReviewForm ? "Cancel Decision" : "Submit Review Decision"}
              </Button>
            </div>

            {/* Review Status Metadata */}
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400">Assigned Reviewer:</span>{" "}
                <strong className="text-slate-700">{claim.assigned_reviewer || "Unassigned"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Last Reviewed:</span>{" "}
                <span>{claim.last_reviewed_at ? formatDateTime(claim.last_reviewed_at) : "Pending"}</span>
              </div>
              {claim.original_claim_id && (
                <div className="col-span-2 text-indigo-700 font-mono text-[10px]">
                  <span>Lineage Predecessor ID: {claim.original_claim_id}</span>
                </div>
              )}
              {claim.review_notes && (
                <div className="col-span-2 text-slate-600">
                  <span className="text-slate-400">Notes:</span> {claim.review_notes}
                </div>
              )}
            </div>

            {/* Interactive Review Decision Form */}
            {showReviewForm && (
              <div className="p-3 bg-slate-50/80 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700 text-xs">Action:</span>
                  {(["approved", "rejected", "escalated", "modified"] as const).map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => setReviewDecision(dec)}
                      className={`px-2.5 py-1 rounded text-xs font-medium capitalize cursor-pointer transition-colors ${
                        reviewDecision === dec
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {dec}
                    </button>
                  ))}
                </div>

                {reviewDecision === "approved" &&
                  (claim.verification_status === "contradicted" || claim.risk_level === "high" || claim.risk_level === "critical") && (
                    <div>
                      <label className="text-[11px] font-semibold text-rose-900 block mb-1">
                        Mandatory Policy Override Reason (Min 10 Characters):
                      </label>
                      <textarea
                        rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="State regulatory justification or grandfather clause exception..."
                        className="w-full p-2 rounded-lg border border-amber-300 bg-amber-50/40 text-xs focus:outline-indigo-500"
                      />
                    </div>
                  )}

                {reviewDecision === "modified" && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Revised Defensible Claim Phrasing:
                    </label>
                    <textarea
                      rows={2}
                      value={modifiedText}
                      onChange={(e) => setModifiedText(e.target.value)}
                      placeholder="Revised phrasing..."
                      className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:outline-indigo-500 font-medium"
                    />
                  </div>
                )}

                {reviewDecision === "escalated" && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Escalation Category:
                    </label>
                    <select
                      value={escalationCategory}
                      onChange={(e) => setEscalationCategory(e.target.value as EscalationCategory)}
                      className="w-full p-1.5 rounded-lg border border-slate-300 text-xs capitalize"
                    >
                      <option value="regulatory">Regulatory & FDA Compliance</option>
                      <option value="legal">Legal & IP Counsel</option>
                      <option value="clinical">Clinical Research & Medical Affairs</option>
                      <option value="brand_compliance">Brand Governance</option>
                      <option value="evidence_conflict">Conflicting Evidence Adjudication</option>
                      <option value="other">Other Specialized Review</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Reviewer Commentary:
                  </label>
                  <input
                    type="text"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Optional compliance comment..."
                    className="w-full p-1.5 rounded-lg border border-slate-200 text-xs focus:outline-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSubmitReview}
                    isLoading={isSubmittingReview}
                  >
                    Confirm Review Sign-Off
                  </Button>
                </div>
              </div>
            )}

            {/* Decision History */}
            {claim.review_history && claim.review_history.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Governance Decision Audit Trail ({claim.review_history.length})
                </div>
                <div className="space-y-2">
                  {claim.review_history.map((dec) => (
                    <div key={dec.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <StatusPill status={dec.decision} />
                          <span className="font-semibold text-slate-700">By {dec.reviewer_id}</span>
                          <span className="text-slate-400 text-[10px]">({dec.reviewer_role})</span>
                        </div>
                        <span className="text-slate-400">{formatDateTime(dec.created_at)}</span>
                      </div>
                      {dec.comments && <p className="text-slate-600 mt-1">{dec.comments}</p>}
                      {dec.override_reason && (
                        <p className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1 font-sans">
                          <strong>Override Policy:</strong> {dec.override_reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Context Span Highlighter if content available */}
          {content && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Original Text Context (Verified Offset Alignment)
              </label>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed font-sans text-xs">
                <span>{beforeText}</span>
                <mark className="bg-amber-200/90 text-amber-950 px-1 py-0.5 rounded font-semibold border border-amber-300">
                  {highlightedText}
                </mark>
                <span>{afterText}</span>
              </div>
            </div>
          )}

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-medium uppercase">AI Extraction Confidence</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                {formatPercent(claim.extraction_confidence)}
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full"
                  style={{ width: `${Math.round(claim.extraction_confidence * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Associated Product</div>
              <div className="text-xs font-semibold text-slate-900 mt-1 truncate">
                {claim.product_name || "Unassociated (General)"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {claim.product_sku ? `SKU: ${claim.product_sku}` : "No specific SKU matched"}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] text-slate-500 font-medium uppercase">Campaign Submission</div>
              <div className="text-xs font-semibold text-slate-900 mt-1 truncate">
                {claim.submission_title || "Direct Ingestion"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Version {claim.version_number ?? 1} · {claim.submission_channel || "General"}
              </div>
            </div>
          </div>

          {/* Extracted Entities */}
          {entities.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                Extracted Structured Entities
              </label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-2">
                {entities.map(([key, val]) => (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="font-semibold text-slate-500">{key}:</span>
                    <span className="font-mono text-indigo-700 font-medium">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phase 7: Evidence Intelligence Dossiers & Approved Facts */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Evidence Intelligence Dossier ({claim.evidence?.length || 0})
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrieveEvidence}
                isLoading={isRetrievingEvidence}
              >
                {isRetrievingEvidence ? "Retrieving..." : "Discover Evidence (RAG)"}
              </Button>
            </div>

            {claim.evidence && claim.evidence.length > 0 ? (
              <div className="space-y-3">
                {claim.evidence.map((ev) => {
                  const isContradiction = ev.stance === "contradicting" || ev.evidence_type.includes("contradiction");
                  const isSupporting = ev.stance === "supporting" || ev.relevance_score >= 0.8;
                  const isSuperseded = Boolean(ev.superseded_at);

                  return (
                    <div
                      key={ev.id}
                      className={`p-3.5 rounded-xl border text-xs transition-all ${
                        isContradiction
                          ? "bg-rose-50/50 border-rose-200"
                          : isSupporting
                          ? "bg-emerald-50/40 border-emerald-200"
                          : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      {/* Top Bar: Source Doc, Version & Relevance Score */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {ev.document_title || ev.fact_key || "Approved Clinical Dossier"}
                          </span>
                          {ev.version_number && (
                            <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-semibold">
                              v{ev.version_number}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {ev.evidence_type.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isSuperseded ? (
                            <Badge variant="danger" size="sm">SUPERSEDED</Badge>
                          ) : (
                            <Badge variant="success" size="sm">VALID SOURCE</Badge>
                          )}
                          <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Relevance: {formatPercent(ev.relevance_score)}
                          </span>
                        </div>
                      </div>

                      {/* Excerpt Body */}
                      <blockquote className="p-2.5 bg-white/90 rounded-lg border border-slate-200/80 text-slate-800 leading-relaxed font-sans mb-2 text-xs">
                        &ldquo;{ev.evidence_excerpt}&rdquo;
                      </blockquote>

                      {/* Footer: Provenance & Retrieval Rationale */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          {ev.page_number && (
                            <span>Page: <strong className="text-slate-700">{ev.page_number}</strong></span>
                          )}
                          {ev.section_reference && (
                            <span>Section: <strong className="text-slate-700">{ev.section_reference}</strong></span>
                          )}
                        </div>
                        <div className="italic text-slate-400 text-[10px]">
                          {ev.retrieval_rationale || "Retrieved via pgvector hybrid semantic and lexical similarity"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-500 text-xs">
                No evidence passages linked yet. Click &ldquo;Discover Evidence (RAG)&rdquo; to match approved clinical documents.
              </div>
            )}
          </div>

          {/* Provenance & LLM Run Information */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs">
              <SparklesIcon className="w-4 h-4 text-indigo-600" />
              <span>Engine Provenance Telemetry</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400">Extraction Provider:</span>{" "}
                <strong className="text-slate-800 uppercase">{claim.extraction_provider || "mock/local"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Model:</span>{" "}
                <code className="text-slate-800">{claim.extraction_model || "deterministic-v1"}</code>
              </div>
              <div>
                <span className="text-slate-400">Extracted At:</span>{" "}
                <span>{formatDateTime(claim.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-400">Verified At:</span>{" "}
                <span>{claim.verified_at ? formatDateTime(claim.verified_at) : "Pending verification"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-[11px] text-slate-400">
            BrandShield AI Claim Governance · Deterministic Rules Engine v1.0.0
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
