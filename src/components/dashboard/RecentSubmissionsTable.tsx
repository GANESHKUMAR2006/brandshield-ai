import React from "react";
import Link from "next/link";
import { SubmissionItem } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/utils/formatters";

interface RecentSubmissionsTableProps {
  submissions: SubmissionItem[];
}

export function RecentSubmissionsTable({ submissions }: RecentSubmissionsTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>
            Marketing assets undergoing automated claim extraction and evidence reconciliation (Sample data)
          </CardDescription>
        </div>
        <Link
          href="/submissions"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View All →
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-4 sm:px-6">Campaign / Asset</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Claims Breakdown</th>
                <th className="py-3 px-4 sm:px-6">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="font-semibold text-slate-900 line-clamp-1">{sub.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      ID: {sub.id} · By {sub.submittedBy}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {sub.channel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusPill status={sub.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-slate-900">{sub.totalClaims} total</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-emerald-700 font-medium">
                        {sub.supportedClaims} supported
                      </span>
                      {sub.reviewRequiredClaims > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-amber-700 font-medium">
                            {sub.reviewRequiredClaims} review
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-slate-500 whitespace-nowrap">
                    {formatDate(sub.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
