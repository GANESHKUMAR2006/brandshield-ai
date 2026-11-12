import { ReviewerRole } from "@/types";
import { TourStep, RoleTourConfig, PageTourConfig } from "@/types/tour";

// ---------------------------------------------------------------------------
// 1. PAGE-LEVEL TOURS & INDIVIDUAL CONTROL GUIDANCE
// ---------------------------------------------------------------------------

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    id: "dash-workspace",
    targetSelector: '[data-tour="workspace-indicator"]',
    title: "Active Organization & Workspace",
    content: "Identifies your current enterprise workspace and active compliance tier. All verification rules and audit trails are securely partitioned to this tenant.",
    placement: "bottom",
    controlTip: {
      actionName: "Active Workspace Context",
      description: "Controls the scope of product catalogs, clinical evidence, and user access.",
      consequence: "Switching workspaces partitions your view strictly to the selected organization.",
    },
  },
  {
    id: "dash-kpis",
    targetSelector: '[data-tour="kpi-cards"]',
    title: "Five Key Governance Metrics",
    content: "Real-time compliance telemetry: Total Claims Analyzed, Evidence Supported, Contradicted Claims (Brand Risk), Awaiting Human Review, and Published Submissions.",
    placement: "bottom",
    controlTip: {
      actionName: "Compliance Scorecard",
      description: "Monitors overall claim health and highlights publication blocks in real time.",
      consequence: "Any contradicted claim automatically engages the publication gate to prevent unauthorized launch.",
    },
  },
  {
    id: "dash-check-content",
    targetSelector: '[data-tour="check-content-btn"]',
    title: "Primary Action: Check Marketing Content",
    content: "Upload ad copy, packaging text, or social creatives to run automated AI claim extraction and evidence reconciliation.",
    placement: "bottom",
    interactiveActionText: "Try It: Open Submission Form",
    interactiveActionId: "open-submission-modal",
    controlTip: {
      actionName: "Check Marketing Content Button",
      description: "Launches the claim verification modal to test drafts against approved facts.",
      consequence: "Instantly extracts quantifiable and promotional claims without mutating production records.",
    },
  },
  {
    id: "dash-review-link",
    targetSelector: '[data-tour="review-queue-link"]',
    title: "Review Queue Quick Access",
    content: "Navigate directly to claims flagged for human-in-the-loop compliance or legal sign-off.",
    placement: "left",
    controlTip: {
      actionName: "Review Queue Entry",
      description: "Shows pending items requiring formal sign-off or justification.",
      consequence: "Claims resolved here update their publication gate eligibility immediately.",
    },
  },
  {
    id: "dash-workflow",
    targetSelector: '[data-tour="governance-workflow"]',
    title: "The 5-Step Governance Lifecycle",
    content: "Content Ingestion → AI Extraction → Evidence Grounding → Human Approval → Safe Publication. Every claim passes through this automated lifecycle.",
    placement: "top",
  },
  {
    id: "dash-recent-subs",
    targetSelector: '[data-tour="recent-submissions"]',
    title: "Recent Marketing Submissions Table",
    content: "Inspect active campaigns undergoing verification. Shows channel, claim breakdown, and whether publication is gated or cleared.",
    placement: "top",
  },
];

export const SUBMISSIONS_TOUR_STEPS: TourStep[] = [
  {
    id: "sub-create-btn",
    targetSelector: '[data-tour="create-submission-btn"]',
    title: "Create Submission",
    content: "Submit new marketing copy, billboard text, or social campaigns for automated AI claim extraction.",
    placement: "bottom",
    interactiveActionText: "Try It: Open Form",
    interactiveActionId: "open-submission-modal",
    controlTip: {
      actionName: "Create Submission Button",
      description: "Opens the collateral ingestion modal.",
      consequence: "Initiates deterministic claim extraction and grounds statements against active product facts.",
    },
  },
  {
    id: "sub-search",
    targetSelector: '[data-tour="submissions-search"]',
    title: "Campaign Filter & Search",
    content: "Quickly locate marketing assets by campaign title, channel, or associated SKU.",
    placement: "bottom",
  },
  {
    id: "sub-table",
    targetSelector: '[data-tour="submissions-table"]',
    title: "Submissions Registry & Gate Status",
    content: "Inspect claims breakdown and publication eligibility. Green badges indicate verified content; red badges indicate unapproved claims blocked from release.",
    placement: "top",
    controlTip: {
      actionName: "Publication Gate Indicator",
      description: "Displays 'Eligible' or 'Blocked' based on underlying claim verification.",
      consequence: "Ineligible assets cannot be pushed to live media until compliance resolves flagged items.",
    },
  },
];

