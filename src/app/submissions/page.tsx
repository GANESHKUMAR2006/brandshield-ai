"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
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
import { formatDate } from "@/lib/utils/formatters";
import { AlertCircleIcon } from "@/components/ui/Icons";

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Marketing Submissions & Ingestion
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live PostgreSQL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track collateral submissions, revise content iterations with versioning, and inspect claims.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
            + New Ingestion
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Total Submissions</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {isLoading ? "..." : submissions.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Stored in PostgreSQL</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Draft Ingestions</div>
          <div className="text-2xl font-bold text-slate-700 mt-1">
            {isLoading ? "..." : submissions.filter((s) => s.status === "draft").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Editable work-in-progress</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">In Verification Queue</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">
            {isLoading
              ? "..."
              : submissions.filter(
                  (s) => s.status === "submitted" || s.status === "in_review" || s.status === "under_review"
                ).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting regulatory audit</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Approved Campaigns</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {isLoading ? "..." : submissions.filter((s) => s.status === "approved").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Signed off for publish</div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium overflow-x-auto">
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
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-white text-slate-900 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Submissions Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Active Submissions Ledger</CardTitle>
            <CardDescription>
              Live campaign records from PostgreSQL with version tracking and claim linkages
            </CardDescription>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {filteredSubmissions.length} Record(s)
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
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
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Campaign / Submission</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Version</th>
                    <th className="py-3 px-4">Claims Breakdown</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSubmissions.map((sub) => {
                    const isBenchmark =
                      sub.id.startsWith("00000000-0000-0000-0000-00000000010");

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 max-w-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 line-clamp-1">
                              {sub.title}
                            </span>
                            {isBenchmark && (
                              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 rounded shrink-0">
                                Benchmark
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>ID: {sub.id.substring(0, 8)}...</span>
                            {sub.product_name && (
                              <>
                                <span>·</span>
                                <span className="text-slate-600 truncate max-w-[140px]">
                                  {sub.product_name}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
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
                            <span className="font-semibold text-slate-900">
                              {sub.total_claims_count} claims
                            </span>
                            {sub.supported_claims_count > 0 && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className="text-emerald-700 font-medium">
                                  {sub.supported_claims_count} supported
                                </span>
                              </>
                            )}
                            {sub.review_claims_count > 0 && (
                              <>
                                <span className="text-slate-300">|</span>
                                <span className="text-amber-700 font-medium">
                                  {sub.review_claims_count} review
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
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
        </CardContent>
      </Card>

      {/* Create Submission Modal */}
      <CreateSubmissionModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={loadData}
        products={products}
      />

      {/* Submission Detail & Versioning Modal */}
      <SubmissionDetailModal
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
        onUpdated={loadData}
      />
    </AppLayout>
  );
}
