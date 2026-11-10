"use client";

import React from "react";
import { getStatusBadgeInfo, BadgeTone } from "@/lib/audit/audit-presenter";

interface AuditStatusBadgeProps {
  fieldKey: string;
  value: unknown;
  fallbackLabel?: string;
  className?: string;
}

export function AuditStatusBadge({
  fieldKey,
  value,
  fallbackLabel,
  className = "",
}: AuditStatusBadgeProps) {
  const badgeInfo = getStatusBadgeInfo(fieldKey, value);

  if (!badgeInfo) {
    if (value === null || value === undefined) {
      return <span className="text-slate-500 italic text-xs">None</span>;
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 ${className}`}
      >
        {fallbackLabel || String(value)}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border ${badgeInfo.className} ${className}`}
    >
      {badgeInfo.label}
    </span>
  );
}

interface ToneBadgeProps {
  label: string;
  tone: BadgeTone;
  className?: string;
}

export function ToneBadge({ label, tone, className = "" }: ToneBadgeProps) {
  const toneClasses: Record<BadgeTone, string> = {
    red: "bg-rose-950/80 text-rose-300 border-rose-800/70 shadow-[0_0_6px_rgba(244,63,94,0.2)]",
    amber: "bg-amber-950/80 text-amber-300 border-amber-800/70 shadow-[0_0_6px_rgba(245,158,11,0.2)]",
    green: "bg-emerald-950/80 text-emerald-300 border-emerald-800/70 shadow-[0_0_6px_rgba(16,185,129,0.2)]",
    cyan: "bg-cyan-950/80 text-cyan-300 border-cyan-800/70 shadow-[0_0_6px_rgba(6,182,212,0.2)]",
    violet: "bg-violet-950/80 text-violet-300 border-violet-800/70 shadow-[0_0_6px_rgba(139,92,246,0.2)]",
    slate: "bg-slate-800 text-slate-300 border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${toneClasses[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
