"use client";

import React, { useState, useEffect } from "react";
import {
  LiveSubmissionDetails,
  fetchSubmissionDetails,
  updateSubmission,
  extractClaims,
  verifySubmissionClaims,
  verifyClaim,
} from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import {
  CloseIcon,
  FileCheckIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  HistoryIcon,
  SparklesIcon,
} from "@/components/ui/Icons";
import { formatDate, formatDateTime } from "@/lib/utils/formatters";

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
  const [verifyingClaimId, setVerifyingClaimId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [revisedContent, setRevisedContent] = useState("");
  const [activeTab, setActiveTab] = useState<"current" | "history" | "claims">("current");

  const handleRunExtraction = async () => {
    if (!details) return;
    setIsExtracting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await extractClaims(details.id, {
        versionId: details.current_version_id || undefined,
        forceReextract: true,
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
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 shrink-0">
              <FileCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {details?.channel || "Channel"}
                </span>
                {details && <StatusPill status={details.status} />}
                <Badge variant="indigo" size="sm">
                  v{details?.current_version_number ?? 1}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-1 leading-snug">
                {details?.title || "Loading..."}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ID: {details?.id} · Submitted by {details?.submitted_by}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 mx-5 mt-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 mx-5 mt-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Navigation Tabs & Actions */}
        <div className="px-5 pt-3 flex items-center justify-between border-b border-slate-100 text-xs font-medium">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("current")}
              className={`pb-2 border-b-2 transition-colors cursor-pointer ${
                activeTab === "current"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Current Content (v{details?.current_version_number ?? 1})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <HistoryIcon className="w-3.5 h-3.5" />
              Version History ({details?.versions.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("claims")}
              className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "claims"
                  ? "border-indigo-600 text-indigo-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <SparklesIcon className="w-3.5 h-3.5 text-indigo-600" />
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
              <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
              {isExtracting ? "Extracting..." : "Extract Claims with AI"}
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {isLoading && (
            <div className="p-8 text-center text-slate-400">Loading submission details...</div>
          )}

          {/* TAB 1: CURRENT CONTENT & REVISION */}
          {!isLoading && activeTab === "current" && details && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Associated Product: </span>
                  <strong className="text-slate-900">
                    {details.product_name
                      ? `${details.product_name} (${details.product_sku})`
                      : "Unassigned Product"}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Created: </span>
                  <span className="text-slate-800 font-medium">
                    {formatDate(details.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-900">
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
                      className="w-full p-3 bg-white border border-indigo-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-amber-700">
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
                  <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
                    {details.content}
                  </div>
                )}
              </div>

              {/* Status Transition Action Bar */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">Workflow Status Transition</div>
                  <div className="text-[11px] text-slate-500">
                    Current stage: <strong className="capitalize">{details.status.replace(/_/g, " ")}</strong>
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
              <div className="text-xs text-slate-500 mb-2">
                Every saved revision generates an immutable version record. Older versions remain completely intact for compliance audits.
              </div>

              {details.versions.map((ver) => {
                const isCurrent = ver.version_number === details.current_version_number;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isCurrent ? "bg-indigo-50/40 border-indigo-200" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          Version {ver.version_number}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            Current Version
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(ver.created_at)} by {ver.created_by}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
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
                <span className="text-xs text-slate-500 font-medium">
                  Extracted Claims for Version {details.current_version_number} ({details.claims.length} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunExtraction}
                    isLoading={isExtracting}
                  >
                    <SparklesIcon className="w-3.5 h-3.5 mr-1" />
                    Re-extract
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVerifyAllClaims}
                    isLoading={isVerifyingAll}
                    disabled={details.claims.length === 0}
                  >
                    <FileCheckIcon className="w-3.5 h-3.5 mr-1" />
                    {isVerifyingAll ? "Verifying All..." : "Verify All Claims"}
                  </Button>
                </div>
              </div>

              {details.claims.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <SparklesIcon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800 text-sm">No claims extracted yet</div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          {claim.claim_type.replace(/_/g, " ")}
                        </span>
                        {claim.text_start !== null && claim.text_end !== null && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
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
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-500">
                          {Math.round(claim.extraction_confidence * 100)}% conf
                        </span>
                        <StatusPill status={claim.verification_status} />
                      </div>
                    </div>

                    <div className="font-semibold text-slate-900 leading-snug text-sm">
                      &ldquo;{claim.claim_text}&rdquo;
                    </div>

                    {claim.extracted_entities && Object.keys(claim.extracted_entities).length > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                        {Object.entries(claim.extracted_entities).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono"
                          >
                            <span className="text-slate-400 font-sans">{k}:</span>
                            <strong>{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {claim.explanation && (
                      <div className="text-[11px] text-slate-700 mt-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 leading-relaxed">
                        {claim.explanation}
                      </div>
                    )}

                    {claim.suggested_correction && (
                      <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                          Suggested Defensible Correction:
                        </span>
                        <p className="text-emerald-950 font-medium mt-0.5">
                          &ldquo;{claim.suggested_correction}&rdquo;
                        </p>
                      </div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {claim.verified_at
                          ? `Verified: ${formatDateTime(claim.verified_at)}`
                          : "Awaiting deterministic verification"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifySingleClaim(claim.id)}
                        isLoading={verifyingClaimId === claim.id}
                        className="h-7 text-[11px] px-2.5"
                      >
                        Verify Claim
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/40">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
