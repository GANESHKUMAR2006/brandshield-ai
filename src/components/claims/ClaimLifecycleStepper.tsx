"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface ClaimLifecycleStepperProps {
  extractionConfidence?: number;
  textStart?: number | null;
  textEnd?: number | null;
  verificationStatus: string;
  riskLevel?: string | null;
  reviewStatus?: string | null;
  isEligibleForPublication?: boolean;
  compact?: boolean;
}

export function ClaimLifecycleStepper({
  extractionConfidence = 1.0,
  textStart,
  textEnd,
  verificationStatus,
  riskLevel,
  reviewStatus = "pending",
  isEligibleForPublication,
  compact = false,
}: ClaimLifecycleStepperProps) {
  // Stage 1: Extraction
  const hasSpan = textStart !== null && textStart !== undefined && textEnd !== null && textEnd !== undefined;
  const confPct = Math.round((extractionConfidence || 1.0) * 100);

  // Stage 2: Verification
  const isSupported = verificationStatus === "supported";
  const isContradicted = verificationStatus === "contradicted";
  const isNeedsReview = verificationStatus === "needs_review" || verificationStatus === "outdated";
  const isUnverified = !verificationStatus || verificationStatus === "unverified";

  // Stage 3: Human Review
  const effectiveReview = reviewStatus || "pending";
  const isApproved = effectiveReview === "approved";
  const isRejected = effectiveReview === "rejected";
  const isModified = effectiveReview === "modified";
  const isEscalated = effectiveReview === "escalated";

  // Stage 4: Publication Gate
  const gateEligible = isEligibleForPublication ?? (isApproved && !isUnverified);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
        {/* Step 1 */}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-950/60 border border-violet-800/60 text-violet-300 font-mono">
          <Sparkles className="w-2.5 h-2.5 text-violet-400" />
          <span>Extracted {hasSpan ? `[${textStart}..${textEnd}]` : `${confPct}%`}</span>
        </span>
        <span className="text-slate-600">→</span>

        {/* Step 2 */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold uppercase ${
            isSupported
              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
              : isContradicted
              ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
              : isNeedsReview
              ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
              : "bg-slate-900 text-slate-300 border-slate-700"
          }`}
        >
          {verificationStatus.replace(/_/g, " ")}
          {riskLevel && (
            <span className="text-[9px] font-bold opacity-80">({riskLevel.toUpperCase()})</span>
          )}
        </span>
        <span className="text-slate-600">→</span>

        {/* Step 3 */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold uppercase ${
            isApproved
              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
              : isRejected
              ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
              : isModified
              ? "bg-cyan-950/60 text-cyan-300 border-cyan-800/60"
              : isEscalated
              ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
              : "bg-amber-950/60 text-amber-300 border-amber-800/60"
          }`}
        >
          {effectiveReview.replace(/_/g, " ")}
        </span>
        <span className="text-slate-600">→</span>

        {/* Step 4 */}
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold ${
            gateEligible
              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
              : "bg-slate-900 text-slate-400 border-slate-700"
          }`}
        >
          {gateEligible ? (
            <>
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
              <span>Gate Passed</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
              <span>Gate Blocked</span>
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
        Claim Governance Progression Lifecycle
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Stage 1: Extraction */}
        <div className="p-2.5 rounded-xl bg-violet-950/30 border border-violet-800/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
            <span>Stage 1</span>
            <span className="text-violet-400 font-bold">Ollama AI</span>
          </div>
          <div className="font-bold text-white mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>Extracted</span>
          </div>
          <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
            {hasSpan ? `[${textStart}..${textEnd}]` : "Full text"} · {confPct}% conf
          </div>
        </div>

        {/* Stage 2: Deterministic Verification */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            isSupported
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200"
              : isContradicted
              ? "bg-rose-950/30 border-rose-800/40 text-rose-200"
              : isNeedsReview
              ? "bg-amber-950/30 border-amber-800/40 text-amber-200"
              : "bg-slate-900/60 border-slate-800 text-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] opacity-75 font-medium">
            <span>Stage 2</span>
            <span>Rules Engine</span>
          </div>
          <div className="font-bold capitalize mt-1">
            {verificationStatus.replace(/_/g, " ")}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {riskLevel ? `${riskLevel.toUpperCase()} Risk` : "Unscored"}
          </div>
        </div>

        {/* Stage 3: Human Review */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            isApproved
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200"
              : isRejected
              ? "bg-rose-950/30 border-rose-800/40 text-rose-200"
              : isModified
              ? "bg-cyan-950/30 border-cyan-800/40 text-cyan-200"
              : isEscalated
              ? "bg-purple-950/30 border-purple-800/40 text-purple-200"
              : "bg-amber-950/30 border-amber-800/40 text-amber-200"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] opacity-75 font-medium">
            <span>Stage 3</span>
            <span>Reviewer</span>
          </div>
          <div className="font-bold capitalize mt-1">
            {effectiveReview.replace(/_/g, " ")}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {isApproved
              ? "Sign-off authorized"
              : isRejected
              ? "Sign-off declined"
              : isModified
              ? "Revision re-verified"
              : isEscalated
              ? "Escalated to specialist"
              : "Awaiting decision"}
          </div>
        </div>

        {/* Stage 4: Publication Gate */}
        <div
          className={`p-2.5 rounded-xl border flex flex-col justify-between ${
            gateEligible
              ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-200"
              : "bg-slate-900/60 border-slate-800 text-slate-400"
          }`}
        >
          <div className="flex items-center justify-between text-[10px] opacity-75 font-medium">
            <span>Stage 4</span>
            <span>Publication</span>
          </div>
          <div className="font-bold mt-1 flex items-center gap-1.5">
            {gateEligible ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-300">Gate Satisfied</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-300">Gate Blocked</span>
              </>
            )}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {gateEligible ? "Ready for publication" : "Human approval required"}
          </div>
        </div>
      </div>
    </div>
  );
}
