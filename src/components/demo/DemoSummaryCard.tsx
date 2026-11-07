"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FileCheckIcon, SparklesIcon } from "@/components/ui/Icons";
import { GuidedDemoModal } from "./GuidedDemoModal";

interface DemoSummaryData {
  totalSubmissions: number;
  publishedSubmissions: number;
  blockedSubmissions: number;
  totalClaims: number;
  activeClaims: number;
  supportedClaims: number;
  contradictedClaims: number;
  needsReviewClaims: number;
  approvedClaims: number;
  pendingClaims: number;
  engineProvider: string;
  engineModel: string;
}

export function DemoSummaryCard() {
  const [data, setData] = useState<DemoSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/dashboard/stats", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!isMounted || !json) return;
        const a = json.analytics;
        setData({
          totalSubmissions: a?.totalSubmissions ?? (json.recentSubmissions?.length || 0),
          publishedSubmissions: a?.publishedSubmissions ?? 0,
          blockedSubmissions: a?.publicationBlockedSubmissions ?? 0,
          totalClaims: a?.totalExtractedClaims ?? 0,
          activeClaims: a?.activeClaims ?? 0,
          supportedClaims: a?.claimsByVerificationStatus?.supported ?? 0,
          contradictedClaims: a?.claimsByVerificationStatus?.contradicted ?? 0,
          needsReviewClaims: (a?.claimsByVerificationStatus?.needs_review ?? 0) + (a?.claimsByVerificationStatus?.outdated ?? 0),
          approvedClaims: a?.claimsByReviewStatus?.approved ?? 0,
          pendingClaims: a?.claimsAwaitingReview ?? 0,
          engineProvider: "Ollama (Local LLM)",
          engineModel: "qwen3:4b",
        });
        setIsLoading(false);
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-950/60 border border-violet-800/50 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.2)]">
              <FileCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Compliance Intelligence HUD
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic governance, AI extraction accuracy, and publication gate status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideModalOpen(true)}
              className="text-xs"
            >
              <SparklesIcon className="w-3.5 h-3.5 mr-1 text-cyan-400" />
              Demo Walkthrough Tour
            </Button>
            <Link href="/submissions">
              <Button variant="primary" size="sm" className="text-xs">
                + New Ingestion
              </Button>
            </Link>
          </div>
        </div>

        {/* 5-Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {/* 1. Submissions */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Ingested
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              {isLoading ? "..." : data?.totalSubmissions ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {data?.publishedSubmissions ?? 0} published
            </div>
          </div>

          {/* 2. Claims Extracted */}
          <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-800/40 hover:border-violet-700/60 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
              Extracted Claims
            </div>
            <div className="text-2xl font-bold text-violet-200 mt-1">
              {isLoading ? "..." : data?.totalClaims ?? 0}
            </div>
            <div className="text-[11px] text-violet-400/90 mt-0.5">
              {data?.activeClaims ?? 0} active in governance
            </div>
          </div>

          {/* 3. Verification Supported */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 hover:border-emerald-700/60 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Supported Claims
            </div>
            <div className="text-2xl font-bold text-emerald-200 mt-1">
              {isLoading ? "..." : data?.supportedClaims ?? 0}
            </div>
            <div className="text-[11px] text-emerald-400/90 mt-0.5">
              Backed by approved facts
            </div>
          </div>

          {/* 4. Contradictions & Risks */}
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 hover:border-rose-700/60 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
              Contradictions & Risks
            </div>
            <div className="text-2xl font-bold text-rose-200 mt-1">
              {isLoading ? "..." : (data?.contradictedClaims ?? 0) + (data?.needsReviewClaims ?? 0)}
            </div>
            <div className="text-[11px] text-rose-400/90 mt-0.5">
              {data?.contradictedClaims ?? 0} direct contradictions
            </div>
          </div>

          {/* 5. Publication Gate */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-slate-600 transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gate Invariant
            </div>
            <div className="text-2xl font-bold text-white mt-1 flex items-center gap-1.5">
              {data && data.blockedSubmissions === 0 && data.totalSubmissions > 0 ? (
                <span className="text-emerald-400 text-lg sm:text-xl font-bold">ALL CLEAR</span>
              ) : (
                <span className="text-amber-400 text-lg sm:text-xl font-bold">
                  {data?.blockedSubmissions ?? 0} BLOCKED
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Requires 100% human sign-off
            </div>
          </div>
        </div>

        {/* Engine Footprint Status */}
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span>Database: PostgreSQL 17 (Supabase Verified)</span>
            </span>
            <span className="text-slate-700">|</span>
            <span className="inline-flex items-center gap-1.5 text-slate-300 font-semibold font-mono">
              <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
              <span>AI Provider: Ollama (qwen3:4b @ localhost:11434)</span>
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">
            BrandShield AI v1.0 · Zero Cloud Inference Cost
          </span>
        </div>
      </div>

      <GuidedDemoModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </>
  );
}
