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
import { formatDate } from "@/lib/utils/formatters";
import {
  FileText,
  Sparkles,
  RefreshCw,
  Search,
  AlertTriangle,
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Marketing Submissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Submit campaign collateral, track automated claim extractions, and inspect verification outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Check Marketing Content</span>
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
          <div className="text-[11px] text-slate-400 mt-1">All campaigns recorded</div>
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
          <div className="text-[11px] text-slate-400 mt-1">Awaiting compliance review</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Approved Campaigns</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : submissions.filter((s) => s.status === "approved" || s.status === "published").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Cleared for publication</div>
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

      {/* Submissions List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading submissions...
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-800/80 bg-slate-900/40 text-slate-400 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-white">No submissions found</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "No submissions matched your search or status filter. Try resetting filters."
                : "Get started by submitting marketing content to extract and verify claims against approved evidence."}
            </p>
            <Button variant="primary" size="sm" onClick={() => setCreateModalOpen(true)}>
              + Check Marketing Content
            </Button>
          </div>
        ) : (
          filteredSubmissions.map((sub) => {
            const isPublished = sub.status === "published";
            const isApproved = sub.status === "approved";
            const isBlocked = sub.review_claims_count > 0;

            return (
              <div
                key={sub.id}
                onClick={() => setSelectedSubmissionId(sub.id)}
                className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md hover:border-violet-500/50 hover:bg-slate-900/80 transition-all cursor-pointer shadow-lg group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                        {sub.title}
                      </h3>
                      <StatusPill status={sub.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      {sub.product_name && (
                        <span>
                          Product: <strong className="text-slate-300">{sub.product_name}</strong>
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        Channel: <Badge variant="outline">{sub.channel}</Badge>
                      </span>
                      <span>•</span>
                      <span>Submitted: {formatDate(sub.created_at)}</span>
                      <span>•</span>
                      <span>By: {sub.submitted_by}</span>
                    </div>

                    {sub.content && (
                      <p className="text-xs text-slate-400 line-clamp-2 pt-1 font-normal italic">
                        &ldquo;{sub.content}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-center px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                        <div className="font-extrabold text-white text-sm">{sub.total_claims_count}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Claims</div>
                      </div>
                      <div className="text-center px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40">
                        <div className="font-extrabold text-emerald-300 text-sm">{sub.supported_claims_count}</div>
                        <div className="text-[10px] text-emerald-400 uppercase font-semibold">Supported</div>
                      </div>
                      <div className="text-center px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/40">
                        <div className="font-extrabold text-amber-300 text-sm">{sub.review_claims_count}</div>
                        <div className="text-[10px] text-amber-400 uppercase font-semibold">Review</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-violet-400 font-semibold group-hover:text-violet-300 flex items-center gap-1">
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Submission Creation Modal */}
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
