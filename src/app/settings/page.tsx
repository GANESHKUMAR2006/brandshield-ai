import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DEMO_WORKSPACE, CURRENT_USER, SITE_CONFIG } from "@/config/site";
import { Building2, Sliders, ShieldCheck, Activity } from "lucide-react";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Workspace Settings & Thresholds
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage organization parameters, verification thresholds, and governance policies.
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

        {/* System Information */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-xl space-y-4">
          <div className="pb-3 border-b border-slate-800/80 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 rounded-lg">
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
    </AppLayout>
  );
}
