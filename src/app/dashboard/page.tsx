"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils/formatters";
import { ComplianceAnalyticsSummary, ComplianceInsight } from "@/types";
import { ComplianceWorkflow } from "@/components/dashboard/ComplianceWorkflow";
import { CreateSubmissionModal } from "@/components/submissions/CreateSubmissionModal";
import { LiveProduct, fetchSourcesData } from "@/lib/api-client";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";

interface RecentSubmissionItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  publication_status?: string;
  submitted_by: string;
  created_at: string;
  product_name: string | null;
  total_claims: number;
  supported_claims: number;
  review_required_claims: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<ComplianceAnalyticsSummary | null>(null);
  const [insights, setInsights] = useState<ComplianceInsight[]>([]);
  const [recentSubs, setRecentSubs] = useState<RecentSubmissionItem[]>([]);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Submission creation modal
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);

  const loadDashboardData = React.useCallback(() => {
    let isMounted = true;
    Promise.all([
      fetch("/api/dashboard/stats", { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetchSourcesData().catch(() => ({ products: [] })),
    ])
      .then(([statsJson, sourcesData]) => {
        if (!isMounted) return;
        if (statsJson) {
          if (statsJson.analytics) setAnalytics(statsJson.analytics);
          if (statsJson.insights) setInsights(statsJson.insights);
          setRecentSubs(statsJson.recentSubmissions || []);
        }
        if (sourcesData && "products" in sourcesData) {
          setProducts(sourcesData.products || []);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return loadDashboardData();
  }, [loadDashboardData]);

  // Derived KPI calculations from verified backend data
  const claimsAnalyzed = analytics?.totalExtractedClaims ?? (recentSubs.reduce((acc, s) => acc + s.total_claims, 0) || 0);
  const evidenceSupported = analytics?.claimsByVerificationStatus?.supported ?? (recentSubs.reduce((acc, s) => acc + s.supported_claims, 0) || 0);
  const contradictedClaims = analytics?.claimsByVerificationStatus?.contradicted ?? 0;
  const awaitingReview = analytics?.claimsAwaitingReview ?? 0;
  const publishedSubmissions = analytics?.publishedSubmissions ?? 0;

  return (
    <AppLayout>
      {/* 1. Header & Value Proposition */}
      <section aria-label="BrandShield Overview" className="space-y-4">
        {/* Clear Headline & Core Product Message */}
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/50 backdrop-blur-md p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl space-y-2.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                <span>AI-Powered Brand Governance</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Marketing claims. Verified before publication.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                Verify marketing content against approved product facts and evidence. Detect unsupported claims and prevent risky content from being published without human approval.
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Button
                variant="primary"
                size="lg"
                data-tour="check-content-btn"
                onClick={() => setIsCheckModalOpen(true)}
                className="shadow-lg shadow-violet-950/40 text-sm font-bold flex items-center justify-center gap-2 px-6 py-3 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Check Marketing Content</span>
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>or</span>
                <Link
                  href="/reviews"
                  data-tour="review-queue-link"
                  className="text-violet-400 hover:text-violet-300 font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Review Queue ({awaitingReview})</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Action Needed Banner (Conditional, non-intrusive) */}
      {(contradictedClaims > 0 || insights.some((i) => i.severity === "critical")) && (
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50 text-xs text-rose-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>Compliance Gate Active:</strong> {contradictedClaims} claim(s) contradict approved product facts. Publication is programmatically blocked pending review.
            </span>
          </div>
          <Link
            href="/reviews"
            className="text-xs font-semibold text-rose-200 hover:text-white underline underline-offset-2 flex items-center gap-1 shrink-0"
          >
            <span>Resolve in Review Queue</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 3. Five Meaningful KPI Cards */}
      <section aria-label="Five Key Compliance Metrics" data-tour="kpi-cards">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* KPI 1: Claims Analyzed */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold">Claims Analyzed</span>
                <div className="p-1.5 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-300 group-hover:text-cyan-400 transition-colors">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {isLoading ? "..." : claimsAnalyzed}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60">
                  Total
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Marketing assertions extracted from copy
            </p>
          </div>

          {/* KPI 2: Evidence Supported */}
          <div className="rounded-xl border border-emerald-900/40 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-emerald-700/50 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold text-emerald-400">Evidence Supported</span>
                <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 tracking-tight">
                  {isLoading ? "..." : evidenceSupported}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  Verified
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Backed by clinical trial & catalogue records
            </p>
          </div>

          {/* KPI 3: Contradicted Claims */}
          <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-rose-700/50 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold text-rose-400">Contradicted Claims</span>
                <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-300 tracking-tight">
                  {isLoading ? "..." : contradictedClaims}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60">
                  Conflicts
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Directly conflicting with approved evidence
            </p>
          </div>

          {/* KPI 4: Awaiting Human Review */}
          <div className="rounded-xl border border-amber-900/40 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-amber-700/50 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold text-amber-400">Awaiting Human Review</span>
                <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight">
                  {isLoading ? "..." : awaitingReview}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  Queue Active
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Pending compliance or legal determination
            </p>
          </div>

          {/* KPI 5: Published Submissions */}
          <div className="rounded-xl border border-violet-900/40 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-violet-700/50 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider font-bold text-violet-300">Published Submissions</span>
                <div className="p-1.5 rounded-lg bg-violet-950/60 border border-violet-800/60 text-violet-400">
                  <FileCheck2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-violet-200 tracking-tight">
                  {isLoading ? "..." : publishedSubmissions}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60">
                  Gate Cleared
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Submissions cleared by publication gate
            </p>
          </div>
        </div>
      </section>

      {/* 4. Five-Step Compliance Workflow */}
      <section aria-label="Governance Workflow" data-tour="governance-workflow">
        <ComplianceWorkflow />
      </section>

      {/* 5. Recent Marketing Submissions Table */}
      <section aria-label="Recent Marketing Submissions" data-tour="recent-submissions">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 sm:p-6 shadow-xl">
          <div className="pb-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Recent Marketing Submissions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Creative assets undergoing automated claim extraction and evidence reconciliation.
              </p>
            </div>
            <Link
              href="/submissions"
              className="text-xs text-violet-400 font-semibold hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              <span>Explore All Submissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="pt-3">
            {recentSubs.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No marketing submissions recorded yet. Click &ldquo;Check Marketing Content&rdquo; above to verify your first campaign copy.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-3">Campaign / Asset</th>
                      <th className="py-3 px-3">Channel</th>
                      <th className="py-3 px-3">Claims Breakdown</th>
                      <th className="py-3 px-3">Gate Status</th>
                      <th className="py-3 px-3">Submitted</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {recentSubs.map((sub) => {
                      const isPublished = sub.status === "published" || sub.publication_status === "published";
                      const isApproved = sub.status === "approved";
                      const isBlocked = sub.publication_status === "ineligible" || sub.review_required_claims > 0;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-3 min-w-[200px]">
                            <Link
                              href="/submissions"
                              className="font-semibold text-white hover:text-violet-300 transition-colors line-clamp-1 block"
                            >
                              {sub.title}
                            </Link>
                            {sub.product_name && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Product: <span className="text-slate-300">{sub.product_name}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium text-[10px] capitalize">
                              {sub.channel}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-white">{sub.total_claims} claims</span>
                              <span className="text-slate-600">•</span>
                              <span className="text-emerald-400 font-medium">{sub.supported_claims} supported</span>
                              {sub.review_required_claims > 0 && (
                                <>
                                  <span className="text-slate-600">•</span>
                                  <span className="text-amber-400 font-medium">{sub.review_required_claims} review</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isPublished
                                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/80"
                                  : isApproved
                                  ? "bg-violet-950/80 text-violet-300 border-violet-800/80"
                                  : isBlocked
                                  ? "bg-rose-950/80 text-rose-300 border-rose-800/80"
                                  : "bg-amber-950/80 text-amber-300 border-amber-800/80"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isPublished
                                    ? "bg-emerald-400"
                                    : isApproved
                                    ? "bg-violet-400"
                                    : isBlocked
                                    ? "bg-rose-400"
                                    : "bg-amber-400"
                                }`}
                              />
                              {isPublished
                                ? "PUBLISHED"
                                : isApproved
                                ? "APPROVED"
                                : isBlocked
                                ? "GATE BLOCKED"
                                : "IN REVIEW"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-slate-400 text-[11px] font-mono whitespace-nowrap">
                            {formatDateTime(sub.created_at)}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <Link
                              href="/claims"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-medium cursor-pointer"
                              title="Inspect Claims in Ledger"
                            >
                              <span>Inspect</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
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
      </section>

      {/* Submission Creation Modal (Check Marketing Content) */}
      <CreateSubmissionModal
        isOpen={isCheckModalOpen}
        onClose={() => setIsCheckModalOpen(false)}
        onSuccess={() => {
          setIsCheckModalOpen(false);
          router.push("/submissions");
        }}
        products={products}
      />
    </AppLayout>
  );
}
