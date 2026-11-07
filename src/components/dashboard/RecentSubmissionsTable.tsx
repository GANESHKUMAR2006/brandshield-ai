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
    <Card className="overflow-hidden bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800/60">
        <div>
          <CardTitle className="text-white">Recent Submissions</CardTitle>
          <CardDescription className="text-slate-400">
            Marketing assets undergoing automated claim extraction and evidence reconciliation
          </CardDescription>
        </div>
        <Link
          href="/submissions"
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          View All →
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Campaign / Asset</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Claims Breakdown</th>
                <th className="py-3.5 px-4 sm:px-6">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="font-semibold text-white line-clamp-1">{sub.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      ID: {sub.id} · By {sub.submittedBy}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-medium text-[11px]">
                      {sub.channel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusPill status={sub.status} />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="font-semibold text-white">{sub.totalClaims} total</span>
                      <span className="text-slate-700">|</span>
                      <span className="text-emerald-400 font-medium">
                        {sub.supportedClaims} supported
                      </span>
                      {sub.reviewRequiredClaims > 0 && (
                        <>
                          <span className="text-slate-700">|</span>
                          <span className="text-amber-400 font-medium">
                            {sub.reviewRequiredClaims} review
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 sm:px-6 text-slate-400 whitespace-nowrap font-mono text-[11px]">
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