export const PRODUCTS_TOUR_STEPS: TourStep[] = [
  {
    id: "prod-register-btn",
    targetSelector: '[data-tour="register-product-btn"]',
    title: "Add Product Formulation",
    content: "Register a proprietary product formulation with name, SKU, active ingredients, and base retail pricing.",
    placement: "bottom",
    controlTip: {
      actionName: "Add Product Control",
      description: "Registers commercial products in the organization catalog.",
      consequence: "Active ingredients and approved pricing become the truth anchors used by AI verification.",
    },
  },
  {
    id: "prod-search",
    targetSelector: '[data-tour="products-search"]',
    title: "Product Search & Categories",
    content: "Filter through commercial formulations and verify registered ingredient concentrations.",
    placement: "bottom",
  },
  {
    id: "prod-table",
    targetSelector: '[data-tour="products-table"]',
    title: "Approved Product Facts",
    content: "Each product record stores verified ingredient percentages (e.g. 10% Vitamin C) that protect your brand against misleading overclaims.",
    placement: "top",
    controlTip: {
      actionName: "Product Fact Base",
      description: "Ground truth definitions for concentrations and pricing.",
      consequence: "Marketing submissions advertising different concentrations are automatically flagged as Contradictions.",
    },
  },
];

export const EVIDENCE_TOUR_STEPS: TourStep[] = [
  {
    id: "ev-upload-btn",
    targetSelector: '[data-tour="upload-evidence-btn"]',
    title: "Upload Clinical Evidence",
    content: "Upload clinical trial reports, lab certificates, or regulatory dossiers (PDF, DOCX) to establish verifiable truth anchors.",
    placement: "bottom",
    controlTip: {
      actionName: "Upload Evidence Button",
      description: "Ingests scientific substantiation into the organization library.",
      consequence: "Ingested documents are chunked and embedded for automated citation matching.",
    },
  },
  {
    id: "ev-tabs",
    targetSelector: '[data-tour="evidence-tabs"]',
    title: "Evidence & Facts Navigation",
    content: "Switch between Scientific Dossiers, Approved Facts, Commercial Products, and Promotional Price Registries.",
    placement: "bottom",
  },
  {
    id: "ev-list",
    targetSelector: '[data-tour="evidence-list"]',
    title: "Truth Anchors & Citations",
    content: "View study titles, methodology notes, effective validity windows, and associated clinical trial IDs (e.g. DG-CT-2025-04).",
    placement: "top",
    controlTip: {
      actionName: "Evidence Inspection",
      description: "Examines underlying clinical data and methodology.",
      consequence: "Expired or non-clinical documents are excluded from supporting marketing assertions.",
    },
  },
];

export const POLICIES_TOUR_STEPS: TourStep[] = [
  {
    id: "pol-create-btn",
    targetSelector: '[data-tour="create-policy-btn"]',
    title: "Author Compliance Policy",
    content: "Define regulatory constraints, prohibited superlative terms ('miracle', '100% cure'), and substantiation rules.",
    placement: "bottom",
    controlTip: {
      actionName: "Create Policy Control",
      description: "Authors deterministic rules enforced across all campaigns.",
      consequence: "Active policies automatically trigger review requirements when matching copy is ingested.",
    },
  },
  {
    id: "pol-list",
    targetSelector: '[data-tour="policies-list"]',
    title: "Active Policy Enforcements",
    content: "Review active policy tiers, severity levels (Critical, Warning), and publication gating rules.",
    placement: "top",
  },
  {
    id: "pol-studio-link",
    targetSelector: '[data-tour="policy-studio-link"]',
    title: "Policy Simulation Studio",
    content: "Simulate and test draft policies against historical ad copies before publishing them to the live enforcement tier.",
    placement: "left",
    controlTip: {
      actionName: "Policy Simulation Studio",
      description: "Safe sandbox to test rule impact without disrupting live marketing.",
      consequence: "Prevents unintended publication blocks before policies go live.",
    },
  },
];

