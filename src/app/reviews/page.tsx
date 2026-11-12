"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import {
  LiveClaimRecord,
  fetchReviewQueue,
  submitReviewDecision,
  ReviewQueueResponse,
} from "@/lib/api-client";
import { EscalationCategory } from "@/types";
import { ClaimLifecycleStepper } from "@/components/claims/ClaimLifecycleStepper";
import { CitationViewerModal } from "@/components/claims/CitationViewerModal";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AlertTriangle,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Search,
  FileText,
} from "lucide-react";

const riskBadgeMap: Record<string, "danger" | "warning" | "default" | "success"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};

export default function ReviewsPage() {
  const [queue, setQueue] = useState<LiveClaimRecord[]>([]);
  const [reviewer, setReviewer] = useState<{ id: string; name: string; role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const requestSeq = useRef(0);

  // Action Dialog State
  const [activeActionModal, setActiveActionModal] = useState<{
    claim: LiveClaimRecord;
    action: "approve" | "override" | "modify" | "escalate" | "reject";
  } | null>(null);

  // Citation Viewer Modal State
  const [activeCitationModal, setActiveCitationModal] = useState<{
    claimId: string;
    claimText: string;
    evidenceId?: string;
  } | null>(null);

  const [overrideReason, setOverrideReason] = useState("");
  const [escalationCategory, setEscalationCategory] = useState<EscalationCategory>("regulatory");
  const [modifiedText, setModifiedText] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize queue from backend whenever filters or debounced search change
  useEffect(() => {
    const currentSeq = ++requestSeq.current;
    setIsLoading(true);

    fetchReviewQueue({
      riskLevel: riskFilter !== "all" ? riskFilter : undefined,
      reviewStatus: statusFilter !== "all" ? statusFilter : undefined,
      search: debouncedSearchQuery.trim() || undefined,
    })
      .then((res) => {
        if (requestSeq.current === currentSeq) {
          setQueue(res.data);
          setReviewer(res.reviewer);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (requestSeq.current === currentSeq) {
          setError(err instanceof Error ? err.message : "Failed to load review queue");
          setIsLoading(false);
        }
      });
  }, [riskFilter, statusFilter, debouncedSearchQuery]);

  const refreshQueue = async () => {
    setIsLoading(true);
    const currentSeq = ++requestSeq.current;
    try {
      const res: ReviewQueueResponse = await fetchReviewQueue({
        riskLevel: riskFilter !== "all" ? riskFilter : undefined,
        reviewStatus: statusFilter !== "all" ? statusFilter : undefined,
        search: debouncedSearchQuery.trim() || undefined,
      });
      if (requestSeq.current === currentSeq) {
        setQueue(res.data);
        setReviewer(res.reviewer);
        setError(null);
      }
    } catch (err: unknown) {
      if (requestSeq.current === currentSeq) {
        setError(err instanceof Error ? err.message : "Failed to load review queue");
      }
    } finally {
      if (requestSeq.current === currentSeq) {
        setIsLoading(false);
      }
    }
  };

  const handleOpenAction = (
    claim: LiveClaimRecord,
    action: "approve" | "override" | "modify" | "escalate" | "reject"
  ) => {
    setActiveActionModal({ claim, action });
    setReviewComments("");
    setOverrideReason("");
    setEscalationCategory("regulatory");
    setModifiedText(claim.suggested_correction || claim.claim_text);
    setActionSuccess(null);
  };

  const handleCloseModal = () => {
    setActiveActionModal(null);
    setIsSubmitting(false);
  };

  const handleSubmitDecision = async () => {
    if (!activeActionModal) return;
    const { claim, action } = activeActionModal;

    setIsSubmitting(true);
    setError(null);
    try {
      if (action === "approve") {
        await submitReviewDecision({
          claimId: claim.id,
          decision: "approved",
          comments: reviewComments || undefined,
        });
        setActionSuccess(`Claim approved successfully.`);
      } else if (action === "override") {
        if (!overrideReason.trim() || overrideReason.trim().length < 10) {
          throw new Error("A documented override reason of at least 10 characters is required.");
        }
        await submitReviewDecision({
          claimId: claim.id,
          decision: "approved",
          overrideReason: overrideReason.trim(),
          comments: reviewComments || undefined,
        });
        setActionSuccess(`Claim override approved with documented policy justification.`);
      } else if (action === "modify") {
        if (!modifiedText.trim() || modifiedText.trim() === claim.claim_text.trim()) {
          throw new Error("Please supply a valid modified phrasing that differs from the original.");
        }
        await submitReviewDecision({
          claimId: claim.id,
          decision: "modified",
          modifiedClaimText: modifiedText.trim(),
          comments: reviewComments || undefined,
        });
        setActionSuccess(`Claim modified: original marked modified and revision submitted for re-verification.`);
      } else if (action === "escalate") {
        await submitReviewDecision({
          claimId: claim.id,
          decision: "escalated",
          escalationCategory,
          comments: reviewComments || undefined,
        });
        setActionSuccess(`Claim escalated to ${escalationCategory} compliance team.`);
      } else if (action === "reject") {
        await submitReviewDecision({
          claimId: claim.id,
          decision: "rejected",
          comments: reviewComments || undefined,
        });
        setActionSuccess(`Claim rejected by compliance.`);
      }

      handleCloseModal();
      await refreshQueue();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record review decision");
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Human Review & Compliance Queue
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-violet-950/70 text-violet-300 border border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]">
              Human-in-the-Loop Gate
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Authoritative human sign-off workspace. Review AI discrepancies, authorize overrides, and validate claim revisions.
          </p>
        </div>

        {reviewer && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs shadow-inner">
            <UserCheck className="w-4 h-4 text-violet-400" />
            <span className="text-slate-400">Reviewer:</span>
            <strong className="text-white">{reviewer.name}</strong>
            <span className="px-1.5 py-0.5 rounded bg-violet-950/80 border border-violet-800/60 text-violet-300 text-[10px] font-semibold uppercase">
              {reviewer.role.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-lg">
        <div data-tour="reviews-risk-filter" className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold uppercase text-[10px]">Risk:</span>
          {["all", "critical", "high", "medium", "low"].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all capitalize text-xs ${
                riskFilter === r
                  ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}

          <span className="text-slate-700 mx-1">|</span>

          <span className="text-slate-400 font-semibold uppercase text-[10px]">Status:</span>
          {["all", "pending", "in_review", "escalated", "modified"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-all capitalize text-xs ${
                statusFilter === s
                  ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                  : "bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search claims or campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Queue Items */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading prioritized compliance review queue...
        </div>
      ) : queue.length === 0 ? (
        <div data-tour="reviews-queue-table" className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-12 text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center justify-center mx-auto mb-3 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Compliance Queue Clear</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            All active marketing assertions have been reviewed, verified, or published according to enterprise governance protocol.
          </p>
        </div>
      ) : (
        <div data-tour="reviews-queue-table" className="space-y-4">
          {queue.map((claim) => {
            const isContradicted = claim.verification_status === "contradicted";
            const isHighRisk = claim.risk_level === "critical" || claim.risk_level === "high";
            const requiresOverride = isContradicted || isHighRisk;

            return (
              <div
                key={claim.id}
                className={`rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl transition-all border-l-4 ${
                  claim.risk_level === "critical"
                    ? "border-l-rose-500 bg-gradient-to-r from-rose-950/20 via-slate-900/60 to-slate-900/60"
                    : claim.risk_level === "high"
                    ? "border-l-amber-500 bg-gradient-to-r from-amber-950/15 via-slate-900/60 to-slate-900/60"
                    : claim.verification_status === "contradicted"
                    ? "border-l-rose-500"
                    : "border-l-violet-500"
                }`}
              >
                <div className="pb-3 border-b border-slate-800/60">
                  {/* Top Meta Bar: Separating AI Finding from Human Workflow & Campaign */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-violet-300 bg-violet-950/70 border border-violet-800/60 px-2 py-0.5 rounded">
                        {claim.claim_type.replace(/_/g, " ")}
                      </span>
                      <StatusPill status={claim.verification_status} />
                      <span className="text-slate-600">·</span>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[11px]">
                        <span className="text-slate-400 font-medium">Human Decision:</span>
                        <span className={`font-semibold uppercase text-[10px] ${
                          claim.review_status === "approved"
                            ? "text-emerald-300"
                            : claim.review_status === "rejected"
                            ? "text-rose-300"
                            : claim.review_status === "modified"
                            ? "text-cyan-300"
                            : claim.review_status === "escalated"
                            ? "text-purple-300"
                            : "text-amber-300"
                        }`}>
                          {claim.review_status?.replace(/_/g, " ") || "Pending Sign-Off"}
                        </span>
                      </div>
                      {claim.risk_level && (
                        <Badge variant={riskBadgeMap[claim.risk_level] || "default"} size="sm">
                          {claim.risk_level.toUpperCase()} RISK
                        </Badge>
                      )}
                    </div>

                    <span className="text-xs text-slate-400">
                      Campaign: <strong className="text-white">{claim.submission_title || "General Ad"}</strong>
                    </span>
                  </div>

                  {/* Prominent Marketing Assertion */}
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                      Marketing Assertion Under Review
                    </span>
                    <h3 className="text-base text-white font-semibold leading-relaxed">
                      &ldquo;{claim.claim_text}&rdquo;
                    </h3>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  {/* AI Evaluation Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-800/40">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>AI Discrepancy & Verification Rationale</span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed font-sans">
                        {claim.explanation || "Deterministic verification evaluated against clinical dossier."}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-1">
                        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>AI Defensible Correction Suggestion</span>
                      </div>
                      <p className="text-emerald-200/90 leading-relaxed font-sans">
                        {claim.suggested_correction ? (
                          `“${claim.suggested_correction}”`
                        ) : (
                          <span className="italic text-slate-500">No correction suggestion generated for this assertion.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Attached Clinical Evidence with Interactive Citation Viewer */}
                  {claim.evidence && claim.evidence.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-violet-400" />
                          <span>Ground-Truth Evidence Citation</span>
                          {claim.evidence[0].page_number && (
                            <span className="font-mono text-cyan-300 ml-1">
                              (Page {claim.evidence[0].page_number})
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveCitationModal({
                              claimId: claim.id,
                              claimText: claim.claim_text,
                              evidenceId: claim.evidence?.[0]?.id,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 text-violet-300 font-semibold text-[11px] transition-colors cursor-pointer shadow-sm"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Inspect Document Citation</span>
                        </button>
                      </div>

                      <blockquote className="text-slate-300 italic font-serif leading-relaxed pl-2 border-l-2 border-violet-700/60">
                        &ldquo;{claim.evidence[0].evidence_excerpt}&rdquo;
                      </blockquote>
                    </div>
                  )}

                  {/* Compliance Lifecycle Stepper */}
                  <div className="pt-2 border-t border-slate-800">
                    <ClaimLifecycleStepper
                      compact={true}
                      textStart={claim.text_start}
                      textEnd={claim.text_end}
                      extractionConfidence={claim.extraction_confidence}
                      verificationStatus={claim.verification_status}
                      riskLevel={claim.risk_level}
                      reviewStatus={claim.review_status}
                    />
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400">
                      Claim ID: <code className="font-mono text-violet-400">{claim.id.slice(0, 8)}...</code> ·
                      Product: <strong className="text-white">{claim.product_name || "DermaGlow"}</strong>
                      {claim.verification_status === "supported" && claim.review_status !== "approved" && (
                        <span className="block text-[10px] text-emerald-400/90 mt-0.5">
                          ✓ AI supported by evidence dossier — awaiting formal human reviewer sign-off to clear publication gate.
                        </span>
                      )}
                    </div>

                    <div data-tour="reviews-decision-actions" className="flex items-center gap-2 flex-wrap">
                      {reviewer && reviewer.role === "viewer" ? (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 italic">
                          Read-only viewer account (compliance decision actions disabled)
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleOpenAction(claim, "reject")}
                            title="Reject claim permanently from marketing publication"
                          >
                            Reject
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAction(claim, "escalate")}
                            title="Escalate to legal or specialized medical compliance"
                          >
                            Escalate
                          </Button>

                          {claim.suggested_correction && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenAction(claim, "modify")}
                              className="border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/40"
                              title="Adopt AI suggested defensible correction and re-verify"
                            >
                              Apply Revision
                            </Button>
                          )}

                          {requiresOverride ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAction(claim, "override")}
                              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-amber-500/30"
                              title="Provide required compliance justification to override evidence gap"
                            >
                              Authorize Override
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenAction(claim, "approve")}
                              title="Formally sign-off and approve claim for marketing publication"
                            >
                              Approve Sign-Off
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Decision Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <h3 className="font-bold text-white text-sm">
                {activeActionModal.action === "approve" && "Sign-Off: Approve Claim"}
                {activeActionModal.action === "override" && "Policy Exception: Authorize Override"}
                {activeActionModal.action === "modify" && "Modify Claim & Trigger Re-Verification"}
                {activeActionModal.action === "escalate" && "Escalate Claim for Specialized Sign-Off"}
                {activeActionModal.action === "reject" && "Compliance Rejection"}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-violet-950/30 rounded-xl border border-violet-800/40 text-violet-200 italic font-serif">
                &ldquo;{activeActionModal.claim.claim_text}&rdquo;
              </div>

              {activeActionModal.action === "override" && (
                <div>
                  <label className="font-semibold text-rose-300 block mb-1">
                    Mandatory Policy Override Reason (Min 10 Characters):
                  </label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document regulatory justification, grandfather clause, or authorized exception..."
                    className="w-full p-2.5 rounded-xl border border-amber-800/80 bg-amber-950/30 text-xs text-amber-200 placeholder-amber-400/50 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {activeActionModal.action === "modify" && (
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Revised Defensible Claim Phrasing:
                  </label>
                  <textarea
                    rows={3}
                    value={modifiedText}
                    onChange={(e) => setModifiedText(e.target.value)}
                    placeholder="Enter revised phrasing that maintains scientific defensibility..."
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-violet-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Note: Creating a revision preserves the original claim with immutable lineage pointer and dispatches deterministic re-verification.
                  </p>
                </div>
              )}

              {activeActionModal.action === "escalate" && (
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Escalation Category:
                  </label>
                  <select
                    value={escalationCategory}
                    onChange={(e) => setEscalationCategory(e.target.value as EscalationCategory)}
                    className="w-full p-2 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-violet-500 capitalize"
                  >
                    <option value="legal">Legal & IP Counsel</option>
                    <option value="regulatory">Regulatory & FDA Compliance</option>
                    <option value="clinical">Clinical Research & Medical Affairs</option>
                    <option value="brand_compliance">Brand Governance</option>
                    <option value="evidence_conflict">Conflicting Evidence Adjudication</option>
                    <option value="other">Other Specialized Review</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Reviewer Notes / Commentary:
                </label>
                <textarea
                  rows={2}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Optional audit trail note..."
                  className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/60">
              <Button variant="outline" size="sm" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                variant={activeActionModal.action === "reject" ? "danger" : "primary"}
                size="sm"
                onClick={handleSubmitDecision}
                isLoading={isSubmitting}
              >
                Confirm Decision
              </Button>
            </div>
          </div>
        </div>
      )}
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
    </AppLayout>
  );
}
