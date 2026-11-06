"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  SparklesIcon,
} from "@/components/ui/Icons";
import {
  LiveClaimRecord,
  fetchReviewQueue,
  submitReviewDecision,
  ReviewQueueResponse,
} from "@/lib/api-client";
import { EscalationCategory } from "@/types";

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

  // Action Dialog State
  const [activeActionModal, setActiveActionModal] = useState<{
    claim: LiveClaimRecord;
    action: "approve" | "override" | "modify" | "escalate" | "reject";
  } | null>(null);

  const [overrideReason, setOverrideReason] = useState("");
  const [escalationCategory, setEscalationCategory] = useState<EscalationCategory>("regulatory");
  const [modifiedText, setModifiedText] = useState("");
  const [reviewComments, setReviewComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize queue from backend whenever filters or search change
  useEffect(() => {
    let isMounted = true;

    fetchReviewQueue({
      riskLevel: riskFilter !== "all" ? riskFilter : undefined,
      reviewStatus: statusFilter !== "all" ? statusFilter : undefined,
      search: searchQuery.trim() || undefined,
    })
      .then((res) => {
        if (isMounted) {
          setQueue(res.data);
          setReviewer(res.reviewer);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load review queue");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [riskFilter, statusFilter, searchQuery]);

  const refreshQueue = async () => {
    setIsLoading(true);
    try {
      const res: ReviewQueueResponse = await fetchReviewQueue({
        riskLevel: riskFilter !== "all" ? riskFilter : undefined,
        reviewStatus: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setQueue(res.data);
      setReviewer(res.reviewer);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setIsLoading(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Human Review & Compliance Queue
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Phase 6 Governance
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritative human sign-off workspace. Review AI discrepancies, authorize overrides, and validate claim revisions.
          </p>
        </div>

        {reviewer && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-400">Reviewer:</span>
            <strong className="text-slate-800">{reviewer.name}</strong>
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-semibold uppercase">
              {reviewer.role.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Risk:</span>
          {["all", "critical", "high", "medium", "low"].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors capitalize ${
                riskFilter === r
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {r}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-400 font-medium">Status:</span>
          {["all", "pending", "in_review", "escalated", "modified"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors capitalize ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search claims or campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-indigo-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Queue Items */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Loading prioritized compliance review queue...
        </div>
      ) : queue.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Compliance Queue Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All active marketing assertions have been reviewed, verified, or published according to enterprise governance protocol.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((claim) => {
            const isContradicted = claim.verification_status === "contradicted";
            const isHighRisk = claim.risk_level === "high" || claim.risk_level === "critical";
            const requiresOverride = isContradicted || isHighRisk;

            return (
              <Card
                key={claim.id}
                className={`border-l-4 transition-all ${
                  claim.risk_level === "critical"
                    ? "border-l-rose-600 bg-rose-50/20"
                    : claim.risk_level === "high"
                    ? "border-l-rose-500"
                    : claim.verification_status === "contradicted"
                    ? "border-l-amber-500"
                    : "border-l-indigo-500"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {claim.claim_type.replace(/_/g, " ")}
                      </span>
                      <StatusPill status={claim.verification_status} />
                      <span className="text-slate-300">·</span>
                      <span className="text-xs font-semibold text-slate-600">
                        Human Status: <StatusPill status={claim.review_status || "pending"} />
                      </span>
                      {claim.risk_level && (
                        <Badge variant={riskBadgeMap[claim.risk_level] || "default"} size="sm">
                          {claim.risk_level.toUpperCase()} RISK
                        </Badge>
                      )}
                    </div>

                    <span className="text-xs text-slate-400">
                      Campaign: <strong className="text-slate-700">{claim.submission_title || "General Ad"}</strong>
                    </span>
                  </div>

                  <CardTitle className="text-base text-slate-900 mt-2 font-serif font-medium">
                    &ldquo;{claim.claim_text}&rdquo;
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* AI Evaluation Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                        <AlertCircleIcon className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>AI Discrepancy & Verification Rationale</span>
                      </div>
                      <p className="text-amber-800 leading-relaxed font-sans">
                        {claim.explanation || "Deterministic verification evaluated against clinical dossier."}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-900 mb-1">
                        <SparklesIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>AI Defensible Correction Suggestion</span>
                      </div>
                      <p className="text-emerald-800 leading-relaxed font-sans">
                        {claim.suggested_correction ? (
                          `“${claim.suggested_correction}”`
                        ) : (
                          <span className="italic text-slate-400">No correction suggestion generated for this assertion.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Attached Clinical Evidence if available */}
                  {claim.evidence && claim.evidence.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Ground-Truth Evidence Citation:
                      </div>
                      <div className="text-slate-700 italic">
                        {claim.evidence[0].evidence_excerpt}
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="text-[11px] text-slate-400">
                      Claim ID: <code className="font-mono text-slate-600">{claim.id.slice(0, 8)}...</code> ·
                      Product: <strong className="text-slate-700">{claim.product_name || "DermaGlow"}</strong>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenAction(claim, "reject")}
                      >
                        Reject
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAction(claim, "escalate")}
                      >
                        Escalate
                      </Button>

                      {claim.suggested_correction && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAction(claim, "modify")}
                        >
                          Apply Revision
                        </Button>
                      )}

                      {requiresOverride ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAction(claim, "override")}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          Authorize Override
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenAction(claim, "approve")}
                        >
                          Approve Sign-Off
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Decision Modal */}
      {activeActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-bold text-slate-900 text-sm">
                {activeActionModal.action === "approve" && "Sign-Off: Approve Claim"}
                {activeActionModal.action === "override" && "Policy Exception: Authorize Override"}
                {activeActionModal.action === "modify" && "Modify Claim & Trigger Re-Verification"}
                {activeActionModal.action === "escalate" && "Escalate Claim for Specialized Sign-Off"}
                {activeActionModal.action === "reject" && "Compliance Rejection"}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 italic">
                &ldquo;{activeActionModal.claim.claim_text}&rdquo;
              </div>

              {activeActionModal.action === "override" && (
                <div>
                  <label className="font-semibold text-rose-900 block mb-1">
                    Mandatory Policy Override Reason (Min 10 Characters):
                  </label>
                  <textarea
                    rows={3}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document regulatory justification, grandfather clause, or authorized exception..."
                    className="w-full p-2.5 rounded-lg border border-amber-300 bg-amber-50/30 text-xs focus:outline-indigo-500"
                  />
                </div>
              )}

              {activeActionModal.action === "modify" && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Revised Defensible Claim Phrasing:
                  </label>
                  <textarea
                    rows={3}
                    value={modifiedText}
                    onChange={(e) => setModifiedText(e.target.value)}
                    placeholder="Enter revised phrasing that maintains scientific defensibility..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:outline-indigo-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Note: Creating a revision preserves the original claim with immutable lineage pointer and dispatches deterministic re-verification.
                  </p>
                </div>
              )}

              {activeActionModal.action === "escalate" && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Escalation Category:
                  </label>
                  <select
                    value={escalationCategory}
                    onChange={(e) => setEscalationCategory(e.target.value as EscalationCategory)}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs focus:outline-indigo-500 capitalize"
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
                <label className="font-semibold text-slate-700 block mb-1">
                  Reviewer Notes / Commentary:
                </label>
                <textarea
                  rows={2}
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="Optional audit trail note..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs focus:outline-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/40">
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
    </AppLayout>
  );
}
