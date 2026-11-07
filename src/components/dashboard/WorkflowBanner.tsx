import React from "react";
import { WORKFLOW_STAGES } from "@/config/site";

export function WorkflowBanner() {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            Claim Governance Lifecycle
            <span className="text-[10px] font-mono font-medium text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
              Deterministic V2
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            End-to-end evidence verification pipeline from ad copy to legal sign-off
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
            Standard Governance Pipeline
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
        {WORKFLOW_STAGES.map((stage) => (
          <div
            key={stage.step}
            className="flex flex-col p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50 hover:border-violet-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold font-mono text-violet-300 bg-violet-950/60 border border-violet-800/60 px-1.5 py-0.5 rounded">
                0{stage.step}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
            </div>
            <h3 className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight mb-1 transition-colors">
              {stage.name}
            </h3>
            <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
              {stage.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
