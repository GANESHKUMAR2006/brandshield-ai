"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Clock,
  Layers,
  Table as TableIcon,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatPercent, formatDateTime } from "@/lib/utils/formatters";
import {
  CitationCoordinate,
  fetchClaimCitations,
  fetchSourceDocumentContent,
  SourceDocumentContent,
} from "@/lib/api-client";

interface CitationViewerModalProps {
  isOpen: boolean;
  claimId: string;
  claimText?: string;
  initialEvidenceId?: string;
  onClose: () => void;
}

export function CitationViewerModal({
  isOpen,
  claimId,
  claimText,
  initialEvidenceId,
  onClose,
}: CitationViewerModalProps) {
  const [citations, setCitations] = useState<CitationCoordinate[]>([]);
  const [selectedCitationIndex, setSelectedCitationIndex] = useState(0);
  const [documentContent, setDocumentContent] = useState<SourceDocumentContent | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedExcerpt, setCopiedExcerpt] = useState(false);

  // Load citations for this claim
  useEffect(() => {
    if (!isOpen || !claimId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchClaimCitations(claimId)
      .then(async (cites) => {
        if (!isMounted) return;
        if (!cites || cites.length === 0) {
          setError("No evidence citations currently linked to this claim.");
          setIsLoading(false);
          return;
        }

        setCitations(cites);

        // Determine initial index
        let initIndex = 0;
        if (initialEvidenceId) {
          const found = cites.findIndex((c) => c.evidenceId === initialEvidenceId);
          if (found >= 0) initIndex = found;
        }
        setSelectedCitationIndex(initIndex);

        const primary = cites[initIndex];
        setCurrentPage(primary.pageNumber || 1);

        // Fetch source document pages if sourceDocumentId is present
        if (primary.sourceDocumentId) {
          try {
            const doc = await fetchSourceDocumentContent(primary.sourceDocumentId);
            if (isMounted) setDocumentContent(doc);
          } catch {
            // Document content will fallback to excerpt or extracted pages from citation
          }
        }
        if (isMounted) setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load citation coordinates");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, claimId, initialEvidenceId]);

  // When selected citation changes, update page number and fetch document if needed
  const activeCitation = citations[selectedCitationIndex] || null;

  useEffect(() => {
    if (activeCitation) {
      setCurrentPage(activeCitation.pageNumber || 1);
      if (activeCitation.sourceDocumentId && documentContent?.id !== activeCitation.sourceDocumentId) {
        fetchSourceDocumentContent(activeCitation.sourceDocumentId)
          .then((doc) => setDocumentContent(doc))
          .catch(() => {});
      }
    }
  }, [selectedCitationIndex, activeCitation]);

  // Keyboard navigation & lock body scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevPage();
      if (e.key === "ArrowRight") handleNextPage();
    };
    if (isOpen && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [isOpen, currentPage, documentContent]);

  // Resolve pages list
  const pages = useMemo(() => {
    if (documentContent?.pages && documentContent.pages.length > 0) {
      return documentContent.pages;
    }
    if (activeCitation?.extractedPages && activeCitation.extractedPages.length > 0) {
      return activeCitation.extractedPages;
    }
    // Fallback single page containing evidence excerpt
    return [
      {
        pageNumber: activeCitation?.pageNumber || 1,
        text: activeCitation?.evidenceExcerpt
          ? `[Document Version ${activeCitation.versionNumber || 1} — Clinical Protocol Section: ${activeCitation.sectionReference || "Results"}]\n\n${activeCitation.evidenceExcerpt}`
          : "Source document content currently being indexed.",
      },
    ];
  }, [documentContent, activeCitation]);

  const totalPages = Math.max(1, pages.length);
  const currentPageData = pages.find((p) => p.pageNumber === currentPage) || pages[0];

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleCopyExcerpt = () => {
    if (!activeCitation?.evidenceExcerpt) return;
    navigator.clipboard.writeText(activeCitation.evidenceExcerpt);
    setCopiedExcerpt(true);
    setTimeout(() => setCopiedExcerpt(false), 2000);
  };

  if (!isOpen) return null;

  // Stance classification helpers
  const isContradiction = activeCitation?.stance === "contradicting";
  const isSupporting = activeCitation?.stance === "supporting";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Document Citation Viewer"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-800/60 text-violet-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {activeCitation?.documentTitle || documentContent?.title || "Document Citation Viewer"}
                </h2>
                {activeCitation && (
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                    v{activeCitation.versionNumber || 1}
                  </span>
                )}
                {isSupporting && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-800/80 shadow-[0_0_8px_rgba(52,211,153,0.25)]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>SUPPORTING EVIDENCE</span>
                  </span>
                )}
                {isContradiction && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-950/90 text-rose-300 border border-rose-800/80 shadow-[0_0_8px_rgba(244,63,94,0.25)]">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>CONTRADICTING EVIDENCE</span>
                  </span>
                )}
                {!isSupporting && !isContradiction && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    CONTEXTUAL CITATION
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Exact in-document evidence grounding for marketing assertion verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close citation viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Evidence Citation Tabs */}
        {citations.length > 1 && (
          <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800/80 bg-slate-900/40 overflow-x-auto text-xs">
            <span className="text-slate-400 text-[11px] font-semibold mr-2 uppercase tracking-wider">
              Evidence Citations ({citations.length}):
            </span>
            {citations.map((cite, idx) => (
              <button
                key={cite.evidenceId || idx}
                type="button"
                onClick={() => setSelectedCitationIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap text-xs ${
                  selectedCitationIndex === idx
                    ? "bg-violet-600 text-white shadow-md shadow-violet-950/60"
                    : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span>Citation #{idx + 1}</span>
                <span className="text-[10px] opacity-80">
                  ({(cite.relevanceScore * 100).toFixed(0)}%)
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Assertion Banner */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0">Claim Assertion:</span>
            <span className="text-white font-medium italic truncate">
              &ldquo;{claimText || activeCitation?.claimText || "Marketing assertion"}&rdquo;
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px]">
            <span className="text-slate-400">
              Relevance: <strong className="text-cyan-300 font-mono">{formatPercent(activeCitation?.relevanceScore || 0.85)}</strong>
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              Extraction:{" "}
              <strong className="text-violet-300 uppercase font-mono text-[10px]">
                {activeCitation?.extractionMethod?.replace(/_/g, " ") || "digital text"}
              </strong>
            </span>
          </div>
        </div>

        {/* Main Content Area: Split Document Canvas & Metadata Drawer */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Canvas: Document Page View with Visual Highlighter */}
          <div className="lg:col-span-8 flex flex-col bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
            {/* Page Navigation Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/40 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  title="Previous Page (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-mono text-slate-300 text-xs">
                  Page <strong className="text-white">{currentPage}</strong> of{" "}
                  <strong className="text-white">{totalPages}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  title="Next Page (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {activeCitation && activeCitation.pageNumber !== currentPage && (
                <button
                  type="button"
                  onClick={() => setCurrentPage(activeCitation.pageNumber || 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-950/80 text-violet-300 hover:bg-violet-900 border border-violet-800/60 font-medium text-[11px] cursor-pointer"
                >
                  <span>Go to cited page ({activeCitation.pageNumber || 1})</span>
                </button>
              )}

              <div className="text-[11px] text-slate-500 hidden sm:block">
                Section: <span className="text-slate-300 font-medium">{activeCitation?.sectionReference || "Clinical Findings"}</span>
              </div>
            </div>

            {/* Document Page Reader Body */}
            <div className="flex-1 p-6 overflow-y-auto font-sans leading-relaxed text-sm bg-slate-950 select-text">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading source document page telemetry...</span>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
                  <p className="text-sm font-semibold text-white mb-1">Citation Retrieval Notice</p>
                  <p className="text-xs text-slate-400 max-w-md">{error}</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto bg-slate-900/60 border border-slate-800/80 rounded-xl p-8 shadow-inner relative space-y-4">
                  {/* Page Header Banner */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                    <span>
                      {activeCitation?.documentTitle} — Document ID: {activeCitation?.sourceDocumentId?.slice(0, 8)}...
                    </span>
                    <span>PAGE {currentPage}</span>
                  </div>

                  {/* Render Page Text with Highlight */}
                  {currentPageData ? (
                    <RenderHighlightedPage
                      pageText={currentPageData.text}
                      targetExcerpt={activeCitation?.evidenceExcerpt || ""}
                      stance={activeCitation?.stance || "contextual"}
                      isTargetPage={currentPage === (activeCitation?.pageNumber || 1)}
                    />
                  ) : (
                    <div className="text-slate-400 italic text-xs">No text content available for page {currentPage}.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Evidence Metadata & Provenance Drawer */}
          <div className="lg:col-span-4 bg-slate-900/40 p-5 overflow-y-auto space-y-5 text-xs">
            {/* Cited Passage Card */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>Cited Ground-Truth Passage</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyExcerpt}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy cited passage"
                >
                  {copiedExcerpt ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <blockquote
                className={`p-3 rounded-lg border text-xs font-serif leading-relaxed ${
                  isContradiction
                    ? "bg-rose-950/30 border-rose-800/60 text-rose-100"
                    : isSupporting
                    ? "bg-emerald-950/30 border-emerald-800/60 text-emerald-100"
                    : "bg-slate-950 border-slate-800 text-slate-200"
                }`}
              >
                &ldquo;{activeCitation?.evidenceExcerpt || "No passage available."}&rdquo;
              </blockquote>

              <p className="text-[11px] text-slate-400 italic">
                {isContradiction
                  ? "⚠ Clinical data contradicts the marketing assertion. Requires human review or documented policy override before approval."
                  : isSupporting
                  ? "✓ Exact clinical efficacy findings substantiate the factual claims in this marketing collateral."
                  : "Contextual background reference retrieved via hybrid vector similarity."}
              </p>
            </div>

            {/* Traceability Telemetry */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 shadow-lg space-y-3">
              <span className="font-bold text-white uppercase text-[10px] tracking-wider block border-b border-slate-800 pb-2">
                Traceability & Provenance
              </span>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Source Document:</span>
                  <span className="font-semibold text-white truncate max-w-[180px]">
                    {activeCitation?.documentTitle || "Clinical Dossier"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Type:</span>
                  <span className="font-mono text-cyan-300 capitalize">
                    {activeCitation?.documentType?.replace(/_/g, " ") || "clinical protocol"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Version:</span>
                  <span className="font-mono text-white">v{activeCitation?.versionNumber || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Source Page:</span>
                  <span className="font-mono text-violet-300 font-bold">
                    Page {activeCitation?.pageNumber || 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Section Reference:</span>
                  <span className="text-slate-200 truncate max-w-[160px]">
                    {activeCitation?.sectionReference || "Results"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Extraction Engine:</span>
                  <span className="font-mono text-emerald-300 uppercase text-[10px]">
                    {activeCitation?.extractionMethod || "digital_text"} ({(activeCitation?.extractionConfidence ? activeCitation.extractionConfidence * 100 : 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Validity:</span>
                  <span
                    className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                      activeCitation?.sourceValidity?.isCurrentlyValid
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        : "bg-rose-950 text-rose-300 border border-rose-800/60"
                    }`}
                  >
                    {activeCitation?.sourceValidity?.approvalStatus?.toUpperCase() || "APPROVED"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="w-full text-xs font-semibold"
              >
                Close Citation Viewer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders page text and highlights the exact cited passage if present on this page.
 */
function RenderHighlightedPage({
  pageText,
  targetExcerpt,
  stance,
  isTargetPage,
}: {
  pageText: string;
  targetExcerpt: string;
  stance: string;
  isTargetPage: boolean;
}) {
  const cleanTarget = targetExcerpt.trim();
  const cleanPage = pageText.trim();

  // If not the cited page or empty target, render normal page text
  if (!isTargetPage || !cleanTarget || !cleanPage.includes(cleanTarget)) {
    // If on target page but exact substring match failed due to whitespace/formatting, render fallback highlight callout
    if (isTargetPage && cleanTarget) {
      return (
        <div className="space-y-4">
          <div
            className={`p-3.5 rounded-xl border text-xs font-medium ${
              stance === "contradicting"
                ? "bg-rose-950/40 border-rose-700/80 text-rose-200"
                : "bg-emerald-950/40 border-emerald-700/80 text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1 text-[11px] uppercase tracking-wider">
              {stance === "contradicting" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Cited Ground-Truth Passage (Page 1)</span>
            </div>
            <p className="leading-relaxed">&ldquo;{cleanTarget}&rdquo;</p>
          </div>

          <p className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed">{cleanPage}</p>
        </div>
      );
    }

    return <p className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed">{cleanPage}</p>;
  }

  // Exact substring match
  const idx = cleanPage.indexOf(cleanTarget);
  const before = cleanPage.slice(0, idx);
  const after = cleanPage.slice(idx + cleanTarget.length);

  const highlightStyles =
    stance === "contradicting"
      ? "bg-rose-900/50 text-rose-100 border border-rose-500/80 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
      : "bg-emerald-900/50 text-emerald-100 border border-emerald-500/80 shadow-[0_0_12px_rgba(52,211,153,0.35)]";

  return (
    <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
      <span>{before}</span>
      <mark className={`px-2 py-1 rounded-lg font-semibold inline-block my-0.5 ${highlightStyles}`}>
        {cleanTarget}
      </mark>
      <span>{after}</span>
    </div>
  );
}
