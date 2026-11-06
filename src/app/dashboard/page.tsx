"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CheckCircleIcon,
  HistoryIcon,
  ShieldAlertIcon,
} from "@/components/ui/Icons";
import { formatDateTime } from "@/lib/utils/formatters";
import { DEMO_WORKSPACE } from "@/config/site";
import { ComplianceAnalyticsSummary, ComplianceInsight } from "@/types";

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

interface RecentAuditItem {
  id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<ComplianceAnalyticsSummary | null>(null);
  const [insights, setInsights] = useState<ComplianceInsight[]>([]);
  const [recentSubs, setRecentSubs] = useState<RecentSubmissionItem[]>([]);
  const [recentAudits, setRecentAudits] = useState<RecentAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/dashboard/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json) {
          if (json.analytics) {
            setAnalytics(json.analytics);
          }
          if (json.insights) {
            setInsights(json.insights);
          }
          setRecentSubs(json.recentSubmissions || []);
          setRecentAudits(json.recentAuditEvents || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AppLayout>
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Administrative & Compliance Intelligence
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live Verified DB
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Operational governance, defensible compliance ratios, and risk indicators for {DEMO_WORKSPACE.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/sources">
            <Button variant="outline" size="sm">
              Source Library
            </Button>
          </Link>
          <Link href="/reviews">
            <Button variant="outline" size="sm">
              Review Queue
            </Button>
          </Link>
          <Link href="/submissions">
            <Button variant="primary" size="sm">
              + Ingest Submission
            </Button>
          </Link>
        </div>
      </div>

      {/* Row 1: Primary Governance Health Cards */}
      <section aria-label="Key Governance Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Approval Ratio */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Review Approval Rate
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Formula: approved/decided
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 tracking-tight">
                {isLoading ? "..." : `${analytics?.approvalRate ?? 0}%`}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                {analytics?.claimsByReviewStatus.approved ?? 0} approved / {analytics?.totalDecidedClaims ?? 0} decided
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Rejection: {analytics?.rejectionRate ?? 0}% | Mod: {analytics?.modificationRate ?? 0}%
            </p>
          </Card>

          {/* Card 2: Evidence Coverage */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Evidence Coverage
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                RAG Grounded
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-cyan-700 tracking-tight">
                {isLoading ? "..." : `${analytics?.evidenceCoveragePercentage ?? 0}%`}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-cyan-50 text-cyan-800 border-cyan-200">
                Active claims with citations
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Missing evidence treated as unverified, never contradiction
            </p>
          </Card>

          {/* Card 3: Review Workload */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Claims Awaiting Review
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Active Queue
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-amber-700 tracking-tight">
                {isLoading ? "..." : analytics?.claimsAwaitingReview ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                {analytics?.claimsByRiskLevel.high ?? 0} high / {analytics?.claimsByRiskLevel.critical ?? 0} critical
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Avg turnaround: {analytics?.averageReviewTurnaroundHours ?? 0} hrs
            </p>
          </Card>

          {/* Card 4: Publication Gate */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Submissions Published
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                Gate Invariant
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-indigo-700 tracking-tight">
                {isLoading ? "..." : analytics?.publishedSubmissions ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200">
                {analytics?.totalSubmissions ?? 0} Total Campaigns
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {analytics?.publicationBlockedSubmissions ?? 0} publication-blocked (pending approval)
            </p>
          </Card>
        </div>
      </section>

      {/* Row 2: Operational Risk & Compliance Insights Panel */}
      <section aria-label="Risk & Compliance Operational Insights">
        <Card className="border-amber-200/80 bg-gradient-to-r from-amber-50/40 via-white to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlertIcon className="w-5 h-5 text-amber-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  Operational Risk & Compliance Signals
                </CardTitle>
              </div>
              <span className="text-[11px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded font-medium">
                Indicators for human investigation — not automated legal conclusions
              </span>
            </div>
            <CardDescription className="text-xs">
              Algorithmic detection of high-risk bottlenecks, expiring source studies, and low-coverage products.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Evaluating operational risk signals...</div>
            ) : insights.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All operational signals normal: No high-risk review bottlenecks or expiring dossiers detected.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ins.severity === "critical"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : ins.severity === "high"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {ins.severity} priority
                        </span>
                        <span className="text-[11px] font-medium text-slate-500">
                          {ins.metricContext}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mt-2">
                        {ins.title}
                      </h4>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                        {ins.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1">
                      <strong className="text-slate-700 shrink-0">Action:</strong>
                      <span>{ins.suggestedInvestigation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Row 3: Verification & Risk Breakdown Panels */}
      <section aria-label="Status Distribution Breakdown">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel 1: Verification Status Distribution */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Active Claims by Verification Status
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Grounding state against approved clinical facts and dossiers.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 font-medium">Supported (Grounded)</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByVerificationStatus.supported ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByVerificationStatus.supported / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-rose-700 font-medium">Contradicted (Discrepancy)</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByVerificationStatus.contradicted ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByVerificationStatus.contradicted / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-amber-700 font-medium">Needs Review</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByVerificationStatus.needs_review ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByVerificationStatus.needs_review / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500 font-medium">Unverified (Missing Evidence)</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByVerificationStatus.unverified ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByVerificationStatus.unverified / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Panel 2: Risk Profile Distribution */}
          <Card className="p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Active Claims by Risk Level
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Regulatory and consumer protection risk scoring.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-rose-700 font-medium">Critical Risk</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByRiskLevel.critical ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-600 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByRiskLevel.critical / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-amber-700 font-medium">High Risk</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByRiskLevel.high ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByRiskLevel.high / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-blue-700 font-medium">Medium Risk</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByRiskLevel.medium ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByRiskLevel.medium / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-600 font-medium">Low Risk</span>
                <span className="font-bold text-slate-900">{analytics?.claimsByRiskLevel.low ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-slate-400 h-full rounded-full"
                  style={{
                    width: `${
                      analytics?.activeClaims
                        ? (analytics.claimsByRiskLevel.low / analytics.activeClaims) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Panel 3: Source Documents & Claim Lineage */}
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">
                Source Document Validity & Lineage
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Clinical validity horizon and claim modification tracking.
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-slate-700">Approved Studies in Library</div>
                    <div className="text-[11px] text-slate-400">pgvector chunked & indexed</div>
                  </div>
                  <span className="text-base font-bold text-slate-900">
                    {analytics?.sourceDocumentMetrics.totalApproved ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-amber-900">Expiring in &lt;30 Days</div>
                    <div className="text-[11px] text-amber-700">Renewal required</div>
                  </div>
                  <span className="text-base font-bold text-amber-900">
                    {analytics?.sourceDocumentMetrics.expiringSoonCount ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-slate-700">Claim Modification Lineage</div>
                    <div className="text-[11px] text-slate-400">Superseded historical claims</div>
                  </div>
                  <span className="text-base font-bold text-indigo-700">
                    {analytics?.supersededClaims ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-400">Immutable Lineage</span>
              <Link href="/audit" className="text-indigo-600 font-semibold hover:underline">
                View Audit Trail →
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Row 4: Recent Submissions & Recent Live Audit Stream */}
      <section aria-label="Recent Campaigns and Audit Stream">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Submissions */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Recent Campaign Submissions</CardTitle>
                <CardDescription className="text-xs">
                  Latest creative assets submitted for automated verification and review.
                </CardDescription>
              </div>
              <Link href="/submissions" className="text-xs text-indigo-600 font-semibold hover:underline">
                View all →
              </Link>
            </CardHeader>

            <CardContent>
              {recentSubs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No submissions recorded.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {recentSubs.map((sub) => (
                    <div key={sub.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 truncate">{sub.title}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{sub.channel}</span>
                          <span>•</span>
                          <span>{sub.total_claims} claims ({sub.supported_claims} supported)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          sub.status === "published"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : sub.status === "approved"
                            ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          {sub.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Events */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Recent Audit Stream</CardTitle>
                <CardDescription className="text-xs">
                  Real-time append-only governance ledger events.
                </CardDescription>
              </div>
              <Link href="/audit" className="text-xs text-indigo-600 font-semibold hover:underline">
                Full Audit Trail →
              </Link>
            </CardHeader>

            <CardContent>
              {recentAudits.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No audit events recorded.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {recentAudits.map((ae) => (
                    <div key={ae.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                        <HistoryIcon className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <strong className="text-slate-800 capitalize">{ae.action.replace(/_/g, " ")}</strong>
                          <span className="text-[10px] text-slate-400">{formatDateTime(ae.created_at)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Actor: <span className="font-semibold text-slate-700">{ae.actor_id}</span> • Entity: <span className="capitalize">{ae.entity_type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppLayout>
  );
}
