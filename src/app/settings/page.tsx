import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DEMO_WORKSPACE, CURRENT_USER, SITE_CONFIG } from "@/config/site";

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Workspace Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
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
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Configured organisation and legal entity profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Workspace Name</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.name}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Corporate Domain</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.domain}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Subscription Tier</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.plan}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Compliance Standard</label>
                <input
                  type="text"
                  readOnly
                  value={DEMO_WORKSPACE.complianceTier}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim Governance Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>AI Verification Thresholds</CardTitle>
            <CardDescription>
              Configure automated approval thresholds and sensitivity parameters (Phase 1 configuration skeleton)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-900">Auto-Pass Confidence Cutoff</div>
                  <div className="text-[11px] text-slate-500">
                    Claims with AI evidence similarity at or above this score are marked Supported automatically.
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-sm bg-white px-3 py-1 rounded border border-slate-200">
                  85%
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-900">Mandatory Human Review Trigger</div>
                  <div className="text-[11px] text-slate-500">
                    Claims containing superlative terms (&ldquo;best&rdquo;, &ldquo;100%&rdquo;, &ldquo;miracle&rdquo;) require manual sign-off.
                  </div>
                </div>
                <div className="font-bold text-emerald-700 text-xs bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                  Enforced
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <div className="font-semibold text-slate-900">Active Reviewer Account</div>
                  <div className="text-[11px] text-slate-500">
                    {CURRENT_USER.name} ({CURRENT_USER.email}) — {CURRENT_USER.role}
                  </div>
                </div>
                <div className="font-bold text-indigo-700 text-xs bg-indigo-50 px-3 py-1 rounded border border-indigo-200">
                  Active
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Deployment Skeleton</CardTitle>
            <CardDescription>Engine build and runtime environment</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-slate-600">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Application Name:</span>
              <span className="font-semibold text-slate-900">{SITE_CONFIG.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Semantic Version:</span>
              <span className="font-mono text-slate-800">v{SITE_CONFIG.version} (Phase 1)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Framework:</span>
              <span className="font-medium text-slate-800">Next.js App Router (React 19)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">API Health Route:</span>
              <span className="font-mono text-indigo-700">/api/health (200 OK)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
