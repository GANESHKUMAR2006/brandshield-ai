import React from "react";
import { MetricItem } from "@/types";
import { Card } from "@/components/ui/Card";
import { ArrowUpRightIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils/cn";

interface MetricCardProps {
  metric: MetricItem;
}

export function MetricCard({ metric }: MetricCardProps) {
  const isRequiresReview = metric.id === "claims-requiring-review";
  const isSupported = metric.id === "supported-claims";

  return (
    <Card className="p-5 flex flex-col justify-between hover:border-slate-700 transition-all bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {metric.label}
        </span>
        {metric.isSample && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
            Sample
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span
          className={cn(
            "text-2xl sm:text-3xl font-bold tracking-tight",
            isRequiresReview
              ? "text-amber-400"
              : isSupported
              ? "text-emerald-400"
              : "text-white"
          )}
        >
          {metric.value}
        </span>

        {metric.change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border",
              isRequiresReview
                ? "bg-amber-950/60 text-amber-300 border-amber-800/60"
                : isSupported
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                : "bg-slate-800/80 text-slate-300 border-slate-700/60"
            )}
          >
            <ArrowUpRightIcon className="w-3.5 h-3.5" />
            {metric.change}
          </span>
        )}
      </div>

      {metric.helperText && (
        <p className="mt-2 text-xs text-slate-400">{metric.helperText}</p>
      )}
    </Card>
  );
}
