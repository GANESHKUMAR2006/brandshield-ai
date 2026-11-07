"use client";

import React, { useState, useEffect } from "react";
import {
  LiveSubmissionDetails,
  fetchSubmissionDetails,
  updateSubmission,
  extractClaims,
  verifySubmissionClaims,
  verifyClaim,
  publishSubmission,
} from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/utils/formatters";
import { ClaimLifecycleStepper } from "@/components/claims/ClaimLifecycleStepper";
import {
  X,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  History,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

interface SubmissionDetailModalProps {
  submissionId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function SubmissionDetailModal({
  submissionId,
  onClose,
  onUpdated,
}: SubmissionDetailModalProps) {
  const [details, setDetails] = useState<LiveSubmissionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [verifyingClaimId, setVerifyingClaimId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [revisedContent, setRevisedContent] = useState("");
  const [activeTab, setActiveTab] = useState<"current" | "history" | "claims">("current");

  const handleRunExtraction = async () => {
    if (!details || isExtracting) return;
    setIsExtracting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await extractClaims(details.id, {
        versionId: details.current_version_id || undefined,
        forceReextract: details.claims.length === 0,
      });
      setSuccessMsg(
        `AI Claim Extraction complete: identified ${res.claimsCount} claims in ${res.executionTimeMs}ms via ${res.provider} (${res.model}).`
      );
      await loadDetails(details.id);
      setActiveTab("claims");
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Claim extraction failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleVerifyAllClaims = async () => {
    if (!details) return;
    setIsVerifyingAll(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const results = await verifySubmissionClaims(details.id);
      const supportedCount = results.filter((r) => r.status === "supported").length;
      const contradictedCount = results.filter((r) => r.status === "contradicted").length;
      setSuccessMsg(
        `Batch deterministic verification complete: evaluated ${results.length} claims (${supportedCount} supported, ${contradictedCount} contradicted, ${results.length - supportedCount - contradictedCount} other).`
      );
      await loadDetails(details.id);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Batch claim verification failed");
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleVerifySingleClaim = async (claimId: string) => {
    setVerifyingClaimId(claimId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await verifyClaim(claimId);
      setSuccessMsg(
        `Claim verification completed: status is ${res.status.toUpperCase()} (${res.riskLevel.toUpperCase()} risk).`
      );
      if (details) await loadDetails(details.id);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Claim verification failed");
    } finally {
      setVerifyingClaimId(null);
    }
  };

  const handlePublishCampaign = async () => {
    if (!details) return;
    setIsPublishing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await publishSubmission(details.id);
      setSuccessMsg(`Campaign "${res.title}" successfully approved and published!`);
      await loadDetails(details.id);
      onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Campaign publication failed");
    } finally {
      setIsPublishing(false);
    }
  };

  const loadDetails = React.useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSubmissionDetails(id);
      setDetails(data);
      setRevisedContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (submissionId) {
      fetchSubmissionDetails(submissionId)
        .then((data) => {
          if (isMounted) {
            setDetails(data);
            setRevisedContent(data.content);
            setIsEditing(false);
            setSuccessMsg(null);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err instanceof Error ? err.message : "Failed to load submission");
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [submissionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (submissionId && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [submissionId, onClose]);

  if (!submissionId) return null;

  const handleSaveRevision = async () => {
    if (!details) return;
    setError(null);
    setSuccessMsg(null);

    if (revisedContent.trim() === details.content.trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateSubmission(details.id, {
        content: revisedContent.trim(),
        actor: "Dr. Elena Vance",
      });
      setSuccessMsg("Revision saved! A new version was created and previous versions preserved.");
      setIsEditing(false);
      await loadDetails(details.id);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save revision");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!details) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateSubmission(details.id, {
        status: newStatus,
        actor: "Dr. Elena Vance",
      });
      setSuccessMsg(`Status updated to ${newStatus}`);
      await loadDetails(details.id);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-950/80 border border-violet-800/60 rounded-xl text-violet-400 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  {details?.channel || "Channel"}
                </span>
                {details && <StatusPill status={details.status} />}
                <Badge variant="indigo" size="sm">
                  v{details?.current_version_number ?? 1}
                </Badge>
              </div>
              <h3 className="text-base font-bold text-white mt-1 leading-snug">
                {details?.title || "Loading..."}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ID: <span className="font-mono text-cyan-300">{details?.id}</span> · Submitted by {details?.submitted_by}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 mx-5 mt-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 mx-5 mt-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Publication Gate Banner */}
        {details && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">Publication Gate:</span>
                  <StatusPill status={details.publication_status || "ineligible"} />
                  {(details.status === "published" || details.publication_status === "published") && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold text-[10px] shadow-[0_0_6px_rgba(52,211,153,0.3)]">
                      LIVE & PUBLISHED
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {details.claims.length === 0
                    ? "Ineligible: No claims extracted from content yet."
                    : `${details.claims.filter((c) => (c as unknown as { review_status?: string }).review_status === "approved").length} of ${details.claims.length} claims approved by compliance.`}
                </span>
              </div>
            </div>

            {details.status !== "published" && details.publication_status !== "published" && (
              <Button
                variant="primary"
                size="sm"
                onClick={handlePublishCampaign}
                isLoading={isPublishing}
                disabled={details.publication_status !== "eligible"}
                className={
                  details.publication_status === "eligible"
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-md shadow-emerald-950/50"
                    : "opacity-50 cursor-not-allowed"
                }
              >
                Publish Campaign
              </Button>
            )}
          </div>
        )}

        {/* Precise Publication Gate Blocking Reasons */}
        {details && details.publication_status !== "eligible" && Boolean(details.publication_eligibility_details) && (
          <div className="mx-5 mt-2.5 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200">
            <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Publication Gate Invariants Pending ({(details.publication_eligibility_details as { blockingReasons?: string[] }).blockingReasons?.length || 0}):</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90 ml-1">
              {((details.publication_eligibility_details as { blockingReasons?: string[] }).blockingReasons || []).slice(0, 4).map((reason: string, idx: number) => (
                <li key={idx} className="leading-snug">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Navigation Tabs & Actions */}
        <div className="px-5 pt-3 flex items-center justify-between border-b border-slate-800 text-xs font-medium">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("current")}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer ${
                activeTab === "current"
                  ? "border-violet-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              Current Content (v{details?.current_version_number ?? 1})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-violet-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Version History ({details?.versions.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("claims")}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "claims"
                  ? "border-violet-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Associated Claims ({details?.claims.length ?? 0})
            </button>
          </div>

          <div className="pb-1.5">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunExtraction}
              isLoading={isExtracting}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-cyan-300" />
              {isExtracting ? "Extracting..." : "Extract Claims with AI"}
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {isLoading && (
            <div className="p-8 text-center text-slate-400">Loading submission details...</div>
          )}

          {/* TAB 1: CURRENT CONTENT & REVISION */}
          {!isLoading && activeTab === "current" && details && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Associated Product: </span>
                  <strong className="text-white">
                    {details.product_name
                      ? `${details.product_name} (${details.product_sku})`
                      : "Unassigned Product"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Created: </span>
                  <span className="text-slate-200 font-medium">
                    {formatDate(details.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-white text-xs">
                    Marketing Content (Version {details.current_version_number})
                  </label>
                  {!isEditing && details.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      Revise Content
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={revisedContent}
                      onChange={(e) => setRevisedContent(e.target.value)}
                      className="w-full p-3 bg-slate-950 border border-violet-500 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-violet-500 font-sans leading-relaxed shadow-inner"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-amber-300">
                        Saving changes creates Version {details.current_version_number + 1} and preserves Version {details.current_version_number}.
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setRevisedContent(details.content);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveRevision}
                          isLoading={isSaving}
                        >
                          Save New Version
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed text-sm">
                    {details.content}
                  </div>
                )}
              </div>

              {/* Status Transition Action Bar */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
                <div>
                  <div className="font-bold text-white">Workflow Status Transition</div>
                  <div className="text-[11px] text-slate-400">
                    Current stage: <strong className="text-violet-300 capitalize">{details.status.replace(/_/g, " ")}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {details.status === "draft" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleStatusChange("submitted")}
                      isLoading={isSaving}
                    >
                      Submit for Claim Verification
                    </Button>
                  )}
                  {details.status === "submitted" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange("under_review")}
                      isLoading={isSaving}
                    >
                      Move to Under Review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VERSION HISTORY */}
          {!isLoading && activeTab === "history" && details && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 mb-2">
                Every saved revision generates an immutable version record. Older versions remain completely intact for compliance audits.
              </div>

              {details.versions.map((ver) => {
                const isCurrent = ver.version_number === details.current_version_number;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? "bg-violet-950/30 border-violet-800/60"
                        : "bg-slate-900/60 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          Version {ver.version_number}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800">
                            Current Version
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(ver.created_at)} by {ver.created_by}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">
                      {ver.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: CLAIMS */}
          {!isLoading && activeTab === "claims" && details && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Extracted Claims for Version {details.current_version_number} ({details.claims.length} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunExtraction}
                    isLoading={isExtracting}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Re-extract
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVerifyAllClaims}
                    isLoading={isVerifyingAll}
                    disabled={details.claims.length === 0}
                  >
                    <FileCheck2 className="w-3.5 h-3.5 mr-1" />
                    {isVerifyingAll ? "Verifying All..." : "Verify All Claims"}
                  </Button>
                </div>
              </div>

              {details.claims.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-dashed border-slate-800">
                  <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <div className="font-bold text-white text-sm">No claims extracted yet</div>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Execute the AI Claim Extraction Engine to automatically detect and extract factual statements, ingredients, prices, and guarantees.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={handleRunExtraction}
                    isLoading={isExtracting}
                  >
                    Run AI Claim Extraction Now
                  </Button>
                </div>
              ) : (
                details.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-colors shadow-lg"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-violet-300 bg-violet-950/80 border border-violet-800/60 px-2 py-0.5 rounded">
                          {claim.claim_type.replace(/_/g, " ")}
                        </span>
                        {claim.text_start !== null && claim.text_end !== null && (
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                            span [{claim.text_start}..{claim.text_end}]
                          </span>
                        )}
                        {claim.risk_level && (
                          <Badge
                            variant={
                              claim.risk_level === "critical" || claim.risk_level === "high"
                                ? "danger"
                                : claim.risk_level === "medium"
                                ? "warning"
                                : "success"
                            }
                            size="sm"
                          >
                            {claim.risk_level.toUpperCase()} RISK
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-slate-400">
                          {Math.round(claim.extraction_confidence * 100)}% conf
                        </span>
                        <StatusPill status={claim.verification_status} />
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${
                          (claim as unknown as { review_status?: string }).review_status === "approved"
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                            : (claim as unknown as { review_status?: string }).review_status === "rejected"
                            ? "bg-rose-950/80 text-rose-300 border-rose-800/60"
                            : (claim as unknown as { review_status?: string }).review_status === "modified"
                            ? "bg-cyan-950/80 text-cyan-300 border-cyan-800/60"
                            : (claim as unknown as { review_status?: string }).review_status === "escalated"
                            ? "bg-purple-950/80 text-purple-300 border-purple-800/60"
                            : "bg-amber-950/80 text-amber-300 border-amber-800/60"
                        }`}>
                          {(claim as unknown as { review_status?: string }).review_status?.replace(/_/g, " ") || "Pending Review"}
                        </span>
                      </div>
                    </div>

                    <div className="font-semibold text-white leading-snug text-sm">
                      &ldquo;{claim.claim_text}&rdquo;
                    </div>

                    {/* 4-Stage Compliance Progression Stepper */}
                    <div className="my-2.5 pt-1 border-t border-slate-800">
                      <ClaimLifecycleStepper
                        compact={true}
                        textStart={claim.text_start}
                        textEnd={claim.text_end}
                        extractionConfidence={claim.extraction_confidence}
                        verificationStatus={claim.verification_status}
                        riskLevel={claim.risk_level}
                        reviewStatus={(claim as unknown as { review_status?: string }).review_status}
                      />
                    </div>

                    {claim.extracted_entities && Object.keys(claim.extracted_entities).length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        {Object.entries(claim.extracted_entities).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono"
                          >
                            <span className="text-slate-400 font-sans">{k}:</span>
                            <strong>{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {claim.explanation && (
                      <div className="text-[11px] text-slate-300 mt-2.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 leading-relaxed">
                        {claim.explanation}
                      </div>
                    )}

                    {claim.suggested_correction && (
                      <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-xs">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">
                          Suggested Defensible Correction:
                        </span>
                        <p className="text-emerald-200 font-medium mt-0.5">
                          &ldquo;{claim.suggested_correction}&rdquo;
                        </p>
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {claim.verified_at
                          ? `Verified: ${formatDateTime(claim.verified_at)}`
                          : "Awaiting deterministic verification"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifySingleClaim(claim.id)}
                          isLoading={verifyingClaimId === claim.id}
                          className="h-7 text-[11px] px-2.5"
                        >
                          Verify Claim
                        </Button>
                        <a
                          href={`/reviews?search=${encodeURIComponent(claim.claim_text.slice(0, 30))}`}
                          className="inline-flex items-center justify-center h-7 text-[11px] px-2.5 rounded-lg border border-violet-800/60 bg-violet-950/80 text-violet-300 hover:bg-violet-900 font-semibold transition-colors"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review in Queue →
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
