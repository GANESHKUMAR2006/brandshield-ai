import { NavItem, UserProfile, Workspace } from "@/types";

export const SITE_CONFIG = {
  name: "BrandShield AI",
  shortName: "BrandShield",
  tagline: "Evidence-Linked Marketing Claim Governance",
  version: "1.0.0",
  description:
    "Verify marketing claims against approved product facts, scientific dossiers, and brand guidelines.",
} as const;

export const DEMO_WORKSPACE: Workspace = {
  id: "ws-dermaglow-001",
  name: "DermaGlow",
  domain: "dermaglow.skincare.com",
  plan: "Enterprise Governance",
  complianceTier: "FDA & ISO 22716 Verified",
};

export const CURRENT_USER: UserProfile = {
  id: "usr-01-elena",
  name: "Dr. Elena Vance",
  email: "elena.vance@dermaglow.com",
  role: "VP Regulatory Affairs & Claim Governance",
  initials: "EV",
};

export const NAVIGATION_ITEMS: readonly NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    description: "Governance overview and claim pipeline metrics",
  },
  {
    name: "Submissions",
    href: "/submissions",
    icon: "FileCheck",
    badge: "8 Active",
    description: "Marketing collaterals and ad copies undergoing review",
  },
  {
    name: "Claims",
    href: "/claims",
    icon: "ShieldAlert",
    description: "Cross-campaign registry of extracted and verified claims",
  },
  {
    name: "Evidence Library",
    href: "/sources",
    icon: "FolderGit2",
    badge: "14 Dossiers",
    description: "Approved product dossiers, clinical studies, and guidelines",
  },
  {
    name: "Reviews",
    href: "/reviews",
    icon: "ClipboardCheck",
    badge: "3 Pending",
    description: "Human-in-the-loop compliance review queue",
  },
  {
    name: "Audit Logs",
    href: "/audit",
    icon: "History",
    description: "Tamper-evident governance trail and compliance logs",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: "Settings",
    description: "Workspace configuration and compliance rules",
  },
] as const;

export const WORKFLOW_STAGES = [
  { step: 1, name: "Content Ingestion", desc: "Upload ad copies, packaging, social posts" },
  { step: 2, name: "Claim Extraction", desc: "Detect quantifiable and qualitative claims" },
  { step: 3, name: "Evidence Retrieval", desc: "Retrieve ground-truth clinical trial citations" },
  { step: 4, name: "AI Verification", desc: "Compare claims against approved evidence" },
  { step: 5, name: "Auto-Correction", desc: "Suggest legally defensible claim alternatives" },
  { step: 6, name: "Human Approval", desc: "Final sign-off by legal and regulatory team" },
] as const;
