# BrandShield AI — Evidence-Linked Marketing Claim Governance

> **Enterprise AI Brand Compliance & Verification Platform**  
> Built for regulated consumer goods, cosmetics, and wellness enterprises.  
> Benchmark Organization: **DermaGlow Skincare** | Status: **Production Ready (v1.0.0)**  
> Repository: [https://github.com/GANESHKUMAR2006/brandshield-ai](https://github.com/GANESHKUMAR2006/brandshield-ai)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features & Capabilities](#2-features--capabilities)
3. [Technology Stack](#3-technology-stack)
4. [Prerequisites](#4-prerequisites)
5. [Clone & Installation](#5-clone--installation)
6. [Environment Configuration Reference](#6-environment-configuration-reference)
7. [Supabase Database & Storage Setup](#7-supabase-database--storage-setup)
8. [AI Extraction & Verification Pipeline](#8-ai-extraction--verification-pipeline)
9. [Running the Application Locally](#9-running-the-application-locally)
10. [End-to-End Governance Workflow](#10-end-to-end-governance-workflow)
11. [Testing & Quality Verification](#11-testing--quality-verification)
12. [Production Deployment](#12-production-deployment)
13. [Known Limitations & Scope Boundaries](#13-known-limitations--scope-boundaries)
14. [Troubleshooting Guide](#14-troubleshooting-guide)
15. [Repository Structure](#15-repository-structure)

---

## 1. Project Overview

### 1.1 What BrandShield AI Does
**BrandShield AI** is an enterprise-grade marketing claim governance platform that automates the verification of advertising copy against authoritative scientific clinical trials, product specifications, approved promotional pricing, and statutory regulatory policies.

The system acts as a deterministic, auditable pre-publication gatekeeper between creative marketing teams and regulatory compliance officers, preventing unsubstantiated assertions from reaching public channels.

### 1.2 The Problem It Solves
Consumer healthcare, dermatological cosmetics, and wellness topicals operate under stringent regulatory oversight (FTC, FDA, ASA, CDSCO). Unsubstantiated claims expose enterprises to:
1. **Severe Regulatory & Class-Action Penalties:** Millions of dollars in false-advertising fines and competitor litigation under the Lanham Act.
2. **Review Gridlock:** Medical, Legal & Regulatory (MLR) review cycles take 3 to 14 business days per ad variant.
3. **The "LLM Wrapper" Trap:** Generic generative AI (ChatGPT, Claude, Gemini) cannot be trusted as compliance judges because LLMs are probabilistic word predictors that hallucinate clinical outcomes and provide non-deterministic verdicts that fail regulatory audits.

### 1.3 Intended Users & Personas
BrandShield AI is built for cross-functional collaboration across five enterprise roles:

| Role | System Identifier | Key Responsibilities |
| :--- | :--- | :--- |
| **Marketing Creator** | `creator` | Drafts marketing copy, creates submissions, triggers claim extractions, reviews evidentiary feedback. |
| **Compliance Reviewer** | `compliance_reviewer` | Forensic evaluator who inspects extracted assertions, verifies citations, requests phrasing modifications. |
| **Legal Counsel** | `legal_reviewer` | Adjudicates disease treatment boundaries, reviews competitor comparisons, exports compliance packages. |
| **Workspace Administrator** | `admin` | Provisions workspaces, manages custom roles and invitations, configures Policy Studio rulebooks, controls the publication gate. |
| **Executive Viewer** | `viewer` | Read-only access to audit logs, compliance velocity KPIs, and risk heatmaps. |

### 1.4 How AI Extraction, Deterministic Verification & Human Approval Work Together
BrandShield AI operates on a strict **Epistemological Separation Invariant**:

$$\mathbf{LLM\ Extracts\ Assertions} \quad \longrightarrow \quad \mathbf{Approved\ Data\ Supplies\ Evidence} \quad \longrightarrow \quad \mathbf{Deterministic\ Code\ Evaluates\ Truth}$$

1. **Extraction (AI Layer):** An ultra-fast LLM (Groq `openai/gpt-oss-20b`) parses raw unstructured marketing text into discrete, atomic claims (e.g. ingredient percentage, clinical outcome, pricing). It calculates exact UTF-16 character offsets pointing back to the verbatim source text. **The LLM is never asked whether the claim is true.**
2. **Evidence Retrieval (RAG Layer):** The system queries an approved evidentiary knowledge base (clinical trial dossiers, product facts) using hybrid vector embeddings (`pgvector`) and lexical keyword matching.
3. **Truth & Risk Evaluation (Deterministic Code Layer):** Eight purely deterministic TypeScript rule engines compare the extracted assertion against approved facts and policy rules. There are **zero LLM hallucinations** in the verdict. Closed verdicts: `SUPPORTED`, `CONTRADICTED`, `OUTDATED`, `UNVERIFIED`, or `NEEDS_REVIEW`.
4. **Human-in-the-Loop Governance (Human Layer):** An authorized reviewer evaluates evidentiary citations in a forensic split-screen workbench and records an immutable decision (`Approve`, `Reject`, `Escalate`, or `Modify`).
5. **Publication Gatekeeper (Security Layer):** A cryptographic backend gate programmatically blocks copy from publication if any active claim remains unverified, contradicted, or unreviewed.

---

## 2. Features & Capabilities

### 2.1 Implemented Features

- **Authentication & Multi-Tenant Workspaces:**
  - Supabase Auth integration (`@supabase/ssr`) with cookie-based session isolation.
  - Multi-tenant architecture with strict PostgreSQL Row-Level Security (RLS) scoping data per workspace.
  - Workspace creation, slug conflict handling, organization join codes, and administrative join request approval workflows.
- **Invitations & Role-Based Access Control (RBAC):**
  - Token-based email invitations with expiration timestamps and single-use security.
  - 5 built-in roles (`admin`, `compliance_reviewer`, `legal_reviewer`, `creator`, `viewer`).
  - Custom roles engine with granular permissions (`claims:review`, `evidence:manage`, `policies:edit`, `audit:export`).
- **Marketing Submission & Claim Extraction:**
  - Rich multi-variant copy submissions across social, email, packaging, and digital channels.
  - High-speed claim extraction via Groq cloud inference (`openai/gpt-oss-20b`) with deterministic offset calculation.
  - Character offset resolution supporting emoji surrogate pairs, multi-currency symbols (₹, $, €, £, ¥), and sequential duplicate phrasing.
- **Evidence Library & Document Ingestion:**
  - Multi-format ingestion for Clinical Dossiers, Lab Reports, Certificates of Analysis, and Studies.
  - Supported document formats: **PDF** (digital text streams) and **DOCX** (structured XML paragraphs and Markdown pipe tables).
  - Sentence-aware sliding-window chunker preserving section hierarchy and page numbers.
- **Product Facts & Promotional Pricing Engine:**
  - Product SKU catalogue registry with reference pricing and category taxonomy.
  - Approved scientific facts repository with temporal validity windows (`valid_from`, `valid_until`).
  - Decimal-safe promotional discount calculation using integer paise math to eliminate floating-point drift.
- **Evidence Retrieval & Split-Screen Citations:**
  - Hybrid RAG retrieval weighting vector cosine similarity (70%) and lexical keywords (30%).
  - Split-screen forensic viewer rendering source documents alongside claims with color-coded passage highlighting (Green = Supporting, Red = Contradictory, Amber = Contextual).
- **Deterministic Verification Engine (8 Rules):**
  - *Rule 1: Ingredient Concentration Verification*
  - *Rule 2: Clinical Efficacy & Metric Substantiation*
  - *Rule 3: Promotional Pricing & Discount Validity*
  - *Rule 4: Comparative Advertising & Competitor Denigration*
  - *Rule 5: Absolute Language & Unconditional Guarantees*
  - *Rule 6: Prohibited Medical & Disease Treatment Boundaries*
  - *Rule 7: Temporal & Expiration Horizon Boundaries*
  - *Rule 8: Mandatory Regulatory Disclaimers*
- **Policy Studio:**
  - Interactive policy management with versioning (`draft`, `active`, `archived`) and immutable snapshots.
  - Abstract Syntax Tree (AST) policy evaluation rules engine.
  - Zero-side-effect in-memory simulation sandbox to test draft policies against historical submissions.
- **Human Review Workbench:**
  - Structured decision controls: `Approve`, `Reject`, `Escalate`, `Modify`.
  - Enforced policy override reasons: Contradicted or high-risk claims require a mandatory 10+ character legal justification.
  - Copy modification engine: Modifying a claim automatically archives the old claim and triggers automated re-verification of the replacement text.
- **Enforced Publication Gate:**
  - Cryptographic backend lock blocking non-compliant marketing copy.
  - Publication is strictly denied if any active claim is unreviewed, rejected, escalated, unverified, or contradicted.
- **Immutable PostgreSQL Audit Trail:**
  - Append-only audit ledger recording every extraction, verification verdict, and reviewer action.
  - Protected by a PostgreSQL trigger (`trg_audit_events_immutability`) that rejects `UPDATE` and `DELETE` queries.
- **Dashboard & Interactive Guided Onboarding:**
  - Executive KPI analytics (Compliance Velocity, Risk Distribution, Active Claims).
  - 7-step interactive guided tour walking first-time users through the entire compliance lifecycle.

### 2.2 Incomplete or Unsupported Functionality (Explicit Boundaries)
- **OCR for Scanned / Image-Only PDFs:** Optical Character Recognition is currently not deployed. Scanned image PDFs without a digital text layer are rejected with an explicit error (`Scanned or image-only PDF detected`).
- **CSV & Excel Spreadsheet Ingestion:** Tabular spreadsheets (`.csv`, `.xlsx`) are not currently supported in the Evidence Library.
- **Standalone Image Ingestion:** Raw image files (`.png`, `.jpg`) without document context are unsupported.
- **OAuth & SAML Single Sign-On:** Authentication currently utilizes email/password and token-based invitations; enterprise SAML/Okta SSO is on the future roadmap.

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose in BrandShield AI |
| :--- | :--- | :--- | :--- |
| **Web Framework** | [Next.js](https://nextjs.org/) | `16.4.5` | App Router, Server Components, Route Handlers, Turbopack |
| **UI Library** | [React](https://react.dev/) | `19.3.0` | Declarative UI, Concurrent Rendering, Server Actions |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `v4.x` | Modern utility-first responsive styling and dark mode |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `v5.8` | Strict-mode end-to-end type safety |
| **Database** | [Supabase](https://supabase.com/) PostgreSQL | `17.x` | Relational tables, `pgvector`, RLS policies, immutability triggers |
| **Database Client** | [node-postgres (`pg`)](https://node-postgres.com/) | `8.23.1` | Direct connection pooling with transaction isolation (`withTransaction`) |
| **Auth Client** | `@supabase/ssr` / `@supabase/supabase-js` | `0.12.7` / `2.119.0` | Server/client session handling and cookie management |
| **Primary AI Provider** | [Groq SDK](https://console.groq.com/) | `openai/gpt-oss-20b` | Ultra-low latency cloud inference for structured claim extraction |
| **Alternative AI** | [Ollama](https://ollama.com/) / [OpenAI](https://openai.com/) | `qwen3:4b` / `gpt-4o` | Local/offline LLM inference and cloud fallback |
| **RAG Embeddings** | [OpenAI Embeddings](https://platform.openai.com/) | `text-embedding-3-small` | 1536-dimensional vector generation matching `vector(1536)` |
| **Document Parsers** | `pdf-parse`, custom XML extractor | Latest | Digital PDF text extraction and DOCX table parsing |
| **Schema Validation** | [Zod](https://zod.dev/) | `4.6.7` | Strict runtime payload and extraction output validation |
| **Email Service** | [Nodemailer](https://nodemailer.com/) | `10.5.0` | SMTP transactional email and invitation delivery |
| **Icons** | [Lucide React](https://lucide.dev/) | `1.70.0` | Consistent iconography across workbenches |

---

## 4. Prerequisites

Before installing, ensure your workstation meets the following requirements:

1. **Node.js:** `v20.9.0` or `v22.x` (LTS recommended). Check with `node -v`.
2. **npm:** `v10.x` or later. Check with `npm -v`.
3. **Git:** Check with `git --version`.
4. **Supabase Account:** Access to a Supabase project (Free tier works perfectly).
5. **Groq API Key:** Free cloud inference key from [console.groq.com/keys](https://console.groq.com/keys).
6. **(Optional) OpenAI API Key:** Required only if using live cloud vector embeddings (`EMBEDDING_PROVIDER="openai"`). Local development can use `EMBEDDING_PROVIDER="mock"` with zero OpenAI dependency.

---

## 5. Clone & Installation

### Step 1: Clone the GitHub Repository
```bash
git clone https://github.com/GANESHKUMAR2006/brandshield-ai.git
cd brandshield-ai
```

### Step 2: Verify Working Branch
```bash
git checkout main
git pull origin main
```

### Step 3: Install Dependencies
```bash
npm install
```

---

## 6. Environment Configuration Reference

BrandShield AI separates public frontend configuration from sensitive server-side secrets. Create your local environment file:

```bash
cp .env.example .env.local
```

### Complete Environment Variable Reference Table

| Variable Name | Required? | Default / Example Value | Browser Safe? | Description & Acquisition Source |
| :--- | :---: | :--- | :---: | :--- |
| `NEXT_PUBLIC_APP_NAME` | No | `"BrandShield AI"` | **Yes** | Display title rendered in UI navigation and page headers. |
| `NEXT_PUBLIC_APP_URL` | Yes | `"http://localhost:3000"` | **Yes** | Root URL for generating invitation links and CORS validation. |
| `NEXT_PUBLIC_APP_ENV` | No | `"development"` | **Yes** | Environment mode (`development`, `staging`, `production`). |
| `NEXT_PUBLIC_DEFAULT_WORKSPACE` | No | `"DermaGlow"` | **Yes** | Default initial workspace slug for showcase routing. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | `https://[ref].supabase.co` | **Yes** | Supabase Project URL (*Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API*). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | `eyJhbGciOiJIUzI1Ni...` | **Yes** | Supabase anonymous public key for client-side queries. |
| `SUPABASE_DATABASE_URL` | **Yes** | `postgresql://postgres:[pwd]@db.[ref].supabase.co:5432/postgres` | **NO (Server Only)** | PostgreSQL direct connection pool URI (*Settings $\rightarrow$ Database $\rightarrow$ URI*). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `eyJhbGciOiJIUzI1Ni...` | **NO (Server Only)** | Privileged service key for background admin maintenance. |
| `ALLOW_DEMO_AUTH` | No | `"true"` | **NO (Server Only)** | Enables quick-switch reviewer personas for evaluators. |
| `LLM_PROVIDER` | **Yes** | `"groq"` | **NO (Server Only)** | Active extraction provider (`groq`, `openai`, `ollama`, `mock`). |
| `GROQ_API_KEY` | **Yes** (if Groq) | `gsk_...` | **NO (Server Only)** | Groq Cloud API key from [console.groq.com/keys](https://console.groq.com/keys). |
| `GROQ_MODEL` | No | `"openai/gpt-oss-20b"` | **NO (Server Only)** | High-speed open-weights extraction model on Groq. |
| `GROQ_BASE_URL` | No | `https://api.groq.com/openai/v1` | **NO (Server Only)** | Groq OpenAI-compatible inference endpoint. |
| `EMBEDDING_PROVIDER` | **Yes** | `"mock"` (or `"openai"`) | **NO (Server Only)** | Embedding engine: `mock` for local zero-cost testing, `openai` for production. |
| `OPENAI_API_KEY` | Optional | `sk-...` | **NO (Server Only)** | OpenAI API key (required if `EMBEDDING_PROVIDER="openai"` or `LLM_PROVIDER="openai"`). |
| `EMBEDDING_MODEL` | No | `"text-embedding-3-small"` | **NO (Server Only)** | Vector model producing 1536-dimensional embeddings. |
| `EMAIL_PROVIDER` | No | `"gmail"` (or `"resend"`) | **NO (Server Only)** | Transactional email provider (`gmail`, `resend`, `qa_capture`). |
| `SMTP_HOST` | Optional | `"smtp.gmail.com"` | **NO (Server Only)** | SMTP server hostname for invitation dispatch. |
| `SMTP_PORT` | Optional | `"587"` | **NO (Server Only)** | SMTP submission port. |
| `SMTP_USER` | Optional | `your-email@gmail.com` | **NO (Server Only)** | SMTP authenticated username. |
| `SMTP_PASS` | Optional | `your-app-password` | **NO (Server Only)** | SMTP password or 16-character Google App Password. |
| `QA_EMAIL_CAPTURE` | No | `"true"` (dev) / `"false"` (prod) | **NO (Server Only)** | When `true`, captures emails to memory instead of dispatching SMTP. |

> [!WARNING]
> **Security Rules:** Never prefix database connection strings, API tokens, or SMTP passwords with `NEXT_PUBLIC_`. Any variable starting with `NEXT_PUBLIC_` is readable by end users in the browser console.

---

## 7. Supabase Database & Storage Setup

BrandShield AI uses Supabase PostgreSQL 17 for all relational state, full-text indexing, vector search, and audit history.

### Step 7.1: Create Supabase Project
1. Go to [https://database.new](https://database.new) and create a new project.
2. Record your **Database Password** securely.

### Step 7.2: Enable PostgreSQL Extensions
Open the **SQL Editor** in Supabase and execute:
```sql
-- Enable pgvector for 1536-dimensional evidence embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generator functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Step 7.3: Apply Database Migrations & Seed Data
BrandShield AI maintains 16 transactional migrations in `supabase/migrations/`. Choose the appropriate setup command:

#### Option A: Fresh Local Setup (Migrations + Demo Dataset)
For a new local development setup or demonstration environment, run:

```bash
npm run db:seed
```

This automated runner:
1. Connects to `SUPABASE_DATABASE_URL` with SSL.
2. Creates the `_schema_migrations` tracking table if not present.
3. Applies all 16 migrations sequentially inside atomic transactions:
   - `20261105000000_initial_schema.sql` (Core tables: workspaces, products, approved_facts, promotions, audit_events)
   - `20261105010000_phase3_submissions_enhancements.sql` (Submissions and versioning)
   - `20261105020000_phase4_extraction_engine.sql` (Claims and character offset bounds)
   - `20261105030000_phase5_verification_engine.sql` (Verification runs and claim evidence)
   - `20261105040000_phase6_review_workflow.sql` (Review decisions and publication gates)
   - `20261105050000_phase7_evidence_intelligence.sql` (Document chunks and pgvector cosine index)
   - `20261105060000_phase8_admin_analytics.sql` (Audit logging triggers and analytics functions)
   - `20261105070000_phase9_policy_intelligence.sql` (Compliance policies and rules)
   - `20261110000000_round3_multi_tenancy.sql` (Workspace memberships and tokenized invitations)
   - `20261111000000_round3_phase2_citations.sql` (Granular section and passage citations)
   - `20261112000000_round3_phase3_policy_studio.sql` (Policy Studio draft versions and simulation)
   - `20261113000000_workspace_lifecycle_archival.sql` (Workspace status and archival soft-deletes)
   - `20261114000000_organization_join_requests.sql` (Join codes and access requests)
   - `20261115000000_permanent_tenant_isolation_rls.sql` (Strict tenant-scoped RLS policies)
   - `20261116000000_distributed_rate_limiting.sql` (Rate limiters for auth and API routes)
   - `20261117000000_custom_roles_and_permissions.sql` (Custom roles and permission matrices)
4. Applies `supabase/seed.sql` to populate DermaGlow products, clinical trials, and approved scientific facts.
5. Verifies audit log immutability triggers.

#### Option B: Incremental / Existing Environment (DDL Schema Migrations Only)
If you already have data in your database or are deploying schema changes to a shared staging or production database, execute **only** the pending DDL migrations without running `seed.sql`:

```bash
node --env-file=.env.local scripts/apply-pending-migrations.js
```

### Step 7.4: Seed Verified Enterprise Accounts (Local / Staging Only)
Seed the verified reviewer accounts into Supabase Auth (`auth.users`):

```bash
npm run db:seed:auth
```

> [!CAUTION]
> **Production Security Warning:** The `BrandShield2026!` password and evaluator accounts (`admin@dermaglow.com`, `elena.vance@dermaglow.com`, `marcus.brody@dermaglow.com`) are strictly synthetic accounts for local development and reviewer evaluation. **Never execute `db:seed:auth` or reuse these passwords in production.** Ensure `ALLOW_DEMO_AUTH="false"` in all production environments.

This creates the default enterprise reviewer accounts:

| Email | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin@dermaglow.com` | `BrandShield2026!` | `admin` | Full workspace governance, invitations, Policy Studio |
| `elena.vance@dermaglow.com` | `BrandShield2026!` | `compliance_reviewer` | Scientific claim inspection and modification |
| `marcus.brody@dermaglow.com` | `BrandShield2026!` | `legal_reviewer` | Regulatory risk, disclaimers, disease boundaries |

---

## 8. AI Extraction & Verification Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RAW MARKETING COPY                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AI EXTRACTION ENGINE (GROQ)                          │
│  Model: openai/gpt-oss-20b | Structured JSON Output | Zod Validation   │
│  Phase 10D: UTF-16 Character Bounds [text_start, text_end]             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Claims with Provenance
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   EVIDENCE RETRIEVAL & HYBRID RAG                      │
│  70% Vector Cosine Similarity (pgvector) + 30% Lexical Keyword Match   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               DETERMINISTIC VERIFICATION (ZERO LLMs)                   │
│  8 Pure TypeScript Domain Rules | Closed Verdicts: SUPPORTED / ...     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    HUMAN-IN-THE-LOOP WORKBENCH                         │
│  Approve / Reject / Escalate / Modify | Mandatory Overrides Rationale  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     FAIL-CLOSED PUBLICATION GATE                       │
│  100% Active Claims Must Be Approved -> Unlocks Document Publication   │
└────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Groq Cloud Inference
BrandShield AI standardizes on **Groq Cloud** for high-speed structured extraction:
- **Low Latency:** Typical extraction turnaround of 300ms–800ms for entire campaign texts.
- **Model:** `openai/gpt-oss-20b` (configured in `.env.local` via `GROQ_MODEL`).
- **Structured JSON Output:** Responses are constrained to a rigid schema and validated with Zod.

### 8.2 Phase 10D Character Offset Invariant
The extractor guarantees that extracted claims can be linked back to the exact string location in the source copy:

$$\text{marketing\_content.slice(text\_start, text\_end)} \equiv \text{claim\_text}$$

The offset engine handles surrogate-pair emojis (🧴, ✨, 🌟), multi-currency Unicode symbols (₹, €, ¥, £, $), and repeated claim occurrences sequentially without arbitrary guessing.

### 8.3 Separation of Verification from Extraction
Verification is **100% deterministic code**:
- The LLM never verifies truth.
- Product ingredient percentages are evaluated by mathematical range checks.
- Promotional discounts are evaluated in integer paise to eliminate floating-point arithmetic errors.
- Date validity is checked against UTC timestamps.
- Missing evidence strictly defaults to `UNVERIFIED` (Never false contradiction).

---

## 9. Running the Application Locally

Start the local Next.js development server:

```bash
npm run dev
```

1. Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.
2. The application will redirect to `/dashboard`.
3. Click **Sign In** in the top navigation or go to `/login`.
4. Sign in with:
   - **Email:** `admin@dermaglow.com`
   - **Password:** `BrandShield2026!`
5. The interactive guided tour modal will prompt you to explore the platform.

### Health Check Verification
To verify that all services (PostgreSQL, Groq AI, and Session resolution) are operating correctly:
```bash
curl http://localhost:3000/api/health
```
**Expected JSON Response:**
```json
{
  "status": "ok",
  "application": {
    "name": "BrandShield AI",
    "version": "1.0.0",
    "environment": "development"
  },
  "services": {
    "database": { "status": "connected", "latencyMs": 85 },
    "ai": { "provider": "groq", "model": "openai/gpt-oss-20b", "status": "reachable" }
  }
}
```

---

## 10. End-to-End Governance Workflow

Follow this 9-step workflow to experience the core product journey:

```
1. Access Workspace ──► 2. Submit Copy ──► 3. Extract Claims ──► 4. Retrieve Evidence
                                                                         │
8. Publication Gate ◄── 7. Human Review ◄── 6. Policy Check ◄── 5. Verify Claims
         │
         ▼
9. Immutable Audit Trail
```

### Step 1: Access Workspace (`/settings` or TopNav)
Verify that your active workspace is set to **DermaGlow**. You can create additional organizations or switch workspaces via the workspace switcher in the top navigation bar.

### Step 2: Create a Marketing Submission (`/submissions`)
1. Click **New Submission**.
2. Select **Scenario A: Compliant Launch** (or paste your own marketing copy).
3. Select the associated product (e.g. `DermaGlow Vitamin C Serum`).
4. Click **Create Submission**.

### Step 3: Extract Claims
1. Open the submission detail page.
2. Click **Extract Claims**.
3. Groq parses the copy, identifies atomic assertions, and highlights text spans.

### Step 4: Retrieve Supporting Evidence
1. The system matches claims against the **Evidence Library (`/sources`)**.
2. Hybrid RAG retrieves clinical study passages from approved dossiers (`DG-CT-2025-04`).

### Step 5: Verify Claims Deterministically
1. Click **Verify All Claims**.
2. Rule engines evaluate claims against ground truth facts. Supported claims are flagged with low risk; unsupported assertions receive `UNVERIFIED` or `CONTRADICTED`.

### Step 6: Apply Policy Studio Rules (`/policies`)
1. Active compliance policies are evaluated against each claim.
2. Absolute language triggers legal review mandates; medical/disease claims trigger critical violation warnings.

### Step 7: Human Review (`/reviews`)
1. Reviewers inspect claims in the compliance workbench.
2. Actions:
   - **Approve:** Approves supported claims.
   - **Reject:** Rejects false claims.
   - **Modify:** Replaces non-compliant phrasing with suggested defensible copy, automatically triggering re-verification.
   - **Override:** Requires a mandatory 10+ character documented legal rationale.

### Step 8: Check Publication Gate
1. Navigate back to the submission.
2. If all claims are approved, the **Publication Gate: ELIGIBLE** is unlocked.
3. If any claim is unreviewed, rejected, or contradicted, the **Publication Gate is LOCKED (Fail-Closed)**.

### Step 9: Inspect Audit History (`/audit`)
Inspect the append-only audit trail showing immutable timestamps, actor IDs, previous states, and cryptographic records.

---

## 11. Testing & Quality Verification

BrandShield AI maintains a comprehensive testing harness with over 200 automated assertions covering rule engines, RAG chunking, UTF-16 offsets, human reviews, and multi-tenant security gates.

> [!IMPORTANT]
> ### Test Database Isolation & Production Safety
> - **In-Memory Unit Suites (Zero DB Dependency):** Core test suites (`npm test`, `test:phase6:unit`, `test:phase7:unit`, `test:phase8:unit`, `test:phase9:unit`, `test:phase10d`, and `test:phase15`) execute **100% in-memory**. They do not require a database connection, create no network requests, and have zero side effects on any database.
> - **Live Database Integration Suites:** Scripts requiring database access (`test:phase3`, `test:phase4`, `test:phase5`, `test:db`, and `test-workspace-membership-regression.ts`) connect to the database specified by `SUPABASE_DATABASE_URL` in `.env.local`.
> - **Production Guardrail:** Never point `SUPABASE_DATABASE_URL` to a production database while running integration tests. Always use a dedicated local or development Supabase project for integration test execution.

### 11.1 Run All Core Test Suites
```bash
npm test
```
Runs Phase 15 (Reliability & Readiness), Phase 6 (Human Review Invariants), and Phase 10D (UTF-16 Claim Offsets). Total: **114 passing, 0 failed**.

### 11.2 Individual Test Suites

```bash
# 1. Workspace Membership & Multi-Tenant Regression Suite (22 tests)
npx tsx --env-file=.env.local scripts/test-workspace-membership-regression.ts

# 2. Phase 5 Deterministic Rule Verification Engine (22 tests)
npm run test:phase5

# 3. Phase 6 Human Review & Publication Gate Invariants (32 tests)
npm run test:phase6:unit

# 4. Phase 7 Evidence Ingestion, Chunking & RAG Retrieval (25 tests)
npm run test:phase7:unit

# 5. Phase 8 Audit Trail & Analytics Invariants (18 tests)
npm run test:phase8:unit

# 6. Phase 9 Policy Studio AST Engine (19 tests)
npm run test:phase9:unit

# 7. Phase 10D UTF-16 Surrogate Pair & Currency Offset Suite (75 tests)
npm run test:phase10d

# 8. PostgreSQL Connection & Latency Benchmark
npm run test:db
```

### 11.3 Static Analysis & Build Verification
```bash
# TypeScript strict compilation check (0 errors)
npx tsc --noEmit

# Production build verification (All 50 routes compiled)
npm run build
```

---

## 12. Production Deployment

### 12.1 Render Web Service Deployment

BrandShield AI is configured for deployment on [Render](https://render.com) as a Node.js Web Service:

1. **New Web Service:** Connect your GitHub repository (`https://github.com/GANESHKUMAR2006/brandshield-ai`).
2. **Runtime:** `Node` (Node.js 20+).
3. **Build Command:**
   ```bash
   npm run build
   ```
4. **Start Command:**
   ```bash
   npm run start
   ```
5. **Environment Variables:** Configure the production secrets specified in [Section 6](#6-environment-configuration-reference).
   - Ensure `SUPABASE_DATABASE_URL` uses the production Supabase connection pooler.
   - Render automatically injects `RENDER_EXTERNAL_URL`, which BrandShield AI uses for invitation links.
   - Set `NEXT_PUBLIC_APP_ENV="production"`.
   - Set `ALLOW_DEMO_AUTH="false"`.

---

## 13. Known Limitations & Scope Boundaries

- **Scanned PDF OCR:** Optical Character Recognition is not bundled in the current runtime. Uploaded PDFs must contain extractable digital text. Image-only PDFs are safely rejected.
- **Spreadsheet Files:** `.csv` and `.xlsx` document parsing is unsupported. Convert tabular datasets to Markdown pipe tables or structured DOCX before uploading.
- **Standalone Image Files:** `.jpg` and `.png` image uploads without document wrappers are not currently supported.
- **Authentication Method:** Current implementation uses email/password and single-use invitation tokens. SAML/OAuth SSO is planned for a subsequent release.
- **Groq Free Tier Quota:** Groq free-tier rate limits apply (approx. 14,400 tokens/min). For high-volume automated testing, set `LLM_PROVIDER="mock"`.

---

## 14. Troubleshooting Guide

### 1. `Missing Supabase configuration` Error
- **Cause:** `.env.local` is missing or variables lack values.
- **Solution:** Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in `.env.local` in the project root directory.

### 2. Database Connection Refused / Timeout
- **Cause:** Incorrect PostgreSQL password or paused Supabase project.
- **Solution:** Verify `SUPABASE_DATABASE_URL` credentials. Check Supabase Dashboard to confirm the project is active.

### 3. Port 3000 In Use
- **Cause:** Another local development process is running on port 3000.
- **Solution:** Start Next.js on an alternate port:
  ```bash
  npm run dev -- -p 3001
  ```

### 4. Groq API 401 Unauthorized
- **Cause:** Invalid or missing `GROQ_API_KEY`.
- **Solution:** Ensure a valid key from [console.groq.com/keys](https://console.groq.com/keys) is assigned to `GROQ_API_KEY` in `.env.local`.

### 5. Database Seed Idempotency
- **Cause:** Re-running migrations on an existing database.
- **Solution:** `npm run db:seed` uses `_schema_migrations` and `IF NOT EXISTS` guards. It is safe to re-run without wiping data.

---

## 15. Repository Structure

```
brandshield-ai/
├── src/
│   ├── app/                      # Next.js App Router routes & API endpoints
│   │   ├── (auth)/               # Login, register, forgot-password, invite routes
│   │   ├── api/                  # Backend REST API route handlers
│   │   │   ├── auth/             # Login, logout, session verification (/me, /user)
│   │   │   ├── claims/           # Extraction, verification, citations, evidence
│   │   │   ├── health/           # Health check & service telemetry
│   │   │   ├── policies/         # Policy CRUD, versioning, AST simulation
│   │   │   ├── sources/          # Evidence library ingestion & chunking
│   │   │   ├── submissions/      # Marketing copy submissions & publication gates
│   │   │   └── workspaces/       # Workspaces, custom roles, invitations, join codes
│   │   ├── audit/                # Immutable audit log inspection page
│   │   ├── claims/               # Global claim registry workbench
│   │   ├── dashboard/            # Executive KPI & compliance overview
│   │   ├── policies/             # Interactive Policy Studio page
│   │   ├── reviews/              # Human compliance review workbench
│   │   ├── settings/             # Workspace governance & team access control
│   │   └── sources/              # Evidence Library & document management
│   ├── components/               # Reusable React UI components
│   │   ├── auth/                 # AuthSessionContext & session provider
│   │   ├── dashboard/            # KPI cards & claim distribution charts
│   │   ├── layout/               # TopNav, Sidebar, AppLayout
│   │   ├── policies/             # Policy editor & simulation components
│   │   ├── reviews/              # Compliance decision workbench controls
│   │   ├── sources/              # Evidence upload & version history modals
│   │   ├── tour/                 # Guided onboarding walkthrough system
│   │   ├── ui/                   # Base UI elements (Button, Modal, Input, Badge)
│   │   └── workspace/            # Organization creation & invitation modals
│   └── lib/                      # Core business logic & backend domain services
│       ├── ai/                   # LLM providers (Groq, Ollama, OpenAI, Mock)
│       │   ├── extraction/       # Claim offset calculation & prompt templates
│       │   └── providers/        # Configured provider factory & SDK clients
│       ├── audit/                # Audit service & event logging
│       ├── auth/                 # Server session resolution, RBAC, cookies
│       ├── db/                   # PostgreSQL connection pool & transaction helper
│       ├── email/                # Nodemailer SMTP & invitation mail templates
│       ├── policy/               # Policy AST evaluation & rulebook compiler
│       ├── rag/                  # RAG ingestion, chunking, embeddings, retrieval
│       ├── supabase/             # Supabase client, server, and middleware wrappers
│       └── verification/         # 8 deterministic TypeScript verification rules
├── supabase/
│   ├── migrations/               # 16 ordered PostgreSQL schema migrations
│   └── seed.sql                  # Initial demonstration dataset (DermaGlow)
├── scripts/                      # Automated test harnesses & migration runners
│   ├── migrate-and-seed.js       # Transactional migration & seed executor
│   ├── seed-production-auth.js   # Supabase Auth verified reviewer accounts seed
│   ├── test-database-connection.js # DB connection benchmark
│   └── test-workspace-membership-regression.ts # Multi-tenant regression suite
├── docs/                         # Architecture guides, audit reports & handover specs
│   ├── LOCAL_SETUP.md            # Detailed local setup checklist
│   ├── BRANDSHIELD_MEMBERSHIP_BUGFIX_REPORT.md # Production bugfix verification
│   └── BRANDSHIELD_AI_COMPLETE_PROJECT_HANDOVER.md # Technical handover audit
├── package.json                  # Dependencies & npm scripts
├── next.config.ts                # Next.js compiler & partial prefetching config
├── tsconfig.json                 # TypeScript strict compiler configuration
└── .env.example                  # Safe environment variable configuration template
```

---

## License & Governance

Developed for the **BrandShield AI** platform demonstration.  
Regulatory policies and product clinical dossiers modeled after **DermaGlow Skincare**.  
All rights reserved © 2026.
