"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

export function BrandShowcase() {
  return (
    <div className="space-y-4">
      {/* Top Badges */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase bg-slate-900/90 border border-slate-700/80 text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Enterprise AI Governance
        </span>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase bg-violet-950/40 border border-violet-800/60 text-violet-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
          Claim Governance Suite
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
        Every claim needs evidence.
        <br />
        Every decision needs{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-300">
          accountability.
        </span>
      </h1>

      {/* Description */}
      <p className="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
        BrandShield AI connects marketing claims to approved product facts,
        supporting documentation and compliance policies, with human oversight
        before publication.
      </p>
    </div>
  );
}
