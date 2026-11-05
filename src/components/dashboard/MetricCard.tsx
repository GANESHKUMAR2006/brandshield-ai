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
    <Card className="p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {metric.label}
        </span>
        {metric.isSample && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            Sample
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span
          className={cn(
            "text-2xl sm:text-3xl font-bold tracking-tight",
            isRequiresReview
              ? "text-amber-600"
              : isSupported
              ? "text-emerald-700"
              : "text-slate-900"
          )}
        >
          {metric.value}
        </span>

        {metric.change && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border",
              isRequiresReview
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : isSupported
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-slate-50 text-slate-700 border-slate-200"
            )}
          >
            <ArrowUpRightIcon className="w-3.5 h-3.5" />
            {metric.change}
          </span>
        )}
      </div>

      {metric.helperText && (
        <p className="mt-2 text-xs text-slate-500">{metric.helperText}</p>
      )}
    </Card>
  );
}
