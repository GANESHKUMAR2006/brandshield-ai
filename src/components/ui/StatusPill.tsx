import React from "react";
import { ClaimStatus, SubmissionStatus } from "@/types";
import { Badge } from "./Badge";

interface StatusPillProps {
  status: SubmissionStatus | ClaimStatus | string;
  className?: string;
}

const statusMap: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "indigo" | "neutral" }
> = {
  // Submission Statuses
  draft: { label: "Draft", variant: "neutral" },
  submitted: { label: "Submitted", variant: "indigo" },
  processing: { label: "Processing", variant: "indigo" },
  under_review: { label: "Under Review", variant: "indigo" },
  in_review: { label: "In Review", variant: "indigo" },
  pending_review: { label: "Pending Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  changes_requested: { label: "Changes Requested", variant: "warning" },
  escalated: { label: "Escalated", variant: "danger" },
  rejected: { label: "Rejected", variant: "danger" },
  published: { label: "Published", variant: "success" },

  // Publication Gate Statuses
  ineligible: { label: "Gate: Blocked", variant: "neutral" },
  eligible: { label: "Gate: Eligible", variant: "success" },

  // Human Review Workflow Statuses
  pending: { label: "Review: Pending", variant: "neutral" },
  modified: { label: "Review: Modified", variant: "indigo" },

  // Claim Automated Verification Statuses
  supported: { label: "AI: Supported", variant: "success" },
  contradicted: { label: "AI: Contradicted", variant: "danger" },
  outdated: { label: "AI: Outdated", variant: "warning" },
  unverified: { label: "AI: Unverified", variant: "neutral" },
  needs_review: { label: "AI: Needs Review", variant: "warning" },
  requires_review: { label: "AI: Requires Review", variant: "warning" },
  unsupported: { label: "AI: Unsupported", variant: "danger" },
  flagged: { label: "AI: Flagged", variant: "danger" },

  // Generic
  active: { label: "Active", variant: "success" },
  archived: { label: "Archived", variant: "neutral" },
};

export function StatusPill({ status, className }: StatusPillProps) {
  const config = statusMap[status] || {
    label: status.replace(/_/g, " "),
    variant: "default" as const,
  };

  return (
    <Badge variant={config.variant} size="sm" className={className}>
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          config.variant === "success"
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
            : config.variant === "warning"
            ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]"
            : config.variant === "danger"
            ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.6)]"
            : config.variant === "indigo"
            ? "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]"
            : "bg-slate-400"
        }`}
      />
      {config.label}
    </Badge>
  );
}
