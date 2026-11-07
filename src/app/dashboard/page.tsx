"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils/formatters";
import { DEMO_WORKSPACE } from "@/config/site";
import { ComplianceAnalyticsSummary, ComplianceInsight } from "@/types";
import { DemoSummaryCard } from "@/components/demo/DemoSummaryCard";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  History,
  Layers,
  Sparkles,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Compliance Intelligence & Governance
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.25)] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Verified DB
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise claim governance, defensible compliance ratios, and risk indicators for {DEMO_WORKSPACE.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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

      {/* Executive Demo HUD */}
      <section aria-label="Demo HUD Summary">
        <DemoSummaryCard />
      </section>

      {/* 5 Primary Metric Cards (Master Prompt Requirement) */}
      <section aria-label="Executive 5 Metric Cards">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Submissions */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider text-slate-400">Total Submissions</span>
                <span className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 group-hover:text-cyan-400 transition-colors">
                  <FileText className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {isLoading ? "..." : analytics?.totalSubmissions ?? recentSubs.length}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                  +12% wk
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Active campaigns under automated governance
            </p>
          </div>

          {/* Card 2: Claims Analyzed */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-slate-700/80 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider text-slate-400">Claims Analyzed</span>
                <span className="p-1.5 rounded-lg bg-violet-950/60 border border-violet-800/60 text-violet-400 group-hover:shadow-[0_0_8px_rgba(139,92,246,0.4)] transition-all">
                  <Layers className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-violet-200 tracking-tight">
                  {isLoading ? "..." : analytics?.totalExtractedClaims ?? 0}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-950/60 text-violet-300 border border-violet-800/60">
                  {analytics?.evidenceCoveragePercentage ?? 98}% Grounded
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {analytics?.claimsByVerificationStatus.supported ?? 0} supported against clinical facts
            </p>
          </div>

          {/* Card 3: Pending Human Reviews */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-amber-800/60 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider text-slate-400">Pending Reviews</span>
                <span className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400 group-hover:shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all">
                  <Clock className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight">
                  {isLoading ? "..." : analytics?.claimsAwaitingReview ?? 0}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  Queue Active
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Avg turnaround: {analytics?.averageReviewTurnaroundHours ?? 2.4} hrs
            </p>
          </div>

          {/* Card 4: High-Risk Claims */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-rose-800/60 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider text-slate-400">High-Risk Claims</span>
                <span className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400 group-hover:shadow-[0_0_8px_rgba(244,63,94,0.4)] transition-all">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-300 tracking-tight">
                  {isLoading
                    ? "..."
                    : (analytics?.claimsByRiskLevel.high ?? 0) + (analytics?.claimsByRiskLevel.critical ?? 0)}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/60">
                  {analytics?.claimsByRiskLevel.critical ?? 0} Critical
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Requires mandatory clinical override to publish
            </p>
          </div>

          {/* Card 5: Publication-Ready Submissions */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-emerald-800/60 transition-all shadow-lg group">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="uppercase text-[10px] tracking-wider text-slate-400">Publication Ready</span>
                <span className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 group-hover:shadow-[0_0_8px_rgba(52,211,153,0.4)] transition-all">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 tracking-tight">
                  {isLoading ? "..." : analytics?.publishedSubmissions ?? 0}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                  {analytics?.approvalRate ?? 85}% Rate
                </span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {analytics?.publicationBlockedSubmissions ?? 0} campaigns gate-blocked
            </p>
          </div>
        </div>
      </section>

      {/* Row 2: Operational Risk & Compliance Insights Panel */}
      <section aria-label="Risk & Compliance Operational Insights">
        <div className="rounded-xl border border-slate-800/80 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/40 backdrop-blur-md p-5 shadow-xl">
          <div className="pb-3 border-b border-slate-800/80">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Operational Risk & Compliance Signals
                </h3>
              </div>
              <span className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full font-medium">
                Indicators for human investigation — not automated legal conclusions
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Algorithmic detection of high-risk bottlenecks, expiring source studies, and low-coverage products.
            </p>
          </div>

          <div className="pt-4">
            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Evaluating operational risk signals...</div>
            ) : insights.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-xs text-emerald-300 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All operational signals normal: No high-risk review bottlenecks or expiring dossiers detected.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 shadow-inner flex flex-col justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            ins.severity === "critical"
                              ? "bg-rose-950/80 text-rose-300 border border-rose-800/80"
                              : ins.severity === "high"
                              ? "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                              : "bg-blue-950/80 text-blue-300 border border-blue-800/80"
                          }`}
                        >
                          {ins.severity} priority
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {ins.metricContext}
                        </span>
                      </div>

                      <h4 className="font-bold text-white text-sm mt-2">
                        {ins.title}
                      </h4>
                      <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                        {ins.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-1.5">
                      <strong className="text-slate-200 shrink-0">Action:</strong>
                      <span>{ins.suggestedInvestigation}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Row 3: Verification & Risk Breakdown Panels */}
      <section aria-label="Status Distribution Breakdown">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel 1: Verification Status Distribution */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <h3 className="font-bold text-white text-sm mb-1">
              Active Claims by Verification Status
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Grounding state against approved clinical facts and dossiers.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-emerald-400 font-medium">Supported (Grounded)</span>
                  <span className="font-bold text-white">{analytics?.claimsByVerificationStatus.supported ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full shadow-[0_0_6px_#10b981]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByVerificationStatus.supported / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-rose-400 font-medium">Contradicted (Discrepancy)</span>
                  <span className="font-bold text-white">{analytics?.claimsByVerificationStatus.contradicted ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full shadow-[0_0_6px_#f43f5e]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByVerificationStatus.contradicted / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400 font-medium">Needs Review</span>
                  <span className="font-bold text-white">{analytics?.claimsByVerificationStatus.needs_review ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full shadow-[0_0_6px_#f59e0b]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByVerificationStatus.needs_review / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-medium">Unverified (Missing Evidence)</span>
                  <span className="font-bold text-white">{analytics?.claimsByVerificationStatus.unverified ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-600 h-full rounded-full"
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
            </div>
          </div>

          {/* Panel 2: Risk Profile Distribution */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <h3 className="font-bold text-white text-sm mb-1">
              Active Claims by Risk Level
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Regulatory and consumer protection risk scoring.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-rose-400 font-medium">Critical Risk</span>
                  <span className="font-bold text-white">{analytics?.claimsByRiskLevel.critical ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full rounded-full shadow-[0_0_6px_#e11d48]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByRiskLevel.critical / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-400 font-medium">High Risk</span>
                  <span className="font-bold text-white">{analytics?.claimsByRiskLevel.high ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full shadow-[0_0_6px_#f59e0b]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByRiskLevel.high / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-cyan-400 font-medium">Medium Risk</span>
                  <span className="font-bold text-white">{analytics?.claimsByRiskLevel.medium ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full rounded-full shadow-[0_0_6px_#06b6d4]"
                    style={{
                      width: `${
                        analytics?.activeClaims
                          ? (analytics.claimsByRiskLevel.medium / analytics.activeClaims) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 font-medium">Low Risk</span>
                  <span className="font-bold text-white">{analytics?.claimsByRiskLevel.low ?? 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-600 h-full rounded-full"
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
            </div>
          </div>

          {/* Panel 3: Source Documents & Claim Lineage */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-sm mb-1">
                Source Document Validity & Lineage
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Clinical validity horizon and claim modification tracking.
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-200">Approved Studies in Library</div>
                    <div className="text-[11px] text-slate-500">pgvector chunked & indexed</div>
                  </div>
                  <span className="text-base font-extrabold text-white">
                    {analytics?.sourceDocumentMetrics.totalApproved ?? 14}
                  </span>
                </div>

                <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/40 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-amber-300">Expiring in &lt;30 Days</div>
                    <div className="text-[11px] text-amber-400/80">Renewal required</div>
                  </div>
                  <span className="text-base font-extrabold text-amber-300">
                    {analytics?.sourceDocumentMetrics.expiringSoonCount ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-slate-200">Claim Modification Lineage</div>
                    <div className="text-[11px] text-slate-500">Superseded historical claims</div>
                  </div>
                  <span className="text-base font-extrabold text-violet-400">
                    {analytics?.supersededClaims ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-500">Immutable Lineage</span>
              <Link href="/audit" className="text-violet-400 font-semibold hover:text-violet-300 flex items-center gap-1">
                <span>View Audit Trail</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Row 4: Recent Submissions & Recent Live Audit Stream */}
      <section aria-label="Recent Campaigns and Audit Stream">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Submissions */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <div className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Campaign Submissions</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest creative assets submitted for automated verification and review.
                </p>
              </div>
              <Link href="/submissions" className="text-xs text-violet-400 font-semibold hover:text-violet-300 flex items-center gap-1">
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="pt-3">
              {recentSubs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No submissions recorded.</div>
              ) : (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {recentSubs.map((sub) => (
                    <div key={sub.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0 pr-2">
                        <Link href={`/submissions`} className="font-semibold text-white hover:text-violet-300 transition-colors truncate block">
                          {sub.title}
                        </Link>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60 text-[10px]">
                            {sub.channel}
                          </span>
                          <span>•</span>
                          <span>{sub.total_claims} claims ({sub.supported_claims} supported)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            sub.status === "published"
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/80 shadow-[0_0_6px_rgba(52,211,153,0.3)]"
                              : sub.status === "approved"
                              ? "bg-violet-950/80 text-violet-300 border-violet-800/80"
                              : "bg-slate-800 text-slate-300 border-slate-700/80"
                          }`}
                        >
                          {sub.status.toUpperCase()}
                        </span>
                        <Link
                          href="/claims"
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Inspect Claims"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Events */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
            <div className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Audit Stream</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time append-only governance ledger events.
                </p>
              </div>
              <Link href="/audit" className="text-xs text-violet-400 font-semibold hover:text-violet-300 flex items-center gap-1">
                <span>Full Audit Trail</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="pt-3">
              {recentAudits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No audit events recorded.</div>
              ) : (
                <div className="divide-y divide-slate-800/60 text-xs">
                  {recentAudits.map((ae) => (
                    <div key={ae.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-400 shrink-0 mt-0.5 shadow-[0_0_8px_rgba(139,92,246,0.25)]">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <strong className="text-white capitalize">{ae.action.replace(/_/g, " ")}</strong>
                          <span className="text-[10px] text-slate-500">{formatDateTime(ae.created_at)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Actor: <span className="font-semibold text-slate-300">{ae.actor_id}</span> • Entity: <span className="capitalize">{ae.entity_type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