export const REVIEWS_TOUR_STEPS: TourStep[] = [
  {
    id: "rev-risk-filter",
    targetSelector: '[data-tour="reviews-risk-filter"]',
    title: "Risk-Tier Filtering",
    content: "Filter claims by Critical (direct fact contradiction), High, Medium, or Low risk to prioritize urgent blockers.",
    placement: "bottom",
  },
  {
    id: "rev-queue-table",
    targetSelector: '[data-tour="reviews-queue-table"]',
    title: "Pending Human Review Queue",
    content: "Claims requiring manual human sign-off: superlative marketing terms, unverified clinical assertions, or price mismatches.",
    placement: "top",
    controlTip: {
      actionName: "Review Queue Claims",
      description: "Displays side-by-side comparison of ad assertion vs. clinical evidence.",
      consequence: "Until a human reviewer records a decision, the parent submission remains blocked.",
    },
  },
  {
    id: "rev-decision-actions",
    targetSelector: '[data-tour="reviews-decision-actions"]',
    title: "Human Governance Decisions",
    content: "Four binding actions: Approve (clears for publication), Reject (permanently disallows), Modify (suggests compliant phrasing), or Escalate (transfers to Legal).",
    placement: "left",
    controlTip: {
      actionName: "Review Determination Controls",
      description: "Records formal regulatory determination with mandatory justification.",
      consequence: "All decisions are immutably logged into the append-only audit trail with the reviewer's authenticated identity.",
    },
  },
];

export const AUDIT_TOUR_STEPS: TourStep[] = [
  {
    id: "audit-filters",
    targetSelector: '[data-tour="audit-filters"]',
    title: "Audit Filters & Actors",
    content: "Filter by Actor (Admin, Reviewer, Legal), Action Type (Claim Approved, Policy Published, Role Changed), or Entity ID.",
    placement: "bottom",
  },
  {
    id: "audit-table",
    targetSelector: '[data-tour="audit-events-table"]',
    title: "Append-Only Immutable Audit Trail",
    content: "Every verification, reviewer approval, policy rollback, and role modification is permanently recorded in an append-only audit log protected against deletion or modification.",
    placement: "top",
    controlTip: {
      actionName: "Immutable Event Log",
      description: "Tamper-evident record of all compliance actions.",
      consequence: "Guarantees complete historical traceability and review history.",
    },
  },
  {
    id: "audit-export",
    targetSelector: '[data-tour="audit-export-btn"]',
    title: "Export Audit Ledger",
    content: "Download complete structured JSON audit logs and governance event histories for compliance reviews and inspection reporting.",
    placement: "left",
  },
];

export const SETTINGS_TOUR_STEPS: TourStep[] = [
  {
    id: "set-tabs",
    targetSelector: '[data-tour="settings-tabs"]',
    title: "Workspace Settings Tabs",
    content: "Manage General Organization Profile, Team Members, Custom Roles & Permissions, and Diagnostic Tools.",
    placement: "bottom",
  },
  {
    id: "set-roles-tab",
    targetSelector: '[data-tour="roles-permissions-tab"]',
    title: "Custom Roles & Permissions Management",
    content: "Create granular, custom roles for your workspace, select from 34 enterprise permissions, and assign roles to active members.",
    placement: "bottom",
    controlTip: {
      actionName: "Roles & Permissions Governance",
      description: "Controls team access to submissions, claim verification, and policies.",
      consequence: "Sole-admin protection prevents accidental lockout or deletion of the last administrator.",
    },
  },
  {
    id: "set-invite-btn",
    targetSelector: '[data-tour="invite-member-btn"]',
    title: "Invite Workspace Members",
    content: "Send transactional email invitations to colleagues with assigned built-in or custom roles.",
    placement: "bottom",
  },
];

// ---------------------------------------------------------------------------
// 2. ROLE-SPECIFIC COMPREHENSIVE TOURS
// ---------------------------------------------------------------------------

