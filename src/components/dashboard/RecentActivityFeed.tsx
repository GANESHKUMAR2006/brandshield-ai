import React from "react";
import Link from "next/link";
import { ActivityItem } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import {
  ShieldAlertIcon,
  CheckCircleIcon,
  FolderGit2Icon,
  FileCheckIcon,
} from "@/components/ui/Icons";

interface RecentActivityFeedProps {
  activities: ActivityItem[];
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "review_requested":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlertIcon className="w-3.5 h-3.5" />
          </div>
        );
      case "approval_granted":
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircleIcon className="w-3.5 h-3.5" />
          </div>
        );
      case "source_updated":
        return (
          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <FolderGit2Icon className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <FileCheckIcon className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle>Recent Activity & Audit Trail</CardTitle>
          <CardDescription>Event log across DermaGlow workspace (Sample data)</CardDescription>
        </div>
        <Link
          href="/audit"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Audit Log →
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="divide-y divide-slate-100">
          {activities.map((act) => (
            <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
              {getActivityIcon(act.type)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                    {act.title}
                  </p>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {act.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{act.description}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-medium">
                  <span>Actor:</span>
                  <span className="text-slate-600">{act.actor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
