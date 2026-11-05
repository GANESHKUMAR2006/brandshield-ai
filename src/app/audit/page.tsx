import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { SAMPLE_ACTIVITIES } from "@/config/sample-data";

export default function AuditPage() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Governance & Audit History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Immutable log of all claim verifications, policy overrides, and regulatory sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm">
            Filter by Date
          </Button>
          <Button variant="primary" size="sm">
            Download Cryptographic Audit Trail
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Total Audit Events</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">512 Events</div>
          <div className="text-[11px] text-slate-400 mt-1">All events timestamped in UTC</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Human Sign-offs</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">48 Approvals</div>
          <div className="text-[11px] text-slate-400 mt-1">100% compliant with governance protocol</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Ledger Integrity</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">Verified</div>
          <div className="text-[11px] text-slate-400 mt-1">SHA-256 Hash Chain Valid</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Detailed Audit Event Stream</CardTitle>
              <CardDescription>
                Chronological log of changes and verifications for workspace DermaGlow (Sample records)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentActivityFeed activities={SAMPLE_ACTIVITIES} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Compliance Certification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-900">ISO 22716 & FDA 21 CFR Part 11</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Compliant claim substantiation ledger ready for internal legal and external regulatory inspection.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-900">Chain of Custody</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Every claim extraction is linked to specific reviewer ID, timestamp, and source document hash.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
