"use client";

import React from "react";
import Link from "next/link";
import { Shield, ShieldCheck } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";

interface AuthHeaderProps {
  centerBadge?: React.ReactNode;
  showSubhead?: boolean;
  showRightBadge?: boolean;
}

export function AuthHeader({
  centerBadge,
  showSubhead = false,
  showRightBadge,
}: AuthHeaderProps) {
  const displayRightBadge = showRightBadge !== undefined ? showRightBadge : !centerBadge;

  return (
    <header className="w-full border-b border-slate-800/60 bg-[#060913]/60 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-20">
      {/* Brand logo & title */}
      <Link href="/login" className="flex items-center gap-3 group focus:outline-none">
        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-200 group-hover:border-violet-500/60 group-hover:text-white transition-all shadow-sm">
          <Shield className="w-4 h-4 text-violet-400 group-hover:text-violet-300 transition-colors" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-white group-hover:text-slate-200 transition-colors">
            {SITE_CONFIG.name}
          </span>
          {showSubhead && (
            <span className="text-[9px] font-mono tracking-wider text-slate-400 uppercase">
              ENTERPRISE CLAIM GOVERNANCE
            </span>
          )}
        </div>
      </Link>

      {/* Optional center badge (e.g., Claim Governance • Security Operations) */}
      {centerBadge ? (
        <div className="flex items-center">
          {centerBadge}
        </div>
      ) : null}

      {/* Right enterprise governance label (when active) */}
      {displayRightBadge ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline uppercase text-[11px] tracking-wider">
            Enterprise Claim Governance
          </span>
        </div>
      ) : (
        <div className="w-8 hidden sm:block" />
      )}
    </header>
  );
}
