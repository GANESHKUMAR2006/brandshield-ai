"use client";

import React, { useState } from "react";
import { SparklesIcon, CheckCircleIcon } from "@/components/ui/Icons";
import { GuidedDemoModal } from "./GuidedDemoModal";
import { PresenterViewModal } from "./PresenterViewModal";
import { SystemHealthModal } from "@/components/system/SystemHealthModal";

export function GuidedDemoBanner() {
  const [modalOpen, setModalOpen] = useState(false);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return (
      <div className="bg-[#0D1322] text-slate-200 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-xs sm:px-6">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span className="font-semibold text-white">BrandShield AI Live Engine</span>
          <span className="text-slate-400 hidden sm:inline">· Ollama (qwen3:4b) + PostgreSQL 17</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHealthOpen(true)}
            className="text-[11px] text-emerald-300 hover:text-white cursor-pointer font-medium"
          >
            System Health
          </button>
          <button
            onClick={() => setPresenterOpen(true)}
            className="text-[11px] text-violet-300 hover:text-white cursor-pointer font-medium"
          >
            Presenter View
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="text-[11px] underline text-cyan-300 hover:text-white cursor-pointer font-medium"
          >
            Open Demo Guide
          </button>
        </div>
        <GuidedDemoModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        <PresenterViewModal isOpen={presenterOpen} onClose={() => setPresenterOpen(false)} />
        <SystemHealthModal isOpen={healthOpen} onClose={() => setHealthOpen(false)} />
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-violet-950/80 via-[#0D1322] to-slate-900 text-white border-b border-violet-900/40 px-4 py-2 sm:px-6">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white">BrandShield AI:</span>
              <span className="text-violet-200 hidden md:inline">
                End-to-End Compliance Engine (Live Database + Ollama Local Extraction)
              </span>
              <span className="text-violet-200 md:hidden">
                Live Engine Active
              </span>
            </div>
            <button
              onClick={() => setHealthOpen(true)}
              className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/60 font-mono transition-colors cursor-pointer"
              title="Click to view System Health Diagnostics"
            >
              <CheckCircleIcon className="w-3 h-3 text-emerald-400" />
              <span>qwen3:4b @ localhost</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setHealthOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-colors cursor-pointer border border-slate-700/80"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              <span>System Health</span>
            </button>

            <button
              type="button"
              onClick={() => setPresenterOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 hover:text-white font-medium text-xs border border-indigo-700/60 shadow-xs transition-colors cursor-pointer"
            >
              <span>Presenter View</span>
            </button>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-violet-950/40 border border-violet-500/30 transition-all cursor-pointer"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-cyan-300" />
              <span>Demo Guide</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white text-[11px] cursor-pointer ml-1"
              aria-label="Minimize demo banner"
            >
              Minimize
            </button>
          </div>
        </div>
      </div>

      <GuidedDemoModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      <PresenterViewModal isOpen={presenterOpen} onClose={() => setPresenterOpen(false)} />
      <SystemHealthModal isOpen={healthOpen} onClose={() => setHealthOpen(false)} />
    </>
  );
}
