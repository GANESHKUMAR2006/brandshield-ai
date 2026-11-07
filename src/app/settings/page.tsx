"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { DEMO_WORKSPACE, CURRENT_USER, SITE_CONFIG } from "@/config/site";
import { SystemHealthModal } from "@/components/system/SystemHealthModal";
import { PresenterViewModal } from "@/components/demo/PresenterViewModal";
import { GuidedDemoModal } from "@/components/demo/GuidedDemoModal";
import {
  Building2,
  Sliders,
  ShieldCheck,
  Activity,
  ArrowRight,
  Terminal,
  Sparkles,
  HelpCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [presenterModalOpen, setPresenterModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Workspace Settings & Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage organization parameters, verification thresholds, compliance policies, and diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm">
            Discard
          </Button>
          <Button variant="primary" size="sm">
            Save Preferences
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Organization Information */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
            <div className="p-2 bg-violet-950/80 border border-violet-800/60 text-violet-400 rounded-lg">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Organization Details</h2>
              <p className="text-xs text-slate-400">Configured enterprise entity and compliance tier profile</p>
            </div>
          </div>
          <div className="space-y-4 text-xs pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.name}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Corporate Domain</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.domain}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Subscription Tier</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.plan}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Compliance Standard</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.complianceTier}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-medium shadow-inner"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Claim Governance Thresholds */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 rounded-lg">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">AI Verification & Cutoff Thresholds</h2>
              <p className="text-xs text-slate-400">Configure automated grounding cutoffs and sensitivity parameters</p>
            </div>
          </div>
          <div className="space-y-3 pt-2 text-xs">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
              <div>
                <div className="font-semibold text-white">Auto-Pass Grounding Cutoff</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Claims with AI evidence similarity at or above this score are marked Supported automatically.
                </div>
              </div>
              <div className="font-bold text-cyan-300 text-sm bg-cyan-950/80 border border-cyan-800/60 px-3 py-1 rounded-lg">
                85%
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
              <div>
                <div className="font-semibold text-white">Superlative Trigger (Mandatory Human Sign-off)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Claims containing superlative terms (&ldquo;best&rdquo;, &ldquo;100%&rdquo;, &ldquo;miracle&rdquo;) require manual human sign-off.
                </div>
              </div>
              <div className="font-bold text-emerald-300 text-xs bg-emerald-950/80 px-3 py-1 rounded-lg border border-emerald-800/60">
                Enforced
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-950/60">
              <div>
                <div className="font-semibold text-white">Active Reviewer Account</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {CURRENT_USER.name} ({CURRENT_USER.email}) — {CURRENT_USER.role}
                </div>
              </div>
              <div className="font-bold text-violet-300 text-xs bg-violet-950/80 px-3 py-1 rounded-lg border border-violet-800/60">
                Active
              </div>
            </div>
          </div>
        </div>

        {/* Policy Management Link Card */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-950/80 border border-violet-800/60 text-violet-400 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Compliance Policies & Simulation Studio</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage deterministic policy rules, prohibited claim patterns, and test live copies in the Simulation Studio.
                </p>
              </div>
            </div>
            <Link
              href="/policies"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors shadow-md shadow-violet-950/50 shrink-0"
            >
              <span>Open Policy Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Diagnostics & Evaluator Tools */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 rounded-lg">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">System Diagnostics & Evaluator Tools</h2>
              <p className="text-xs text-slate-400">Inspect backend health, view evaluator scenarios, or launch walkthroughs</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setHealthModalOpen(true)}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-emerald-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  System Health
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              </div>
              <p className="text-[11px] text-slate-400">
                Check database connectivity, Ollama/HF model latency, and API status.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPresenterModalOpen(true)}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-violet-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors">
                  Presenter Guide
                </span>
                <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <p className="text-[11px] text-slate-400">
                Open judge walkthrough script and 3 guided demo scenarios.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setGuideModalOpen(true)}
              className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-cyan-700/60 hover:bg-slate-900/60 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  Guided Tour
                </span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-[11px] text-slate-400">
                Step-by-step interactive workflow tutorial for first-time evaluators.
              </p>
            </button>
          </div>
        </div>

        {/* System Information */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
            <div className="p-2 bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Platform Deployment Architecture</h2>
              <p className="text-xs text-slate-400">Engine build and production runtime environment</p>
            </div>
          </div>
          <div className="text-xs space-y-2.5 text-slate-300 pt-2">
            <div className="flex justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Application Name:</span>
              <span className="font-semibold text-white">{SITE_CONFIG.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Semantic Version:</span>
              <span className="font-mono text-cyan-300">v{SITE_CONFIG.version} (Production Ready)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Framework & Runtime:</span>
              <span className="font-medium text-white">Next.js App Router (React 19)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">API Health Diagnostics Route:</span>
              <span className="font-mono text-emerald-400">/api/health (200 OK)</span>
            </div>
          </div>
        </div>
      </div>

      <SystemHealthModal isOpen={healthModalOpen} onClose={() => setHealthModalOpen(false)} />
      <PresenterViewModal isOpen={presenterModalOpen} onClose={() => setPresenterModalOpen(false)} />
      <GuidedDemoModal isOpen={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </AppLayout>
  );
}
