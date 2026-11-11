# BrandShield AI — Complete User Workflow & Judge Experience Guide

An operational manual, navigation handbook, and demonstration guide for **BrandShield AI (Round 3 Implementation)**.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
   - [Authentication & Login](#authentication--login)
   - [User Personas & Role-Based Access Control (RBAC)](#user-personas--role-based-access-control-rbac)
   - [Workspace & Organization Context](#workspace--organization-context)
   - [Landing Experience & Role-Adaptive Dashboard](#landing-experience--role-adaptive-dashboard)
2. [Application Navigation & Architecture](#2-application-navigation--architecture)
   - [Navigation Bar Overview](#navigation-bar-overview)
   - [Dashboard (`/`)](#dashboard-)
   - [Submissions (`/submissions`)](#submissions-submissions)
   - [Claims Library (`/claims`)](#claims-library-claims)
   - [Human Review Workbench (`/reviews`)](#human-review-workbench-reviews)
   - [Evidence & Knowledge Base (`/sources`)](#evidence--knowledge-base-sources)
   - [Policy Studio (`/policies`)](#policy-studio-policies)
   - [Audit & Compliance Trail (`/audit`)](#audit--compliance-trail-audit)
   - [Settings & Governance (`/settings`)](#settings--governance-settings)
3. [Adding a Company's Own Data (Ground Truth & Onboarding)](#3-adding-a-companys-own-data-ground-truth--onboarding)
   - [Summary Implementation Status (UI vs. API vs. Database)](#summary-implementation-status-ui-vs-api-vs-database)
   - [1. Product Catalog](#1-product-catalog)
   - [2. Brand & Regulatory Policies](#2-brand--regulatory-policies)
   - [3. Supporting Evidence & Scientific Dossiers](#3-supporting-evidence--scientific-dossiers)
   - [4. Promotional Terms & Commercial Disclaimers](#4-promotional-terms--commercial-disclaimers)
4. [Submitting Custom Marketing Content](#4-submitting-custom-marketing-content)
   - [Creating a Submission](#creating-a-submission)
   - [Distribution Channels & Policy Impact](#distribution-channels--policy-impact)
   - [Triggering AI Claim Extraction](#triggering-ai-claim-extraction)
   - [Exact Text Offsets & Claim Forensic View](#exact-text-offsets--claim-forensic-view)
5. [Understanding Claim Verification & Risk Analysis](#5-understanding-claim-verification--risk-analysis)
   - [Verification Verdicts](#verification-verdicts)
   - [Risk Levels & Risk Scoring](#risk-levels--risk-scoring)
   - [Confidence Scores & Verification Explanations](#confidence-scores--verification-explanations)
   - [Policy Violations & Guardrail Triggers](#policy-violations--guardrail-triggers)
   - [Promotional Claim Rules](#promotional-claim-rules)
6. [Human Review & Publication Gatekeeping](#6-human-review--publication-gatekeeping)
   - [The Human Review Queue](#the-human-review-queue)
   - [The 5 Review Decisions](#the-5-review-decisions)
   - [Claim Modification & Version Supersession](#claim-modification--version-supersession)
   - [The Fail-Closed Publication Gate](#the-fail-closed-publication-gate)
   - [Immutable Audit Logging](#immutable-audit-logging)
7. [Round 3 Advanced Capabilities Deep-Dive](#7-round-3-advanced-capabilities-deep-dive)
   - [Multi-Tenant Auth & Role-Based Workspaces](#multi-tenant-auth--role-based-workspaces)
   - [Evidence Citations & In-Document PDF / Coordinate Viewer](#evidence-citations--in-document-pdf--coordinate-viewer)
   - [Policy Studio (Visual Builder, AST Conditions & In-Memory Simulation)](#policy-studio-visual-builder-ast-conditions--in-memory-simulation)
8. [Complete First-Time User Walkthrough (15-Step Guide)](#8-complete-first-time-user-walkthrough-15-step-guide)
9. [Judge Demonstration Scenario (5–7 Minute Script)](#9-judge-demonstration-scenario-57-minute-script)
10. [First-Time User Quick-Start Checklist](#10-first-time-user-quick-start-checklist)

---

## 1. Getting Started

### Authentication & Login
BrandShield AI enforces strict session-based authentication backed by Supabase Auth and multi-tenant PostgreSQL schemas.

- **URL:** Navigate to `/login`.
- **Method 1: Quick Persona Login (Recommended for Judges):**
  The login screen features 3 pre-configured demo personas representing typical organizational roles. Clicking any persona button instantly signs in with appropriate session tokens and organization tenancy:
  1. **Dr. Elena Vance** (`elena.vance@dermaglow.com`) — *Medical / Clinical Reviewer*
  2. **Compliance Administrator** (`admin@dermaglow.com`) — *Admin / Global Authority*
  3. **Marcus Brody** (`marcus.brody@dermaglow.com`) — *Brand / Legal Reviewer*
- **Method 2: Email & Password:**
  Standard email and password credentials can be entered. If an account does not exist, the user must be invited by an Administrator via the Organization Settings modal.

### User Personas & Role-Based Access Control (RBAC)
BrandShield uses 4 RBAC roles that control navigation visibility, review capabilities, and administrative gates:

| Role | Target Persona | Review Permissions | Policy Studio | Publication Gate | User Management |
|---|---|---|---|---|---|
| **Admin** | Compliance Director / CCO | Approve, Reject, Override, Escalate, Modify | Full (Create, Edit, Rollback, Simulate) | Final Sign-off | Full (Invite, Change Role, Remove) |
| **Legal** | Corporate Legal Counsel | Approve, Reject, Override, Escalate, Modify | View, Simulate, Suggest | Required Sign-off | View Only |
| **Medical** | Clinical Scientist / Dermatologist | Approve, Reject, Override, Escalate, Modify | View, Simulate | Required Sign-off | View Only |
| **Reviewer / Creator** | Brand Marketer / Copywriter | View Only / Escalate | View Only | None (Blocked) | None |

### Workspace & Organization Context
BrandShield supports multi-tenancy out of the box:
- **Active Workspace:** Indicated in the top navigation bar (`TopNav.tsx`) next to the BrandShield shield logo. Default seed: **DermaGlow Clinical Skincare** (`dermaglow`).
- **Organization Switcher:** Clicking the workspace dropdown allows seamless switching between registered organizations.
- **Creating a New Organization:**
  Clicking `+ Create New Organization` in the switcher opens `CreateOrganizationModal.tsx`. Enter:
  - **Organization Name** (e.g., `Acuity BioTech`)
  - **Slug** (e.g., `acuity-biotech`, auto-generated URL-safe identifier)
  - **Custom Domain** (optional corporate SSO domain)
  Upon creation, the user is assigned the `Admin` role in the new tenant.

### Landing Experience & Role-Adaptive Dashboard
Upon logging in, users arrive at `/` (Dashboard). The dashboard dynamically updates its metric cards, risk distribution charts, review urgency counters, and system health status based on active claims in the workspace:
- **Active Submissions:** Total marketing packages undergoing verification.
- **Pending Human Reviews:** Claims requiring specialist adjudication.
- **Critical Policy Violations:** Flags requiring legal or clinical intervention.
- **Publication Readiness:** Percent of campaigns cleared through the fail-closed gate.

---

## 2. Application Navigation & Architecture

### Navigation Bar Overview
The persistent top navigation header (`src/components/layout/TopNav.tsx`) provides universal access to the 8 primary modules of BrandShield:

```
[ BrandShield Logo ]  [ Workspace: DermaGlow v ]  |  Dashboard  Submissions  Claims  Reviews  Sources  Policies  Audit  |  [ Help ]  [ User Persona: Admin v ]  [ Settings ]
```

---

### Dashboard (`/`)
- **Purpose:** High-level operational command center for brand managers and compliance executives.
- **Key Information Displayed:**
  - Executive KPI cards: Total Submissions, Extracted Claims, Verified Rate, Contradicted / Critical Flags, Pending Reviews.
  - Risk Distribution chart: Visual breakdown of claims across `low`, `medium`, `high`, and `critical` risk tiers.
  - Channel Breakdown: Distribution of marketing copy across `packaging`, `social_media`, `ecommerce`, `print`, `broadcast`, and `email`.
  - Recent Submissions table: Quick access to active campaigns, publication states, and quick-review triggers.
- **Primary Actions:**
  - Click `+ New Submission` in the header action group.
  - Click any submission row to view detailed verification breakdown.
  - Quick-filter dashboard metrics by 7-day, 30-day, or all-time time horizons.

---

### Submissions (`/submissions`)
- **Purpose:** Campaign and copy package management repository.
- **Key Information Displayed:**
  - Complete list of marketing submissions with Title, Target Channel, Associated Product, Current Status (`draft`, `in_review`, `approved`, `rejected`), Publication Status (`unpublished`, `published`), Claim Count, and Creation Timestamp.
  - Channel badge indicators (`packaging`, `social_media`, etc.).
  - Eligibility badge (`Publication Ready` vs `Blocked by 3 Claims`).
- **Primary Actions:**
  - `+ New Submission`: Opens `CreateSubmissionModal.tsx`.
  - Click row: Opens `SubmissionDetailModal.tsx` showing:
    - Raw Marketing Text with interactive character-offset claim highlighting.
    - Extracted Claims list with live verification verdicts.
    - Run Verification button (invokes Groq claim extraction and deterministic verification).
    - `Publish Submission` button (enforces the fail-closed publication gate).

---

### Claims Library (`/claims`)
- **Purpose:** Centralized, searchable repository of all atomic assertions extracted across all marketing submissions.
- **Key Information Displayed:**
  - Claims table: Claim Text, Verification Verdict (`supported`, `contradicted`, `unverified`, `promotional`), Risk Tier (`low`, `medium`, `high`, `critical`), Review Decision (`pending`, `approved`, `rejected`, `overridden`, `modified`, `escalated`), Source Submission, and Confidence Score.
  - Search & Filter bar: Full-text search across claim text, filter by risk level, verdict, review status, and product.
- **Primary Actions:**
  - Click claim row: Opens forensic inspection drawer detailing verification explanation, matched scientific facts, policy evaluation breakdown, and audit history.
  - Direct link to human review workbench for pending claims.

---

### Human Review Workbench (`/reviews`)
- **Purpose:** Dedicated specialist adjudication workstation for Legal, Medical, and Compliance reviewers.
- **Key Information Displayed:**
  - Review Queue: Filterable tabs for `Pending Review`, `Critical / High Risk`, `Escalations`, and `Completed`.
  - Claim Adjudication Card:
    - Claim exact text and context within original copy.
    - Verification verdict badge, confidence meter, and risk indicator.
    - AI-generated verification explanation.
    - Matched scientific evidence citations with source document name and section.
    - Triggered policy violations and severity flags.
- **Primary Actions:**
  - **View Citation:** Opens `CitationViewerModal.tsx` displaying in-document bounding box highlights and page coordinates.
  - **Approve:** Authorizes the claim for commercial publication.
  - **Reject:** Marks the claim as legally non-compliant, permanently blocking publication until copy is revised.
  - **Override:** Permits a reviewer to approve an unverified or contradicted claim, requiring a mandatory audit justification ($\ge 10$ characters).
  - **Modify:** Allows in-line editing of the claim copy, auto-generating an approved child claim and superseding the risky original claim.
  - **Escalate:** Routes the claim to specialized authorities (`medical`, `legal`, `regulatory`, `safety`, `marketing`, `executive`) with reviewer notes.

---

### Evidence & Knowledge Base (`/sources`)
- **Purpose:** The authoritative single source of truth (ground truth) against which all marketing claims are verified.
- **Structure:** 4 tabbed repositories:
  1. **Source Documents:** Clinical trial reports, laboratory dossiers, toxicological safety assessments, and regulatory filings (e.g., `DERM-2024-CLIN-001`).
  2. **Approved Facts:** Atomic, peer-reviewed scientific ground-truth statements with numeric parameters, study identifiers, and sample sizes (e.g., *"Reduces fine lines by 42% after 8 weeks"*).
  3. **Product Catalog:** Formal product master records, active formulations, and regulatory registration categories.
  4. **Promotions:** Commercial terms, promotional mechanics, discount percentages, and mandatory legal disclaimers.
- **Primary Actions:**
  - Search and filter evidence records across products and document types.
  - Click any document or fact to inspect publication dates, confidence scores, and clinical study methodologies.

---

### Policy Studio (`/policies`)
- **Purpose:** Compliance rule engine where organizations author, test, and manage brand guardrails and legal constraints.
- **Key Information Displayed:**
  - Active Policies list displaying Policy Code (e.g., `POL-DERMA-001`), Formal Name, Severity Level (`critical`, `high`, `medium`), Target Channels, and Status (`active`, `draft`, `deprecated`).
  - Authoritative policy registry (e.g., Clinical Evidence Standards, Superlative Claims Guardrail, SPF Compliance Policy).
- **Primary Actions:**
  - `+ Create Policy`: Opens Visual Policy Builder modal.
  - AST Condition Editor: Configure boolean rule conditions (`field`, `operator`, `value`).
  - **In-Memory Simulation Studio:** Test draft policies against historical or mock claims without database mutations.
  - **Version History & Rollback:** View previous policy iterations and revert to earlier versions with one click.
  - **Duplicate Policy:** Clone existing policies to adapt for new regulatory jurisdictions.

---

### Audit & Compliance Trail (`/audit`)
- **Purpose:** Immutable, tamper-evident regulatory log tracking every critical action in the system.
- **Key Information Displayed:**
  - Chronological event timeline: Timestamp, Actor (User email and role), Action Type (`claim_extracted`, `claim_verified`, `review_approved`, `review_overridden`, `claim_superseded`, `submission_published`), Target Entity ID, and SHA-256 cryptographic hash.
  - Diff view: Visual before-and-after state transitions for claim modifications and review overrides.
  - Metadata viewer: Complete JSON payload of system state at execution time.
- **Primary Actions:**
  - Filter audit stream by entity type (`submission`, `claim`, `policy`, `workspace`), action type, or date range.
  - Export audit trail as structured compliance evidence.

---

### Settings & Governance (`/settings`)
- **Purpose:** Workspace configuration, team management, and system diagnostic center.
- **Structure:** 3 tabbed panels:
  1. **General & Governance:** Organization name, slug, default risk thresholds, and fail-closed publication strictness.
  2. **Team & Members:** Active team roster, role assignments (`Admin`, `Legal`, `Medical`, `Reviewer`), and member removal.
     - *Action:* `Invite Member` modal (`InviteMemberModal.tsx`) with email and role selection.
  3. **Diagnostics & Tools:** Live system health checks, database connectivity status, Groq LLM API latency, and environment validation.

---

## 3. Adding a Company's Own Data (Ground Truth & Onboarding)

A critical requirement for any new enterprise or hackathon judge is understanding how to configure BrandShield for an organization's specific products, brand guidelines, and scientific evidence.

### Summary Implementation Status (UI vs. API vs. Database)

| Data Category | Implemented in UI? | Implemented in REST API? | Implemented via SQL / Seed? | Current Operational Method |
|---|---|---|---|---|
| **Product Catalog** | ❌ No creation UI | ⚠️ `GET /api/products` only (`POST` not implemented) | ✅ Yes (`products` table) | Direct SQL `INSERT` or Database Migration Seed |
| **Brand Policies** | ✅ Full Visual Builder (`/policies`) | ✅ `POST /api/policies` | ✅ Yes (`policies` table) | In-app Policy Studio UI or REST API |
| **Supporting Evidence** | ⚠️ Read-only UI (`/sources`) | ✅ `POST /api/sources/ingest` | ✅ Yes (`source_documents`, `approved_facts`) | Ingestion REST API or Direct SQL Insert |
| **Promotions** | ⚠️ Read-only UI (`/sources`) | ⚠️ Backend model exists | ✅ Yes (`promotions` table) | Direct SQL `INSERT` or Database Seed |

---

### 1. Product Catalog

#### Where it lives
- UI: `/sources` under the **Product Catalog** tab.
- Database: `public.products` table (`id`, `workspace_id`, `name`, `sku`, `category`, `description`, `created_at`).

#### Current Behavior & Limitations
- The UI under `/sources` &rarr; `Product Catalog` displays all registered products (e.g., *DermaGlow Age-Defying Retinol Serum*, *Hydra-Intensive Gel Cream*).
- **No Creation Button:** There is no "+ Add Product" button in the frontend.
- **API Limitation:** `src/app/api/products/route.ts` implements `GET` only; `POST /api/products` is not implemented in the current code release. Additionally, the GET endpoint is currently filtered to the default workspace slug (`dermaglow`).

#### How a New Organization Enters Its Own Products
To register products for a custom organization:
1. Run a direct SQL insert into the database connected to the active `workspace_id`:
```sql
INSERT INTO products (id, workspace_id, name, sku, category, description)
VALUES (
  gen_random_uuid(),
  'YOUR_WORKSPACE_UUID',
  'Acuity Renewal Night Complex',
  'ACU-RNC-001',
  'Anti-Aging Skincare',
  'Nighttime peptide and botanical restorative cream'
);
```
2. The newly registered product will immediately appear in the **Product Selector** dropdown when creating marketing submissions in `/submissions`.

---

### 2. Brand & Regulatory Policies

#### Where it lives
- UI: `/policies` (The Policy Studio).
- Database: `public.policies` table (`id`, `workspace_id`, `policy_code`, `name`, `description`, `rule_type`, `severity`, `channels`, `conditions`, `is_active`, `version`).

#### Current Behavior
- **Fully operational in UI:** Users can author, edit, simulate, duplicate, and rollback brand guidelines and compliance guardrails directly in the web application.

#### How a New Organization Enters Its Own Policies
1. Navigate to `/policies`.
2. Click the `+ Create Policy` button in the top right.
3. Fill in the **Visual Policy Builder** form:
   - **Policy Code:** Unique identifier (e.g., `POL-ACUITY-001`).
   - **Policy Name:** (e.g., *Mandatory Botanical Sourcing Substantiation*).
   - **Rule Type:** Select from `claim_restriction`, `evidence_requirement`, `disclaimer_requirement`, or `channel_restriction`.
   - **Severity:** Select `critical` (blocks publication automatically), `high`, `medium`, or `low`.
   - **Applicable Channels:** Check boxes for `packaging`, `social_media`, `ecommerce`, `print`, `broadcast`, or `all`.
   - **Condition Builder:** Add rule triggers:
     - Field: `claim_text`, `verdict`, `risk_level`, or `confidence`.
     - Operator: `contains`, `equals`, `matches_regex`, or `in`.
     - Value: Trigger keywords (e.g., `organic`, `100% natural`, `dermatologist recommended`).
4. **Test Before Publishing:** Click **Run Simulation** to execute the policy against sample marketing phrases in-memory.
5. Click **Save Policy**. The policy is immediately active and evaluated during claim extraction.

---

### 3. Supporting Evidence & Scientific Dossiers

#### Where it lives
- UI: `/sources` under **Source Documents** and **Approved Facts** tabs.
- Database: `source_documents`, `document_versions`, and `approved_facts` tables.

#### Current Behavior & Limitations
- The UI displays an authoritative list of documents and extracted facts with clinical parameters (sample size $N$, duration, statistical significance $p$-values).
- In the top header of `/sources`, an `+ Upload Evidence Dossier` button is displayed for visual layout, but in the current build it is an inactive UI trigger without an attached modal file-picker.

#### How a New Organization Ingests Evidence
BrandShield provides a dedicated backend ingestion endpoint (`POST /api/sources/ingest`) and relational database tables for evidence loading:

**Option A: Automated Ingestion via REST API**
Send a `POST` request to `/api/sources/ingest`:
```json
{
  "workspaceId": "YOUR_WORKSPACE_UUID",
  "document": {
    "title": "Acuity Clinical Study ACU-2025-01",
    "documentType": "clinical_study",
    "authors": ["Dr. J. Doe, MD", "Dermatology Research Labs"],
    "publishedDate": "2025-01-15",
    "content": "A double-blind randomized clinical trial of 50 participants demonstrated a 38% reduction in wrinkle depth over 6 weeks of nightly application (p < 0.01)."
  },
  "facts": [
    {
      "factText": "Reduces wrinkle depth by 38% after 6 weeks",
      "metric": "wrinkle depth reduction",
      "value": "38%",
      "confidence": 0.95,
      "pageNumber": 12,
      "sampleSize": 50,
      "studyDuration": "6 weeks"
    }
  ]
}
```

**Option B: Direct Database Ingestion**
Insert records into `source_documents` and `approved_facts`:
```sql
INSERT INTO source_documents (id, workspace_id, title, document_type, status)
VALUES ('doc-uuid', 'YOUR_WORKSPACE_UUID', 'Clinical Dossier ACU-2025', 'clinical_study', 'approved');

INSERT INTO approved_facts (id, workspace_id, document_id, fact_text, confidence)
VALUES ('fact-uuid', 'YOUR_WORKSPACE_UUID', 'doc-uuid', 'Reduces wrinkle depth by 38% after 6 weeks', 0.95);
```

---

### 4. Promotional Terms & Commercial Disclaimers

#### Where it lives
- UI: `/sources` under the **Promotions** tab.
- Database: `promotions` table (`id`, `workspace_id`, `product_id`, `title`, `promo_type`, `terms_text`, `start_date`, `end_date`, `active`).

#### Current Behavior & Limitations
- The UI displays promotional campaigns, discount terms, validity windows, and mandatory promotional disclaimers.
- There is no "+ Add Promotion" button in the frontend.

#### How a New Organization Enters Promotions
Insert promotion records directly into the database:
```sql
INSERT INTO promotions (id, workspace_id, product_id, title, promo_type, terms_text, start_date, end_date, active)
VALUES (
  gen_random_uuid(),
  'YOUR_WORKSPACE_UUID',
  'PRODUCT_UUID',
  'Spring Launch 20% Discount',
  'discount',
  'Valid on initial orders only. Discount automatically applied at checkout. Cannot be combined with clinical subscriptions.',
  '2026-03-01',
  '2026-04-30',
  true
);
```

---

## 4. Submitting Custom Marketing Content

BrandShield allows copywriters, brand managers, and legal reviewers to submit arbitrary marketing text across diverse distribution channels.

### Creating a Submission
1. Navigate to `/submissions`.
2. Click the `+ New Submission` button in the top right.
3. The `CreateSubmissionModal.tsx` modal appears with the following fields:
   - **Quick Presets (Demo Feature):** Click *Preset 1: Retinol Social Campaign*, *Preset 2: Packaging Claims*, or *Preset 3: Promotional Email* to auto-populate the form with tested clinical copy.
   - **Submission Title:** Enter a descriptive campaign name (e.g., *Summer Launch — Organic Glow Instagram Reel*).
   - **Distribution Channel:** Select the intended media channel (see below).
   - **Target Product:** Select the relevant product from the catalog dropdown.
   - **Marketing Content:** Paste or type the unverified marketing copy into the textarea.
4. Click **Create Submission**. The submission is created in `draft` status.

### Distribution Channels & Policy Impact
The selected channel directly alters verification sensitivity and policy enforcement:
- **`packaging`:** Strictest regulatory compliance (FDA/FTC packaging guidelines). Mandatory disclaimer placement and permanent substantiation requirements.
- **`social_media`:** Strictest promotional rules (FTC #ad influencer disclosure requirements, character-limited disclaimer mandates).
- **`ecommerce`:** Enforces ratings/reviews claims, star-rating substantiation, and promotional discount accuracy.
- **`broadcast` / `print`:** Enforces broadcast audio disclosure speed rules and print legible font-size constraints.
- **`email`:** Enforces CAN-SPAM requirements and commercial expiration notices.

### Triggering AI Claim Extraction
1. From `/submissions`, click on the newly created submission to open `SubmissionDetailModal.tsx`.
2. Click the **Extract & Verify Claims** button.
3. **Extraction Engine Execution:**
   - The system calls `POST /api/claims/extract`.
   - **Groq LLM (`openai/gpt-oss-20b`)** parses the marketing prose and decomposes complex sentences into discrete, atomic assertions.
   - For example, the sentence *"Our patented peptide serum delivers 42% wrinkle reduction in 8 weeks with 100% natural organic botanicals"* is decomposed into three distinct atomic claims:
     1. *"Delivers 42% wrinkle reduction in 8 weeks"* (Efficacy Claim)
     2. *"Features a patented peptide formula"* (Technical/Formulation Claim)
     3. *"100% natural organic botanicals"* (Ingredient Claim)

### Exact Text Offsets & Claim Forensic View
BrandShield never loses the relationship between atomic claims and the source marketing document:
- Every extracted claim stores exact character boundaries: `character_start` and `character_end`.
- In `SubmissionDetailModal.tsx`, the raw marketing content is rendered with interactive visual highlights.
- Clicking on any highlighted phrase in the original copy instantly scrolls to and highlights the corresponding claim card in the inspection list.
- Clicking any claim card highlights the exact sentence span in the original text, providing full contextual transparency for human reviewers.

---

## 5. Understanding Claim Verification & Risk Analysis

BrandShield's deterministic verification engine combines semantic embeddings with exact parameter matching against the approved evidence library.

### Verification Verdicts

Each claim is assigned one of four authoritative verdicts:

| Verdict | Meaning | Database Color | Publication Impact |
|---|---|---|---|
| **`supported`** | The claim's assertion is fully substantiated by peer-reviewed evidence in the approved library with matching metrics ($N$, %, timeframe). | Green | Eligible for publication once reviewed. |
| **`contradicted`** | The claim directly contradicts approved scientific facts (e.g., claiming 60% reduction when clinical trial established only 42%). | Red | Strictly blocked from publication. Requires human override or copy modification. |
| **`unverified`** | No approved clinical study, document, or trial record in the database substantiates the claim. | Amber | Strictly blocked from publication. Requires human override or copy modification. |
| **`promotional`** | The claim is a commercial offer, discount, guarantee, or pricing term rather than a clinical statement. | Purple | Verified against the `promotions` table for active date range and disclaimer presence. |

---

### Risk Levels & Risk Scoring

BrandShield assigns each claim an explicit risk category:
- **`low` (Green):** Factual, corroborated statement with low regulatory exposure.
- **`medium` (Yellow):** Substantiated statement that requires standard disclaimer or channel qualification.
- **`high` (Orange):** Unverified performance claim, aggressive superlative, or high-scrutiny channel copy.
- **`critical` (Red):** Contradicted scientific claim, severe medical/drug classification claim, unauthorized health benefit, or expired promotional term.

---

### Confidence Scores & Verification Explanations
- **Confidence Meter:** A normalized score from `0.00` to `1.00` indicating the semantic and factual similarity between the marketing assertion and the cited evidence fact.
- **AI-Generated Explanation:** Every claim card displays a natural-language clinical rationale explaining why the verdict was rendered. For example:
  > *"Claim asserts a 42% wrinkle reduction within 8 weeks. Clinical Study DERM-2024-CLIN-001 confirms a 42.4% reduction (N=50, p<0.01). All numeric parameters and study durations align exactly."*

---

### Policy Violations & Guardrail Triggers
If a claim triggers an active policy in Policy Studio, the violation is tagged directly to the claim card:
- Displays **Policy Code** (e.g., `POL-DERMA-002: Superlative Claims Guardrail`).
- Displays **Severity** (`critical`, `high`, `medium`).
- Displays **Required Action** (e.g., *"Remove unsubstantiated word 'miracle' or attach clinical trial proof"*).

---

### Promotional Claim Rules
Promotional claims undergo specialized dual verification:
1. **Commercial Term Validation:** Checked against active dates in `promotions` table.
2. **Mandatory Disclaimer Check:** Validates whether the marketing submission includes mandatory terms (e.g., *"Terms apply. Initial purchase only"*).

---

## 6. Human Review & Publication Gatekeeping

BrandShield is built around a human-in-the-loop governance model. AI proposes verdicts; certified human reviewers make authoritative legal and clinical decisions.

### The Human Review Queue
Navigate to `/reviews` to access the centralized review workbench:
- Filter queue by **Pending Review**, **High / Critical Risk**, or **Escalations**.
- Sort claims by creation date or risk severity.
- Select a claim to inspect the full marketing context, scientific citations, and policy flags.

---

### The 5 Review Decisions

Reviewers can execute one of 5 distinct actions on any claim:

```
                  ┌─────────────────────────────────────────┐
                  │          Claim In Review Queue          │
                  └────────────────────┬────────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   [ APPROVE ]   [ OVERRIDE ]     [ MODIFY ]     [ ESCALATE ]    [ REJECT ]
        │              │               │               │              │
   Claim Passed   Requires >= 10   Generates New    Routes to     Permanently
   for Campaign   Char Clinical    Child Claim &    Specialist    Blocks from
   Publication    Justification    Supersedes       Authority     Publishing
```

1. **Approve:**
   - Used when a claim is `supported` and complies with all policies.
   - Clears the claim for publication.
2. **Override:**
   - Used when a reviewer exercises expert clinical or legal discretion to authorize an `unverified` or `contradicted` claim.
   - **Mandatory Justification:** The system enforces a strict requirement: the reviewer must enter a documented reason of at least **10 characters** explaining why the override is legally permissible.
   - Logged with the reviewer's ID into the immutable audit trail.
3. **Modify (Supersession):**
   - Used when a claim has a minor factual or grammatical error that can be corrected on the spot.
   - Opens an inline text editor.
   - Generates a new, approved **child claim** while marking the original claim as `superseded`.
4. **Escalate:**
   - Routes complex claims to specialist oversight teams.
   - Reviewer selects from 6 escalation paths: `medical`, `legal`, `regulatory`, `safety`, `marketing`, or `executive`.
   - Requires reviewer commentary explaining the point of dispute.
5. **Reject:**
   - Formally rejects the claim as non-compliant.
   - Permanently blocks the marketing submission from being published until the marketing team submits a revised copy package.

---

### Claim Modification & Version Supersession
When a claim is modified:
- BrandShield maintains a strict immutable parent-child relationship:
  - Original claim: `status = 'modified'`, `superseded_by = [child_claim_id]`.
  - Child claim: `version = parent.version + 1`, `status = 'approved'`, `is_active = true`.
- The publication gate evaluates only **active, non-superseded** claims. This ensures historical traceability without permanently blocking publication of corrected copy.

---

### The Fail-Closed Publication Gate
BrandShield enforces a cryptographic, fail-closed gate at `src/lib/publication/gatekeeper.ts`:
- **The Golden Rule:** A marketing submission **CANNOT** be published unless 100% of its active claims have been explicitly reviewed and approved or overridden.
- **Fail-Closed Triggers:**
  - Any claim with review status `pending` &rarr; **BLOCKED**.
  - Any claim with review status `rejected` &rarr; **BLOCKED**.
  - Any claim with review status `escalated` &rarr; **BLOCKED**.
  - Any unresolved `critical` policy violation &rarr; **BLOCKED**.
- **Publication Execution:**
  - In `SubmissionDetailModal.tsx`, the `Publish Submission` button remains disabled with a clear count of blocking claims until all claims are cleared.
  - When all claims are approved, the button activates. Clicking it transitions the submission state:
    - `submissions.status = 'approved'`
    - `submissions.publication_status = 'published'`
    - Timestamp and approving user recorded in `published_at` and `published_by`.

---

### Immutable Audit Logging
Every review action generates an unalterable record in the `audit_logs` table:
- Actor email and active role.
- Entity ID and entity type (`claim`, `submission`, `policy`).
- Action name (`review_decision_approved`, `review_decision_overridden`, etc.).
- Complete before-and-after state snapshot.
- Cryptographic SHA-256 hash chaining each log entry to previous events.

---

## 7. Round 3 Advanced Capabilities Deep-Dive

Round 3 introduces three enterprise-grade modules that elevate BrandShield from a prototype to a production-ready compliance workstation:

### 1. Multi-Tenant Auth & Role-Based Workspaces
- **What it is:** Full multi-tenant isolation enabling brand holding companies or agencies to manage multiple discrete brands (e.g., *DermaGlow Clinical*, *Acuity BioTech*) in total data isolation.
- **Implemented Components:**
  - `src/components/workspace/WorkspaceSwitcher.tsx`: Instant tenant switching.
  - `src/components/workspace/CreateOrganizationModal.tsx`: Self-service organization onboarding.
  - `src/app/settings/page.tsx` &rarr; `Team & Members`: Enterprise RBAC administration.
  - `src/components/settings/InviteMemberModal.tsx`: Secure invitation workflow.

---

### 2. Evidence Citations & In-Document PDF / Coordinate Viewer
- **What it is:** Forensic visual evidence substantiation displaying the exact clinical document page and bounding box where a claim was proven.
- **Implemented Component:** `src/components/claims/CitationViewerModal.tsx`.
- **How to Experience It:**
  1. Navigate to `/reviews` or `/claims`.
  2. Click on any claim that cites evidence from `DERM-2024-CLIN-001`.
  3. Click the **View Citation** button.
  4. The modal renders:
     - The source document title and metadata.
     - The extracted clinical table or study paragraph.
     - **Exact page number** (e.g., *Page 4, Section 3.2*).
     - **Bounding box coordinate overlays** framing the exact clinical metrics ($N=50$, $42.4\%$, $p < 0.01$).
     - Statistical methodology and study duration details.

---

### 3. Policy Studio (Visual Builder, AST Conditions & In-Memory Simulation)
- **What it is:** A no-code visual IDE for compliance officers to author, test, and version regulatory rules.
- **Implemented Components:**
  - `src/app/policies/page.tsx`: Authoritative policy management workstation.
  - `src/components/policies/PolicyFormModal.tsx`: Visual condition authoring.
  - `src/components/policies/PolicySimulationModal.tsx`: Sandboxed AST simulation engine.
- **Key Features:**
  - **Visual AST Condition Builder:** Add recursive boolean criteria (`AND`/`OR`) evaluating claim text, channels, risk levels, and confidence scores.
  - **In-Memory Simulation Studio:** Test draft policies against simulated claims without persisting unwanted test records to the production database.
  - **One-Click Rollback & Duplication:** Revert modified policies to prior versions or clone rules across channels.

---

## 8. Complete First-Time User Walkthrough (15-Step Guide)

Follow this step-by-step path to experience the complete BrandShield compliance workflow from initial sign-in to immutable audit export:

1. **Sign In as Administrator:**
   Navigate to `/login`. Click the **Compliance Administrator** demo persona button. You are logged into the *DermaGlow Clinical Skincare* workspace.
2. **Explore the Command Center:**
   On the **Dashboard** (`/`), observe the live metrics: active campaigns, total claims, verified rate, and risk tier distribution.
3. **Review Knowledge Base & Clinical Truth:**
   Navigate to **Sources** (`/sources`). Inspect the *Source Documents* tab to view `DERM-2024-CLIN-001` (Retinol Clinical Study). Switch to *Approved Facts* to see the exact 42% efficacy metric.
4. **Inspect Compliance Guardrails:**
   Navigate to **Policies** (`/policies`). Locate policy `POL-DERMA-002` (*Superlative Claims Guardrail*) and observe its critical severity on superlative words.
5. **Create a Marketing Submission:**
   Navigate to **Submissions** (`/submissions`). Click `+ New Submission`.
6. **Use Preset 1 (Retinol Social Campaign):**
   In the modal, click the button labeled **Preset 1: Retinol Social Campaign**. Note how the title, social media channel, product, and marketing copy populate automatically.
7. **Submit the Campaign:**
   Click **Create Submission**. You are returned to the submissions list; locate your newly created draft submission and click it.
8. **Run AI Extraction & Verification:**
   Inside `SubmissionDetailModal.tsx`, click **Extract & Verify Claims**. Watch as Groq decomposes the marketing prose into atomic claims and verifies them in real time.
9. **Inspect Interactive Text Highlighting:**
   In the raw text preview, click on the highlighted phrase *"Reduces fine lines by 42% in 8 weeks"*. Observe how the corresponding claim card highlights below.
10. **Test the Fail-Closed Publication Gate:**
    Note that the **Publish Submission** button is currently **disabled**, displaying a notice: *"5 claims require human review before publication is permitted."*
11. **Open the Human Review Workbench:**
    Navigate to **Reviews** (`/reviews`). Locate the claims from your submission in the *Pending Review* queue.
12. **Forensic Evidence Inspection:**
    On the first claim (*"Reduces fine lines by 42%"*), click **View Citation**. Review the in-document bounding box overlay and clinical study parameters in `CitationViewerModal.tsx`.
13. **Approve Supported Claims:**
    Click **Approve** on the verified clinical claim.
14. **Exercise a Clinical Override with Justification:**
    Locate an unverified or disputed claim. Click **Override**. Notice the system enforces a mandatory justification field. Enter:
    `Clinically validated via internal dermatological patch testing protocol 2024.`
    Click **Confirm Override**.
15. **Verify Publication Clearance & Inspect Audit Trail:**
    - Return to `/submissions` and reopen your submission modal. With all claims approved or overridden, the **Publish Submission** button is now active.
    - Click **Publish Submission**. The status transitions to `Approved` and `Published`.
    - Navigate to **Audit** (`/audit`). Verify that every extraction, approval, override, and publication event is recorded in the immutable SHA-256 event stream.

---

## 9. Judge Demonstration Scenario (5–7 Minute Script)

This targeted demonstration script is optimized for hackathon evaluation panels, highlighting technical depth, regulatory rigor, and user experience.

### Minute 0:00 – 1:00 | The Problem & The Command Center
- **Action:** Open `/login`, click **Compliance Administrator**.
- **Spoken Script:**
  > *"Consumer healthcare and cosmetics brands face millions of dollars in FTC and FDA fines for unverified marketing claims. BrandShield AI is an intelligent, fail-closed compliance operating system that sits between marketing teams and commercial publication. Here on the Dashboard, compliance executives see real-time visibility over all active campaigns, risk tiers, and pending regulatory flags."*

### Minute 1:00 – 2:30 | The Ground Truth & Policy Studio
- **Action:** Click **Sources** (`/sources`), show `DERM-2024-CLIN-001`. Then click **Policies** (`/policies`).
- **Spoken Script:**
  > *"Unlike generic AI checkers, BrandShield evaluates claims strictly against an organization's authoritative ground truth — approved clinical trials, toxicological studies, and commercial terms. In Policy Studio, legal teams author deterministic guardrails using our Visual AST Builder. Let's look at POL-DERMA-002, which bans unsubstantiated superlatives. We can even simulate policies against draft copy in-memory without polluting our database."*

### Minute 2:30 – 4:00 | Ingestion, AI Extraction & Forensic Highlighting
- **Action:** Click **Submissions** (`/submissions`), click `+ New Submission`, click **Preset 1**, click **Create**, open submission modal, and click **Extract & Verify Claims**.
- **Spoken Script:**
  > *"A marketer submits a new Instagram campaign. In seconds, our Groq-powered extraction engine decomposes complex promotional paragraphs into discrete, atomic assertions with exact character start and end offsets. Notice how clicking a highlighted phrase in the copy pinpoints the exact clinical claim card below."*

### Minute 4:00 – 5:30 | In-Document Citations & Human Adjudication
- **Action:** Click **Reviews** (`/reviews`), select the claim, click **View Citation**. Then demonstrate **Override** and **Approve**.
- **Spoken Script:**
  > *"Here in the Review Workbench, medical and legal reviewers don't have to take the AI's word for it. Clicking 'View Citation' opens our in-document viewer, highlighting the exact page coordinate and clinical study table proving the claim. For unverified statements, reviewers can override the engine, but BrandShield enforces strict compliance: an override requires a documented clinical justification of at least 10 characters."*

### Minute 5:30 – 7:00 | Fail-Closed Gate & Cryptographic Audit Trail
- **Action:** Return to `/submissions`, demonstrate that **Publish** unlocks only when claims are resolved, click **Publish**, then navigate to `/audit`.
- **Spoken Script:**
  > *"BrandShield is strictly fail-closed: marketing copy can never be published while a single claim is pending, rejected, or unverified. Once all claims are cleared, one-click publication transitions the campaign to commercial status. Finally, every single action — extraction, confidence score, reviewer identity, override rationale, and publication timestamp — is permanently sealed in our SHA-256 cryptographic audit trail."*

---

## 10. First-Time User Quick-Start Checklist

Use this quick checklist to confirm environment readiness before commencing an evaluation:

- [ ] **Step 1: Sign In** — Navigate to `/login` and select a demo persona (`Dr. Elena Vance`, `Compliance Administrator`, or `Marcus Brody`).
- [ ] **Step 2: Check Workspace** — Confirm active organization displays `DermaGlow Clinical Skincare` in the top navigation bar.
- [ ] **Step 3: Verify Evidence** — Visit `/sources` and confirm clinical documents and approved facts are visible.
- [ ] **Step 4: Verify Policies** — Visit `/policies` and confirm the 6 pre-configured compliance policies are active.
- [ ] **Step 5: Create Campaign** — Visit `/submissions`, click `+ New Submission`, and choose **Preset 1**.
- [ ] **Step 6: Extract & Verify** — Open the submission and click **Extract & Verify Claims**.
- [ ] **Step 7: Inspect Evidence** — In `/reviews`, click **View Citation** to inspect in-document page coordinates.
- [ ] **Step 8: Adjudicate Claims** — Approve or override each claim (entering $\ge 10$ characters for overrides).
- [ ] **Step 9: Publish** — Return to the submission modal and verify the **Publish Submission** button is enabled.
- [ ] **Step 10: Inspect Audit** — Visit `/audit` to verify the complete cryptographic compliance log.

