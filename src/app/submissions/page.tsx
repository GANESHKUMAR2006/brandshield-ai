"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import {
  fetchSubmissions,
  fetchSourcesData,
  LiveSubmission,
  LiveProduct,
} from "@/lib/api-client";
import { CreateSubmissionModal } from "@/components/submissions/CreateSubmissionModal";
import { SubmissionDetailModal } from "@/components/submissions/SubmissionDetailModal";
import { GuidedDemoModal } from "@/components/demo/GuidedDemoModal";
import { PresenterViewModal } from "@/components/demo/PresenterViewModal";
import { formatDate } from "@/lib/utils/formatters";
import {
  FileText,
  Sparkles,
  RefreshCw,
  Search,
  AlertTriangle,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<LiveSubmission[]>([]);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [presenterModalOpen, setPresenterModalOpen] = useState(false);
  const [presetIndex, setPresetIndex] = useState<number | null>(null);

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [subs, sources] = await Promise.all([
        fetchSubmissions(),
        fetchSourcesData().catch(() => ({ products: [] })),
      ]);
      setSubmissions(subs);
      if ("products" in sources) {
        setProducts(sources.products);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchSubmissions(),
      fetchSourcesData().catch(() => ({ products: [] })),
    ])
      .then(([subs, sources]) => {
        if (isMounted) {
          setSubmissions(subs);
          if ("products" in sources) {
            setProducts(sources.products);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load submissions");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const searchQ = searchQuery.trim().toLowerCase();
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesStatus =
      statusFilter === "all" ||
      sub.status === statusFilter ||
      (statusFilter === "in_review" && (sub.status === "in_review" || sub.status === "under_review"));
    const matchesSearch =
      !searchQ ||
      sub.title.toLowerCase().includes(searchQ) ||
      sub.channel.toLowerCase().includes(searchQ) ||
      (sub.product_name && sub.product_name.toLowerCase().includes(searchQ));
    return matchesStatus && matchesSearch;
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Marketing Submissions & Ingestion
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]">
              Live PostgreSQL 17
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track collateral submissions, revise content iterations with versioning, and inspect claims.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPresenterModalOpen(true)}
            className="border-violet-800/60 text-violet-300 hover:bg-violet-950/40"
          >
            Presenter View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGuideModalOpen(true)}
            className="border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/40"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Guided Tour
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            + New Ingestion
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Submissions</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : submissions.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Stored in PostgreSQL</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Draft Ingestions</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : submissions.filter((s) => s.status === "draft").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Work-in-progress</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">In Verification Queue</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">
            {isLoading
              ? "..."
              : submissions.filter(
                  (s) => s.status === "submitted" || s.status === "in_review" || s.status === "under_review"
                ).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting regulatory audit</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Approved Campaigns</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : submissions.filter((s) => s.status === "approved" || s.status === "published").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Signed off for publish</div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto shadow-inner">
          {[
            { id: "all", label: "All Submissions" },
            { id: "draft", label: "Drafts" },
            { id: "in_review", label: "In Review" },
            { id: "approved", label: "Approved" },
            { id: "changes_requested", label: "Changes Requested" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
                statusFilter === tab.id
                  ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
          />
        </div>
      </div>

      {/* Submissions Table Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Active Submissions Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live campaign records from PostgreSQL with version tracking and claim linkages.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
            {filteredSubmissions.length} Record(s)
          </span>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading submissions from database...
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No submissions matching current criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Campaign / Submission</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Claims Breakdown</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredSubmissions.map((sub) => {
                    const isBenchmark = sub.id.startsWith("00000000-0000-0000-0000-00000000010");

                    return (
                      <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 max-w-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white line-clamp-1">
                              {sub.title}
                            </span>
                            {isBenchmark && (
                              <span className="text-[10px] font-semibold text-violet-300 bg-violet-950/80 border border-violet-800/60 px-1.5 rounded shrink-0">
                                Benchmark
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>ID: {sub.id.substring(0, 8)}...</span>
                            {sub.product_name && (
                              <>
                                <span>·</span>
                                <span className="text-slate-300 truncate max-w-[140px]">
                                  {sub.product_name}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium text-[11px]">
                            {sub.channel}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusPill status={sub.status} />
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant="indigo" size="sm">
                            v{sub.current_version_number} ({sub.total_versions_count} rev)
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-semibold text-white">
                              {sub.total_claims_count} claims
                            </span>
                            {sub.supported_claims_count > 0 && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="text-emerald-400 font-medium">
                                  {sub.supported_claims_count} supported
                                </span>
                              </>
                            )}
                            {sub.review_claims_count > 0 && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="text-amber-400 font-medium">
                                  {sub.review_claims_count} review
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(sub.submission_date || sub.created_at)}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSubmissionId(sub.id)}
                          >
                            Inspect & Revise
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Submission Modal */}
      <CreateSubmissionModal
        key={`${createModalOpen}-${presetIndex ?? "none"}`}
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setPresetIndex(null);
        }}
        onSuccess={loadData}
        products={products}
        initialPresetIndex={presetIndex}
      />

      {/* Submission Detail & Versioning Modal */}
      <SubmissionDetailModal
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
        onUpdated={loadData}
      />
      {/* Guided Demo Walkthrough Modal */}
      <GuidedDemoModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        onSelectPreset={() => {
          setGuideModalOpen(false);
          setCreateModalOpen(true);
        }}
      />
      {/* Presenter View Modal */}
      <PresenterViewModal
        isOpen={presenterModalOpen}
        onClose={() => setPresenterModalOpen(false)}
        onLoadScenario={(idx) => {
          setPresetIndex(idx);
          setCreateModalOpen(true);
        }}
      />
    </AppLayout>
  );
}
