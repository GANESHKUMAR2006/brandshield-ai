"use client";

import React from "react";
import { FlaskConical, Shield, CheckSquare } from "lucide-react";

export function FeatureCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
      {/* Evidence-Backed */}
      <div className="bg-[#0b1020]/70 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-slate-700/80 transition-all">
        <div className="w-8 h-8 rounded-lg bg-violet-950/70 border border-violet-800/50 flex items-center justify-center text-violet-400">
          <FlaskConical className="w-4 h-4" />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white">
          Evidence-Backed
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Decisions grounded in approved product facts and supporting documentation.
        </p>
      </div>

      {/* Human-Led */}
      <div className="bg-[#0b1020]/70 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-slate-700/80 transition-all">
        <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
          <Shield className="w-4 h-4" />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white">
          Human-Led
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Human reviewers retain control over compliance decisions and publication approvals.
        </p>
      </div>

      {/* Auditable */}
      <div className="bg-[#0b1020]/70 border border-slate-800/80 rounded-xl p-4 space-y-2 hover:border-slate-700/80 transition-all">
        <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
          <CheckSquare className="w-4 h-4" />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white">
          Auditable
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Every verification, review decision and publication action is traceable.
        </p>
      </div>
    </div>
  );
}