export const ROLE_TOUR_CONFIGS: Record<ReviewerRole, RoleTourConfig> = {
  admin: {
    role: "admin",
    roleDisplayName: "Workspace Administrator",
    responsibilities: [
      "Configure organization settings and active workspaces",
      "Manage team memberships, custom roles, and permissions",
      "Upload clinical dossiers and manage approved product catalogs",
      "Author and publish regulatory compliance policies",
      "Audit immutable event records and reviewer determination histories",
    ],
    workflowSummary:
      "As an Administrator, you possess full governance authority. Your workflow begins with setting up products and clinical evidence, configuring regulatory policies, inviting team members, and overseeing published marketing assets.",
    steps: [
      {
        id: "admin-1-dashboard",
        targetSelector: '[data-tour="workspace-indicator"]',
        pageRoute: "/dashboard",
        title: "1. Organization Health & Active Workspace",
        content: "Welcome, Administrator. Start on your dashboard to monitor total claims analyzed, active publication gates, and team throughput.",
        placement: "bottom",
      },
      {
        id: "admin-2-kpis",
        targetSelector: '[data-tour="kpi-cards"]',
        pageRoute: "/dashboard",
        title: "2. Real-Time Governance Metrics",
        content: "Monitor the 5 core compliance KPIs. Pay close attention to Contradicted Claims and Awaiting Human Review to identify bottlenecks.",
        placement: "bottom",
      },
      {
        id: "admin-3-products",
        targetSelector: '[data-tour="register-product-btn"]',
        pageRoute: "/products",
        title: "3. Establish Product Catalogs & Facts",
        content: "Register proprietary products with active ingredient concentrations and retail pricing. These serve as ground-truth facts for AI verification.",
        placement: "bottom",
      },
      {
        id: "admin-4-evidence",
        targetSelector: '[data-tour="upload-evidence-btn"]',
        pageRoute: "/sources",
        title: "4. Ingest Clinical Evidence Dossiers",
        content: "Upload clinical trial studies and certificates. The engine extracts passages and generates verifiable truth anchors for marketing assertions.",
        placement: "bottom",
      },
      {
        id: "admin-5-policies",
        targetSelector: '[data-tour="create-policy-btn"]',
        pageRoute: "/policies",
        title: "5. Author Compliance Policies",
        content: "Enforce brand rules and legal prohibitions. Define rules that require human review when superlative terms like 'miracle' or 'guarantee' appear.",
        placement: "bottom",
      },
      {
        id: "admin-6-settings",
        targetSelector: '[data-tour="roles-permissions-tab"]',
        pageRoute: "/settings",
        title: "6. Roles, Team & Access Control",
        content: "Manage team members, invite new staff, and configure custom roles with granular permissions tailored to your organization.",
        placement: "bottom",
      },
      {
        id: "admin-7-audit",
        targetSelector: '[data-tour="audit-events-table"]',
        pageRoute: "/audit",
        title: "7. Tamper-Evident Audit Trail",
        content: "Every compliance action, role assignment, and policy publication is immutably recorded for regulatory disclosure and inspection.",
        placement: "top",
      },
    ],
  },

  compliance_reviewer: {
    role: "compliance_reviewer",
    roleDisplayName: "Compliance Reviewer",
    responsibilities: [
      "Review flagged marketing claims in the triage queue",
      "Reconcile marketing copy assertions against clinical study findings",
      "Execute Approve, Reject, or Modify determinations with documented rationale",
      "Ensure unverified or contradicted assertions do not clear the publication gate",
    ],
    workflowSummary:
      "As a Compliance Reviewer, you are the front line of brand safety. Your primary workspace is the Review Queue, where you verify claims against scientific evidence dossiers and issue binding approvals.",
    steps: [
      {
        id: "cr-1-dashboard",
        targetSelector: '[data-tour="review-queue-link"]',
        pageRoute: "/dashboard",
        title: "1. Monitor Pending Claims",
        content: "Welcome, Compliance Reviewer. Your dashboard highlights claims requiring human review. Use this quick link to open the triage queue directly.",
        placement: "left",
      },
      {
        id: "cr-2-queue",
        targetSelector: '[data-tour="reviews-risk-filter"]',
        pageRoute: "/reviews",
        title: "2. Prioritize High-Risk Claims",
        content: "Filter the review queue by Critical and High risk. Critical claims directly contradict approved product facts and must be resolved first.",
        placement: "bottom",
      },
      {
        id: "cr-3-claim-details",
        targetSelector: '[data-tour="reviews-queue-table"]',
        pageRoute: "/reviews",
        title: "3. Inspect Evidence Citations",
        content: "Review side-by-side evidence citations from clinical trial dossiers (e.g. DG-CT-2025-04) to substantiate marketing assertions.",
        placement: "top",
      },
      {
        id: "cr-4-decisions",
        targetSelector: '[data-tour="reviews-decision-actions"]',
        pageRoute: "/reviews",
        title: "4. Issue Binding Decisions",
        content: "Approve supported claims, reject false assertions, suggest compliant phrasing with Modify, or Escalate ambiguous claims to Legal.",
        placement: "left",
      },
      {
        id: "cr-5-evidence",
        targetSelector: '[data-tour="evidence-list"]',
        pageRoute: "/sources",
        title: "5. Search Clinical Evidence Library",
        content: "Access the full library of active clinical dossiers and approved ingredient facts whenever you need deeper scientific context.",
        placement: "top",
      },
      {
        id: "cr-6-audit",
        targetSelector: '[data-tour="audit-events-table"]',
        pageRoute: "/audit",
        title: "6. Regulatory Traceability",
        content: "Your review determinations are permanently recorded under your authenticated identity and preserved in the append-only audit trail.",
        placement: "top",
      },
    ],
  },

  legal_reviewer: {
    role: "legal_reviewer",
    roleDisplayName: "Legal Reviewer",
    responsibilities: [
      "Evaluate high-liability marketing claims and regulatory escalations",
      "Review claims with superlative disclaimers and absolute guarantees",
      "Issue final legal determinations or resolve escalations from compliance",
      "Export compliance records for regulatory submissions and legal defense",
    ],
    workflowSummary:
      "As a Legal Reviewer, you oversee regulatory escalations and high-risk marketing statements. You evaluate legal disclaimers, resolve escalations, and protect the organization from regulatory enforcement.",
    steps: [
      {
        id: "lr-1-dashboard",
        targetSelector: '[data-tour="kpi-cards"]',
        pageRoute: "/dashboard",
        title: "1. Monitor Legal & Compliance Exposure",
        content: "Welcome, Legal Reviewer. Keep track of Contradicted Claims and items Awaiting Human Review to evaluate current exposure.",
        placement: "bottom",
      },
      {
        id: "lr-2-escalations",
        targetSelector: '[data-tour="reviews-risk-filter"]',
        pageRoute: "/reviews",
        title: "2. Resolve Escalations in Review Queue",
        content: "Filter for escalated items and evaluate claims containing superlative language or high regulatory liability.",
        placement: "bottom",
      },
      {
        id: "lr-3-decisions",
        targetSelector: '[data-tour="reviews-decision-actions"]',
        pageRoute: "/reviews",
        title: "3. Legal Decisions & Overrides",
        content: "Resolve escalations with documented legal rationale, or override contradictions where defensible substantiation exists.",
        placement: "left",
      },
      {
        id: "lr-4-policies",
        targetSelector: '[data-tour="policies-list"]',
        pageRoute: "/policies",
        title: "4. Policy & Disclaimer Review",
        content: "Inspect active regulatory policies, prohibited claims dictionaries, and version history to verify legal alignment.",
        placement: "top",
      },
      {
        id: "lr-5-audit-export",
        targetSelector: '[data-tour="audit-export-btn"]',
        pageRoute: "/audit",
        title: "5. Export Regulatory Audit Filings",
        content: "Download complete structured audit event ledgers and determination logs for governance reviews and regulatory reporting.",
        placement: "left",
      },
    ],
  },

  creator: {
    role: "creator",
    roleDisplayName: "Marketing Creator",
    responsibilities: [
      "Draft and submit marketing copy, campaign text, and social assets",
      "Link drafts to the correct proprietary product formulations",
      "Inspect AI-extracted claims and automated verification scorecards",
      "Correct unverified or contradicted statements to achieve publication clearance",
    ],
    workflowSummary:
      "As a Marketing Creator, you author compelling content backed by truth. BrandShield AI checks your copy in real time, flags unsupported assertions, and guides you to defensible language so your campaigns clear the publication gate.",
    steps: [
      {
        id: "creator-1-check",
        targetSelector: '[data-tour="check-content-btn"]',
        pageRoute: "/dashboard",
        title: "1. Check Marketing Content",
        content: "Welcome, Creator! Paste your draft copy here before launching any ad. The AI will extract assertions and verify them against facts.",
        placement: "bottom",
        interactiveActionText: "Try It: Open Form",
        interactiveActionId: "open-submission-modal",
      },
      {
        id: "creator-2-submissions",
        targetSelector: '[data-tour="create-submission-btn"]',
        pageRoute: "/submissions",
        title: "2. Manage Marketing Collaterals",
        content: "On the Submissions page, create new campaigns, specify marketing channels (Instagram, Website, Packaging), and review verification scorecards.",
        placement: "bottom",
      },
      {
        id: "creator-3-gate-status",
        targetSelector: '[data-tour="submissions-table"]',
        pageRoute: "/submissions",
        title: "3. Publication Gate Clearance",
        content: "Watch the publication status badge: 'Eligible' means all claims are substantiated and ready to launch; 'Blocked' means copy requires edits.",
        placement: "top",
      },
      {
        id: "creator-4-products",
        targetSelector: '[data-tour="products-table"]',
        pageRoute: "/products",
        title: "4. Reference Approved Product Facts",
        content: "Consult registered active ingredient concentrations and approved retail prices to craft accurate, high-converting claims.",
        placement: "top",
      },
      {
        id: "creator-5-evidence",
        targetSelector: '[data-tour="evidence-list"]',
        pageRoute: "/sources",
        title: "5. Explore Clinical Substantiations",
        content: "Learn what clinical trial results are approved for your brand so you can write powerful, fully substantiated copy with confidence.",
        placement: "top",
      },
    ],
  },

  viewer: {
    role: "viewer",
    roleDisplayName: "Executive & Read-Only Viewer",
    responsibilities: [
      "Inspect overall brand compliance scorecards and verified asset history",
      "Review published marketing campaigns and clinical evidence citations",
      "Monitor audit trails and regulatory filings with read-only access",
    ],
    workflowSummary:
      "As a Viewer, you have transparent, read-only oversight across the platform. You can monitor compliance KPIs, examine verified claims, and review the immutable audit trail.",
    steps: [
      {
        id: "viewer-1-dash",
        targetSelector: '[data-tour="kpi-cards"]',
        pageRoute: "/dashboard",
        title: "1. Executive Governance Dashboard",
        content: "Welcome! Your dashboard provides high-level executive visibility into claims analyzed, verification accuracy, and published assets.",
        placement: "bottom",
      },
      {
        id: "viewer-2-subs",
        targetSelector: '[data-tour="submissions-table"]',
        pageRoute: "/submissions",
        title: "2. Published Marketing Assets",
        content: "Review creative campaigns that have successfully cleared the BrandShield publication gate.",
        placement: "top",
      },
      {
        id: "viewer-3-evidence",
        targetSelector: '[data-tour="evidence-list"]',
        pageRoute: "/sources",
        title: "3. Scientific Evidence Dossiers",
        content: "Read-only access to clinical trial documents and research anchors that protect your brand equity.",
        placement: "top",
      },
      {
        id: "viewer-4-audit",
        targetSelector: '[data-tour="audit-events-table"]',
        pageRoute: "/audit",
        title: "4. Complete Audit Traceability",
        content: "Inspect the tamper-evident record of all regulatory determinations and system changes.",
        placement: "top",
      },
    ],
  },
};

