"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { WorkflowBanner } from "@/components/dashboard/WorkflowBanner";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import {
  CheckCircleIcon,
  FileCheckIcon,
  FolderGit2Icon,
  HistoryIcon,
} from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils/formatters";
import { DEMO_WORKSPACE } from "@/config/site";

interface DashboardStatsData {
  total_products: number;
  approved_facts: number;
  source_documents: number;
  total_submissions: number;
  draft_submissions: number;
  submitted_content: number;
  total_claims: number;
  supported_claims: number;
  review_claims: number;
}

interface RecentSubmissionItem {
  id: string;
  title: string;
  channel: string;
  status: string;
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
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [recentSubs, setRecentSubs] = useState<RecentSubmissionItem[]>([]);
  const [recentAudits, setRecentAudits] = useState<RecentAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/dashboard/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json) {
          setStats(json.stats);
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
              Claim Governance Overview
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live PostgreSQL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time evidence metrics and campaign submission monitoring for {DEMO_WORKSPACE.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/sources">
            <Button variant="outline" size="sm">
              Source Library
            </Button>
          </Link>
          <Link href="/submissions">
            <Button variant="primary" size="sm">
              + Ingest Submission
            </Button>
          </Link>
        </div>
      </div>

      {/* Row 1: Primary Pipeline Metrics */}
      <section aria-label="Key Governance Metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Submissions */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Submissions
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Live DB
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {isLoading ? "..." : stats?.total_submissions ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                {stats?.draft_submissions ?? 0} draft / {stats?.submitted_content ?? 0} active
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Marketing campaigns stored in PostgreSQL
            </p>
          </Card>

          {/* Metric 2: Total Claims */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Extracted Claims
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Live DB
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {isLoading ? "..." : stats?.total_claims ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700 border-slate-200">
                Across benchmark ads
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Assertions registered in Claim Ledger
            </p>
          </Card>

          {/* Metric 3: Supported Claims */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Supported Claims
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Live DB
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700 tracking-tight">
                {isLoading ? "..." : stats?.supported_claims ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                <CheckCircleIcon className="w-3.5 h-3.5" />
                Evidence Grounded
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Corroborated by clinical dossier facts
            </p>
          </Card>

          {/* Metric 4: Requires Review */}
          <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Requires Review / Flagged
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Live DB
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold text-amber-600 tracking-tight">
                {isLoading ? "..." : stats?.review_claims ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                Contradicted / Review
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Discrepancies flagged for human review
            </p>
          </Card>
        </div>
      </section>

      {/* Row 2: Secondary Ground Truth Vault Counters */}
      <section aria-label="Ground Truth Vault Counters">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Registered Products</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {isLoading ? "..." : stats?.total_products ?? 0} SKU
              </div>
              <div className="text-[11px] text-slate-400">DermaGlow Vitamin C Complex</div>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700">
              <FolderGit2Icon className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Approved Ground Truth Facts</div>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">
                {isLoading ? "..." : stats?.approved_facts ?? 0} Facts
              </div>
              <div className="text-[11px] text-slate-400">Concentration, MRP, Safety</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Clinical Source Dossiers</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {isLoading ? "..." : stats?.source_documents ?? 0} Studies
              </div>
              <div className="text-[11px] text-slate-400">Versioned & pgvector chunked</div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
              <FileCheckIcon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Architecture Pipeline */}
      <section aria-label="Claim Verification Workflow">
        <WorkflowBanner />
      </section>

      {/* Two Column Layout: Recent Live Submissions & Live Audit Trail */}
      <section aria-label="Recent Submissions and Audit Events">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Recent Submissions */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Recent Marketing Submissions</CardTitle>
                  <CardDescription>
                    Live campaign records from PostgreSQL (Benchmark fixtures + new ingestions)
                  </CardDescription>
                </div>
                <Link
                  href="/submissions"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  View All ({stats?.total_submissions ?? 0}) →
                </Link>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                        <th className="py-3 px-4 sm:px-6">Campaign</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Claims</th>
                        <th className="py-3 px-4 sm:px-6">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {recentSubs.map((sub) => {
                        const isBenchmark = sub.id.startsWith("00000000-0000-0000-0000-00000000010");

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 line-clamp-1">
                                  {sub.title}
                                </span>
                                {isBenchmark && (
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 rounded shrink-0">
                                    Benchmark
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                By {sub.submitted_by}
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
                            <td className="py-3.5 px-4 text-[11px]">
                              <span className="font-semibold text-slate-900">
                                {sub.total_claims} claims
                              </span>
                            </td>
                            <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">
                              {formatDate(sub.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Audit Trail */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>Live Audit Log</CardTitle>
                  <CardDescription>Append-only immutable event stream</CardDescription>
                </div>
                <Link
                  href="/audit"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Full Trail →
                </Link>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="divide-y divide-slate-100">
                  {recentAudits.map((event) => (
                    <div key={event.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                        <HistoryIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900 leading-tight">
                            {event.action.replace(/_/g, " ")}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatDate(event.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Entity: <strong className="text-slate-700">{event.entity_type}</strong> (ID: {event.entity_id.substring(0, 8)}...)
                        </p>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Actor: <span className="text-slate-600">{event.actor_id}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
