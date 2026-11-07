"use client";

import React from "react";
import { Sparkles, Database, Cpu, UserCheck, ArrowRight } from "lucide-react";

export function VerificationFlow() {
  return (
    <div className="bg-[#0b1020]/80 backdrop-blur-md border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-300 uppercase">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Deterministic Verification Chain</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active Pipeline
        </span>
      </div>

      {/* 3-Stage Connected Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr,auto,1fr] items-center gap-3">
        {/* Node 1: Evidence Source */}
        <div className="bg-[#10172c] border border-slate-800/90 rounded-xl p-3.5 space-y-2 h-full flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50">
              01
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
              <Database className="w-2.5 h-2.5 text-cyan-400" />
              Source Node
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
              Evidence Source
            </span>
            <h4 className="text-xs font-bold text-white mt-0.5">
              Evidence Intelligence
            </h4>
            <p className="text-[11px] text-slate-400 leading-snug mt-1">
              Retrieve approved facts, source documents and supporting records.
            </p>
          </div>
        </div>

        {/* Connector 1 */}
        <div className="flex flex-col items-center justify-center py-1 md:py-0 px-1 text-center">
          <span className="text-[8px] font-mono tracking-widest text-cyan-400 uppercase whitespace-nowrap mb-0.5">
            Automated Check
          </span>
          <div className="flex items-center text-cyan-400">
            <div className="hidden md:block w-4 h-[1px] bg-cyan-500/50" />
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 rotate-90 md:rotate-0" />
          </div>
        </div>

        {/* Node 2: Claim Verification */}
        <div className="bg-[#10172c] border border-slate-800/90 rounded-xl p-3.5 space-y-2 h-full flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50">
              02
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
              <Cpu className="w-2.5 h-2.5 text-cyan-400" />
              Rule Engine
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
              Verification Flow
            </span>
            <h4 className="text-xs font-bold text-white mt-0.5">
              Claim Verification
            </h4>
            <p className="text-[11px] text-slate-400 leading-snug mt-1">
              Evaluate claims against evidence and applicable compliance rules.
            </p>
          </div>
        </div>

        {/* Connector 2 */}
        <div className="flex flex-col items-center justify-center py-1 md:py-0 px-1 text-center">
          <span className="text-[8px] font-mono tracking-widest text-cyan-400 uppercase whitespace-nowrap mb-0.5">
            Verification Flow
          </span>
          <div className="flex items-center text-cyan-400">
            <div className="hidden md:block w-4 h-[1px] bg-cyan-500/50" />
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400 rotate-90 md:rotate-0" />
          </div>
        </div>

        {/* Node 3: Human Oversight */}
        <div className="bg-[#10172c] border border-slate-800/90 rounded-xl p-3.5 space-y-2 h-full flex flex-col justify-between">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              03
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
              <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
              Review Node
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
              Human Oversight
            </span>
            <h4 className="text-xs font-bold text-white mt-0.5">
              Human Governance
            </h4>
            <p className="text-[11px] text-slate-400 leading-snug mt-1">
              Review, approve, reject or escalate before publication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
