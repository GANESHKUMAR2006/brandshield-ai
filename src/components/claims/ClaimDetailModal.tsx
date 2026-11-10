"use client";

import React, { useState, useEffect } from "react";
import { LiveClaimRecord, verifyClaim, fetchClaimDetail, submitReviewDecision, discoverClaimEvidence } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import { formatPercent, formatDateTime } from "@/lib/utils/formatters";
import { EscalationCategory } from "@/types";
import { ClaimLifecycleStepper } from "@/components/claims/ClaimLifecycleStepper";
import { CitationViewerModal } from "@/components/claims/CitationViewerModal";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileText,
} from "lucide-react";

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
  // Auto-dismiss temporary success notification after 5 seconds
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => {
      setSuccessMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [successMsg]);
  const [activeCitationModal, setActiveCitationModal] = useState<{
    claimId: string;
    claimText: string;
    evidenceId?: string;
  } | null>(null);

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
      if (res.data && res.data.retrievedCount === 0) {
        setSuccessMsg("Evidence search completed: No matching clinical or promotional documentation found for this claim.");
      } else {
        setSuccessMsg(res.message || "Evidence retrieved successfully.");
      }
      const fresh = await fetchClaimDetail(claim.id);
      setClaim(fresh);
      if (onVerified) onVerified();
    } catch (err: unknown) {
      console.error("[ClaimDetailModal] Evidence discovery failed:", err);
      const rawMessage = err instanceof Error ? err.message : "Evidence discovery failed";
      if (
        rawMessage.includes("embedding provider") ||
        rawMessage.includes("PROVIDER_CONFIGURATION_ERROR") ||
        rawMessage.includes("OPENAI_API_KEY")
      ) {
        setError(
          "Evidence discovery is currently unavailable: The semantic search service is not configured. Please contact your workspace administrator."
        );
      } else {
        setError(rawMessage);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-start justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-violet-300 bg-violet-950/70 border border-violet-800/60 px-2 py-0.5 rounded">
                {claim.claim_type.replace(/_/g, " ")}
              </span>
              <StatusPill status={claim.verification_status} />
              <span className="text-slate-600">·</span>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <span className="text-slate-500 text-[10px] uppercase font-medium">Review:</span>
                <StatusPill status={claim.review_status || "pending"} />
              </span>
              {claim.risk_level && (
                <Badge variant={riskColorMap[claim.risk_level] || "default"} size="sm">
                  {claim.risk_level.toUpperCase()} RISK
                </Badge>
              )}
              {claim.text_start !== null && claim.text_end !== null && (
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded">
                  UTF-16 Span: [{claim.text_start}..{claim.text_end}]
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Claim Ledger & Verification Record
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ID: <code className="font-mono text-[11px] text-violet-400">{claim.id}</code>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-400/70 hover:text-emerald-200 transition-colors p-0.5 rounded cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* 4-Stage Compliance Progression Stepper */}
          <div className="p-4 bg-slate-900/70 rounded-xl border border-slate-800 shadow-inner">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Compliance Lifecycle Progression
            </div>
            <ClaimLifecycleStepper
              compact={false}
              textStart={claim.text_start}
              textEnd={claim.text_end}
              extractionConfidence={claim.extraction_confidence}
              verificationStatus={claim.verification_status}
              riskLevel={claim.risk_level}
              reviewStatus={claim.review_status}
            />
          </div>

          {/* Verbatim Claim Statement */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Extracted Factual Assertion (Verbatim Substring)
            </label>
            <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-800/50 text-violet-100 font-semibold text-sm leading-relaxed shadow-inner">
              &ldquo;{claim.claim_text}&rdquo;
            </div>
          </div>

          {/* Verification Determination Box */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
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
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-200 leading-relaxed text-xs">
                {claim.explanation}
              </div>
            ) : (
              <div className="p-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 italic text-xs">
                Awaiting deterministic verification against approved facts and clinical trials.
              </div>
            )}

            {/* Suggested Correction if present */}
            {claim.suggested_correction && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl">
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Suggested Defensible Correction:
                </div>
                <div className="font-semibold text-emerald-200 text-xs mt-1">
                  &ldquo;{claim.suggested_correction}&rdquo;
                </div>
              </div>
            )}
          </div>

          {/* Human Review & Governance Section */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">Human Compliance Review</span>
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
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400">Assigned Reviewer:</span>{" "}
                <strong className="text-slate-200">{claim.assigned_reviewer || "Unassigned"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Last Reviewed:</span>{" "}
                <span className="text-slate-200">{claim.last_reviewed_at ? formatDateTime(claim.last_reviewed_at) : "Pending"}</span>
              </div>
              {claim.original_claim_id && (
                <div className="col-span-2 text-violet-400 font-mono text-[10px]">
                  <span>Lineage Predecessor ID: {claim.original_claim_id}</span>
                </div>
              )}
              {claim.review_notes && (
                <div className="col-span-2 text-slate-300">
                  <span className="text-slate-400">Notes:</span> {claim.review_notes}
                </div>
              )}
            </div>

            {/* Interactive Review Decision Form */}
            {showReviewForm && (
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-violet-800/50 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-300 text-xs">Action:</span>
                  {(["approved", "rejected", "escalated", "modified"] as const).map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => setReviewDecision(dec)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                        reviewDecision === dec
                          ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                          : "bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      {dec}
                    </button>
                  ))}
                </div>

                {reviewDecision === "approved" &&
                  (claim.verification_status === "contradicted" || claim.risk_level === "high" || claim.risk_level === "critical") && (
                    <div>
                      <label className="text-[11px] font-semibold text-rose-300 block mb-1">
                        Mandatory Policy Override Reason (Min 10 Characters):
                      </label>
                      <textarea
                        rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="State regulatory justification or grandfather clause exception..."
                        className="w-full p-2 rounded-xl border border-amber-800/80 bg-amber-950/30 text-xs text-amber-200 placeholder-amber-400/50 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                {reviewDecision === "modified" && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Revised Defensible Claim Phrasing:
                    </label>
                    <textarea
                      rows={2}
                      value={modifiedText}
                      onChange={(e) => setModifiedText(e.target.value)}
                      placeholder="Revised phrasing..."
                      className="w-full p-2 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-violet-500 font-medium"
                    />
                  </div>
                )}

                {reviewDecision === "escalated" && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Escalation Category:
                    </label>
                    <select
                      value={escalationCategory}
                      onChange={(e) => setEscalationCategory(e.target.value as EscalationCategory)}
                      className="w-full p-2 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white capitalize focus:outline-none focus:border-violet-500"
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
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Reviewer Commentary:
                  </label>
                  <input
                    type="text"
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    placeholder="Optional compliance comment..."
                    className="w-full p-2 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-violet-500"
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
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Governance Decision Audit Trail ({claim.review_history.length})
                </div>
                <div className="space-y-2">
                  {claim.review_history.map((dec) => (
                    <div key={dec.id} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <StatusPill status={dec.decision} />
                          <span className="font-semibold text-slate-200">By {dec.reviewer_id}</span>
                          <span className="text-slate-500 text-[10px]">({dec.reviewer_role})</span>
                        </div>
                        <span className="text-slate-500">{formatDateTime(dec.created_at)}</span>
                      </div>
                      {dec.comments && <p className="text-slate-300 mt-1">{dec.comments}</p>}
                      {dec.override_reason && (
                        <p className="text-amber-300 bg-amber-950/40 p-1.5 rounded-lg border border-amber-800/50 mt-1 font-sans">
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Original Text Context (Verified Offset Alignment)
              </label>
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 leading-relaxed font-sans text-xs">
                <span>{beforeText}</span>
                <mark className="bg-violet-900/60 text-violet-200 px-1 py-0.5 rounded font-semibold border border-violet-700/60">
                  {highlightedText}
                </mark>
                <span>{afterText}</span>
              </div>
            </div>
          )}

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">AI Extraction Confidence</div>
              <div className="text-base font-bold text-white mt-1">
                {formatPercent(claim.extraction_confidence)}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full rounded-full shadow-[0_0_6px_rgba(6,182,212,0.4)]"
                  style={{ width: `${Math.round(claim.extraction_confidence * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Associated Product</div>
              <div className="text-xs font-semibold text-white mt-1 truncate">
                {claim.product_name || "Unassociated (General)"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {claim.product_sku ? `SKU: ${claim.product_sku}` : "No specific SKU matched"}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Campaign Submission</div>
              <div className="text-xs font-semibold text-white mt-1 truncate">
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Extracted Structured Entities
              </label>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex flex-wrap gap-2">
                {entities.map(([key, val]) => (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs"
                  >
                    <span className="font-semibold text-slate-400">{key}:</span>
                    <span className="font-mono text-cyan-300 font-medium">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Intelligence Dossiers & Approved Facts */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
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
                          ? "bg-rose-950/25 border-rose-800/50"
                          : isSupporting
                          ? "bg-emerald-950/20 border-emerald-800/50"
                          : "bg-slate-900/60 border-slate-800"
                      }`}
                    >
                      {/* Top Bar: Source Doc, Version & Relevance Score */}
                      <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-xs">
                            {ev.document_title || ev.fact_key || "Approved Clinical Dossier"}
                          </span>
                          {ev.version_number && (
                            <span className="text-[10px] font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
                              v{ev.version_number}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-semibold text-violet-300 bg-violet-950/80 px-1.5 py-0.5 rounded border border-violet-800/60">
                            {ev.evidence_type.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isSuperseded ? (
                            <Badge variant="danger" size="sm">SUPERSEDED</Badge>
                          ) : (
                            <Badge variant="success" size="sm">VALID SOURCE</Badge>
                          )}
                          <span className="font-mono text-[11px] font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            Relevance: {formatPercent(ev.relevance_score)}
                          </span>
                        </div>
                      </div>

                      {/* Excerpt Body */}
                      <blockquote className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-slate-200 leading-relaxed font-sans mb-2 text-xs">
                        &ldquo;{ev.evidence_excerpt}&rdquo;
                      </blockquote>

                      {/* Footer: Provenance, Action & Retrieval Rationale */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          {ev.page_number && (
                            <span className="text-violet-300 font-mono font-semibold">Page {ev.page_number}</span>
                          )}
                          {ev.section_reference && (
                            <span>Section: <strong className="text-slate-200">{ev.section_reference}</strong></span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveCitationModal({
                              claimId: claim.id,
                              claimText: claim.claim_text,
                              evidenceId: ev.id,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 text-violet-300 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>View in Citation Viewer</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center text-slate-500 text-xs">
                No evidence passages linked yet. Click &ldquo;Discover Evidence (RAG)&rdquo; to match approved clinical documents.
              </div>
            )}
          </div>

          {/* Provenance & LLM Run Information */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Engine Provenance Telemetry</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <div>
                <span className="text-slate-500">Extraction Provider:</span>{" "}
                <strong className="text-slate-200 uppercase">{claim.extraction_provider || "mock/local"}</strong>
              </div>
              <div>
                <span className="text-slate-500">Model:</span>{" "}
                <code className="text-slate-200">{claim.extraction_model || "deterministic-v1"}</code>
              </div>
              <div>
                <span className="text-slate-500">Extracted At:</span>{" "}
                <span className="text-slate-200">{formatDateTime(claim.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500">Verified At:</span>{" "}
                <span className="text-slate-200">{claim.verified_at ? formatDateTime(claim.verified_at) : "Pending verification"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="text-[11px] text-slate-500">
            BrandShield AI Claim Governance · Deterministic Rules Engine v1.0.0
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {/* Citation Viewer Modal */}
        {activeCitationModal && (
          <CitationViewerModal
            isOpen={true}
            claimId={activeCitationModal.claimId}
            claimText={activeCitationModal.claimText}
            initialEvidenceId={activeCitationModal.evidenceId}
            onClose={() => setActiveCitationModal(null)}
          />
        )}
      </div>
    </div>
  );
}
