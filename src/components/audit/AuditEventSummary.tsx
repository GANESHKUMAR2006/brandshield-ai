"use client";

import React from "react";
import { formatAuditSummary, getStatusBadgeInfo } from "@/lib/audit/audit-presenter";
import { AuditStatusBadge } from "./AuditStatusBadge";
import { ArrowRight, Info } from "lucide-react";

interface AuditEventSummaryProps {
  action: string;
  metadata?: Record<string, unknown> | null;
  className?: string;
}

export function AuditEventSummary({
  action,
  metadata,
  className = "",
}: AuditEventSummaryProps) {
  const summaryText = formatAuditSummary(action, metadata);
  const m = metadata || {};

  // Extract key summary pills if available
  const riskBadge = m.risk_level ? getStatusBadgeInfo("risk_level", m.risk_level) : null;
  const statusBadge = m.verification_status
    ? getStatusBadgeInfo("verification_status", m.verification_status)
    : null;
  const decisionBadge = m.decision ? getStatusBadgeInfo("decision", m.decision) : null;
  const complianceBadge = m.policy_compliance_status
    ? getStatusBadgeInfo("policy_compliance_status", m.policy_compliance_status)
    : null;
  const sufficiencyBadge = m.evidence_sufficiency
    ? getStatusBadgeInfo("evidence_sufficiency", m.evidence_sufficiency)
    : null;

  const chunksCount = typeof m.chunks_count === "number" ? m.chunks_count : null;
  const claimsCount = typeof m.claims_count === "number" ? m.claims_count : null;
  const linkedCount = typeof m.linked_count === "number" ? m.linked_count : null;

  return (
    <div
      className={`mt-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 group-hover:border-slate-700/90 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        {/* Human-Readable Summary */}
        <p className="text-xs font-medium text-slate-200 leading-relaxed flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
          {summaryText}
        </p>

        {/* Quick Metadata Indicator Badges */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {riskBadge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${riskBadge.className}`}
            >
              Risk: {riskBadge.label}
            </span>
          )}

          {sufficiencyBadge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sufficiencyBadge.className}`}
            >
              Evidence: {sufficiencyBadge.label}
            </span>
          )}

          {complianceBadge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${complianceBadge.className}`}
            >
              {complianceBadge.label}
            </span>
          )}

          {statusBadge && !riskBadge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadge.className}`}
            >
              Status: {statusBadge.label}
            </span>
          )}

          {decisionBadge && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${decisionBadge.className}`}
            >
              Decision: {decisionBadge.label}
            </span>
          )}

          {chunksCount !== null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
              {chunksCount} Vector Chunks
            </span>
          )}

          {claimsCount !== null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-950/60 text-violet-300 border border-violet-800/60">
              {claimsCount} Claims
            </span>
          )}

          {linkedCount !== null && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
              {linkedCount} Evidence Items
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