// Map of page-specific tours for quick on-demand help
export const PAGE_TOURS: Record<string, PageTourConfig> = {
  "/dashboard": {
    pageRoute: "/dashboard",
    pageTitle: "Dashboard Walkthrough",
    description: "Learn how to monitor compliance KPIs and launch marketing checks.",
    steps: DASHBOARD_TOUR_STEPS,
  },
  "/submissions": {
    pageRoute: "/submissions",
    pageTitle: "Submissions & Claim Extraction",
    description: "Learn how to draft campaigns, view extracted claims, and track publication eligibility.",
    steps: SUBMISSIONS_TOUR_STEPS,
  },
  "/products": {
    pageRoute: "/products",
    pageTitle: "Product Catalog & Approved Facts",
    description: "Learn how proprietary product formulations and approved facts power AI verification.",
    steps: PRODUCTS_TOUR_STEPS,
  },
  "/sources": {
    pageRoute: "/sources",
    pageTitle: "Evidence Library & Dossiers",
    description: "Learn how to upload clinical trials and inspect truth anchor citations.",
    steps: EVIDENCE_TOUR_STEPS,
  },
  "/policies": {
    pageRoute: "/policies",
    pageTitle: "Compliance Policies & Simulation Studio",
    description: "Learn how to author regulatory constraints and simulate policy impact.",
    steps: POLICIES_TOUR_STEPS,
  },
  "/reviews": {
    pageRoute: "/reviews",
    pageTitle: "Review Queue & Governance Decisions",
    description: "Learn how human reviewers evaluate flagged claims, inspect evidence, and issue decisions.",
    steps: REVIEWS_TOUR_STEPS,
  },
  "/audit": {
    pageRoute: "/audit",
    pageTitle: "Append-Only Audit Trail",
    description: "Learn how every governance determination is permanently recorded and exported.",
    steps: AUDIT_TOUR_STEPS,
  },
  "/settings": {
    pageRoute: "/settings",
    pageTitle: "Workspace Settings & Custom Roles",
    description: "Learn how to manage team members, invite staff, and configure custom roles.",
    steps: SETTINGS_TOUR_STEPS,
  },
};
