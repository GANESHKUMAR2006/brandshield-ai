import { ReviewerRole } from "@/types";

export type TooltipPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  targetSelector: string; // e.g. '[data-tour="check-content-btn"]'
  title: string;
  content: string;
  placement?: TooltipPlacement;
  pageRoute?: string; // Optional target page route for cross-page navigation
  requiredRole?: ReviewerRole[];
  interactiveActionText?: string; // e.g. "Try It: Open Form"
  interactiveActionId?: string; // Dispatches synthetic trigger or callback
  controlTip?: {
    actionName: string;
    description: string;
    consequence?: string;
  };
}

export interface RoleTourConfig {
  role: ReviewerRole;
  roleDisplayName: string;
  responsibilities: string[];
  workflowSummary: string;
  steps: TourStep[];
}

export interface PageTourConfig {
  pageRoute: string;
  pageTitle: string;
  description: string;
  steps: TourStep[];
}

export interface UserTourState {
  userId: string;
  workspaceSlug: string;
  hasSeenWelcome: boolean;
  completedTours: string[]; // List of completed tour IDs
  skipped: boolean;
  lastRole?: string;
  updatedAt: string;
}
