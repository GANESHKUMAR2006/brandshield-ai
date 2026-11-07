"use client";

import React from "react";
import {
  FileText,
  Sparkles,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface WorkflowStep {
  step: string;
  name: string;
  desc: string;
  icon: React.ElementType;
  badge: string;
}

const STEPS: WorkflowStep[] = [
  {
    step: "01",
    name: "Submit Content",
    desc: "Ingest marketing copy, social ads, or packaging text for inspection.",
    icon: FileText,
    badge: "Campaign Ingestion",
  },
  {
    step: "02",
    name: "Extract Claims",
    desc: "AI identifies atomic marketing assertions and character positions.",
    icon: Sparkles,
    badge: "Automated Extraction",
  },
  {
    step: "03",
    name: "Verify Evidence",
    desc: "Deterministic rules cross-reference clinical trials and approved facts.",
    icon: FileCheck2,
    badge: "Ground-Truth Matching",
  },
  {
    step: "04",
    name: "Review Risks",
    desc: "Flag contradictions or overclaims and suggest defensible copy.",
    icon: AlertTriangle,
    badge: "Risk Scoring",
  },
  {
    step: "05",
    name: "Approve or Reject",
    desc: "Publication gate blocks risky copy; approved assets publish.",
    icon: CheckCircle2,
    badge: "Publication Gate",
  },
];

export function ComplianceWorkflow() {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 sm:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-4 border-b border-slate-800/60">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Five-Step Verification & Governance Workflow
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60">
              Deterministic Pipeline
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            How BrandShield AI guards your brand from unsubstantiated marketing claims before publication.
          </p>
        </div>
        <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
          End-to-End Compliance Lifecycle
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isLast = index === STEPS.length - 1;

          return (
            <div
              key={s.step}
              className="relative rounded-xl border border-slate-800/90 bg-slate-950/50 p-4 flex flex-col justify-between hover:border-violet-500/50 hover:bg-slate-900/50 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold text-violet-300 bg-violet-950/80 border border-violet-800/60 px-1.5 py-0.5 rounded">
                    {s.step}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-violet-300 group-hover:border-violet-700/60 transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors leading-tight mb-1">
                  {s.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {s.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-medium">{s.badge}</span>
                {!isLast && (
                  <ArrowRight className="w-3 h-3 text-slate-600 hidden lg:block group-hover:text-violet-400 transition-colors" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
