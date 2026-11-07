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
          <div className="w-7 h-7 rounded-full bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlertIcon className="w-3.5 h-3.5" />
          </div>
        );
      case "approval_granted":
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircleIcon className="w-3.5 h-3.5" />
          </div>
        );
      case "source_updated":
        return (
          <div className="w-7 h-7 rounded-full bg-violet-950/60 border border-violet-800/60 flex items-center justify-center text-violet-400 shrink-0">
            <FolderGit2Icon className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
            <FileCheckIcon className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  return (
    <Card className="h-full bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800/60">
        <div>
          <CardTitle className="text-white">Recent Activity & Audit Trail</CardTitle>
          <CardDescription className="text-slate-400">Event log across DermaGlow workspace</CardDescription>
        </div>
        <Link
          href="/audit"
          className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Audit Log →
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="divide-y divide-slate-800/60">
          {activities.map((act) => (
            <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
              {getActivityIcon(act.type)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {act.title}
                  </p>
                  <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                    {act.timestamp}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{act.description}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500 font-medium">
                  <span>Actor:</span>
                  <span className="text-slate-300 font-mono">{act.actor}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
