import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { AlertCircleIcon, CheckCircleIcon } from "@/components/ui/Icons";

export default function ReviewsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Human-in-the-loop verification workspace for ambiguous or high-risk marketing claims.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm">
            Batch Approval
          </Button>
          <Button variant="primary" size="sm">
            Review Next (3 Remaining)
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Review Item Card 1 */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status="requires_review" />
                <span className="text-xs font-semibold text-slate-500">
                  Submission: Q3 Radiance Serum — Instagram Carousel
                </span>
              </div>
              <span className="text-xs text-slate-400">Assigned to: Dr. Elena Vance</span>
            </div>
            <CardTitle className="text-base text-slate-900 mt-2">
              &ldquo;Boosts cellular renewal speed by up to 240% within 48 hours&rdquo;
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900 mb-1">
                  <AlertCircleIcon className="w-4 h-4 text-amber-600" />
                  <span>AI Discrepancy Note</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Clinical dossier DG-CT-2025-04 supports an in-vitro cellular acceleration of 180%
                  over 72 hours, not 240% in 48 hours. Claim is an overstatement of verified facts.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/80">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-900 mb-1">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                  <span>AI Defensible Correction Suggestion</span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  &ldquo;Clinically proven to accelerate cellular renewal markers by up to 180% within
                  72 hours in laboratory testing.&rdquo;
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Evidence match: <strong className="text-slate-800">DG-CT-2025-04 (Page 14)</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Request Copywriter Revision
                </Button>
                <Button variant="primary" size="sm">
                  Apply Suggestion & Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Item Card 2 */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusPill status="flagged" />
                <span className="text-xs font-semibold text-slate-500">
                  Submission: Packaging Secondary Carton Copy
                </span>
              </div>
              <span className="text-xs text-slate-400">Assigned to: Legal Compliance</span>
            </div>
            <CardTitle className="text-base text-slate-900 mt-2">
              &ldquo;100% hypoallergenic and zero comedogenic risk for sensitive skin&rdquo;
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200/80 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-rose-900 mb-1">
                <AlertCircleIcon className="w-4 h-4 text-rose-600" />
                <span>Regulatory Risk Warning</span>
              </div>
              <p className="text-rose-800 leading-relaxed">
                Absolute statements such as &quot;100% hypoallergenic&quot; and &quot;zero risk&quot; are prohibited
                under FDA and EU Cosmetics Regulation 1223/2009 without qualified cohort parameters.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Evidence match: <strong className="text-slate-800">HRIPT Report #DG-SR-2024</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="danger" size="sm">
                  Reject Claim
                </Button>
                <Button variant="outline" size="sm">
                  Propose Safe Phrasing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
