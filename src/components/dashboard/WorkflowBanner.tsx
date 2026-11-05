import React from "react";
import { WORKFLOW_STAGES } from "@/config/site";

export function WorkflowBanner() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Claim Governance Lifecycle
          </h2>
          <p className="text-xs text-slate-500">
            End-to-end evidence verification pipeline from ad copy to legal sign-off
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            Standard Governance Pipeline
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
        {WORKFLOW_STAGES.map((stage) => (
          <div
            key={stage.step}
            className="flex flex-col p-3 rounded-lg border border-slate-200/70 bg-slate-50/60 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded">
                0{stage.step}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900 leading-tight mb-1">
              {stage.name}
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">
              {stage.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
