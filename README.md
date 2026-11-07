# BrandShield AI — Evidence-Linked Marketing Claim Governance

> **Enterprise AI Brand Compliance & Verification Platform**  
> Built for regulated consumer goods, cosmetics, and wellness enterprises.  
> Demonstration Organization: **DermaGlow Skincare** | Status: **Production Ready (v1.0.0)**

---

## 1. Executive Overview

**BrandShield AI** is an enterprise brand compliance platform that automates the verification of marketing claims against authoritative scientific clinical trials, product dossiers, and regulatory policies.

In regulated industries like dermatological skincare, health, and consumer goods, unsubstantiated marketing claims risk massive regulatory fines, FTC/FDA sanctions, retailer delistings, and severe brand reputational damage. Marketing teams move quickly, but legal and compliance review is traditionally manual, slow, and error-prone.

BrandShield AI provides end-to-end automation with deterministic guarantees:
1. **AI Claim Extraction**: Automatically extracts atomic marketing assertions from copy using local Ollama (`qwen3:4b` / `llama3`) or cloud OpenAI (`gpt-4o`), computing exact, deterministic UTF-16 character offsets.
2. **Deterministic Evidence Verification**: Verifies claims against approved clinical trial data and product dossiers using **100% deterministic, rule-based logic**—with **zero LLM hallucinations in the verification verdict**.
3. **Automated Risk Scoring & Defensible Copy**: Evaluates compliance risk across 4 tiers (Critical, High, Medium, Low) and suggests legally defensible replacement phrasing.
4. **Human-in-the-Loop Review**: Provides compliance officers and legal counsel with structured review tools (Approve, Reject, Escalate, Modify).
5. **Enforced Publication Gate**: Enforces a strict cryptographic gatekeeper that programmatically blocks marketing copy from publication if any active claim remains unverified, contradicted, or rejected.
6. **Immutable Audit Trail**: Logs every extraction, verification run, and human decision into append-only PostgreSQL audit records.

---

## 2. Core Capabilities & User Journeys

### 1. Guided Demo Mode & Scenario Presets
Explore pre-configured compliance scenarios with one click:
- **Scenario A (Compliant Launch)**: Real clinical backing (10% Vitamin C, ₹1,999 Festival Glow price) $\rightarrow$ Verified Supported $\rightarrow$ Publication Approved.
- **Scenario B (Misleading Overclaim)**: Severe overclaim ("Cures eczema permanently overnight") $\rightarrow$ Verified Contradicted (Critical Risk) $\rightarrow$ Publication Strictly Blocked.
- **Scenario C (Unverified Clinical Claim)**: Unsubstantiated endpoint ("Reduces wrinkles by 95% in 7 days") $\rightarrow$ Verified Unverified/Needs Review $\rightarrow$ Requires Human Compliance Governance.

### 2. Deterministic Verification Engine (No Hallucinations)
- **Zero LLM inside the verification loop**: The LLM extracts assertions; deterministic TypeScript domain rules determine truth.
- **5 Closed Verification Verdicts**: `SUPPORTED`, `CONTRADICTED`, `OUTDATED`, `UNVERIFIED`, `NEEDS_REVIEW`.
- **Absence of Proof is Not Contradiction**: Missing evidence defaults strictly to `UNVERIFIED`, never false contradiction.
- **Decimal-Safe Currency Math**: Evaluates discounts and promotional pricing in integer paise to eliminate floating-point drift.
- **Temporal & Channel Boundaries**: Respects inclusive UTC date horizons and authorized marketing channels.

### 3. Claim Lifecycle Visualization
Visualizes each claim's journey through a 4-stage stepper:
$$\text{Extracted} \longrightarrow \text{Verified} \longrightarrow \text{Human Review} \longrightarrow \text{Publication Gate}$$

### 4. Presenter View & System Diagnostics
- **Presenter View**: Split-screen demo console designed for evaluators and live stage presentations.
- **Health Diagnostics**: Real-time modal inspecting Supabase PostgreSQL connectivity and local Ollama model reachability with secret sanitization.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js](https://nextjs.org/) 16.4.5 (App Router, Server Components & Route Handlers) |
| **UI Library & Styling** | [React](https://react.dev/) 19.3.0, [Tailwind CSS](https://tailwindcss.com/) v4 |
| **Language & Typing** | [TypeScript](https://www.typescriptlang.org/) v5 (Strict Mode, 0 errors) |
| **Database & Pooling** | [Supabase](https://supabase.com/) PostgreSQL 17 with `pgvector`, `pg` connection pool with transaction isolation |
| **AI Extraction Providers** | [Ollama](https://ollama.com/) (`qwen3:4b`, `llama3`), [OpenAI](https://openai.com/) (`gpt-4o`), and deterministic fallback mock |
| **Document Ingestion (RAG)** | `pdf-parse`, `docx` table parser, sentence-aware sliding window chunker |
| **Code Quality & Testing** | ESLint 9 (0 errors, 0 warnings), Node.js native test harness |

---

## 4. Local Installation & Setup

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or later
- **Ollama (Optional for local AI)**: Download from [ollama.com](https://ollama.com) and pull `qwen3:4b` or `llama3`.
- **Supabase Account / Local PostgreSQL**: PostgreSQL 17 database with `pgvector` extension.

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/your-org/brandshield-ai.git
cd brandshield-ai
npm install
```

### Step 2: Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env.local
```

Configure your environment variables in `.env.local`:
```env
# Application Settings
NEXT_PUBLIC_APP_NAME="BrandShield AI"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_DEFAULT_WORKSPACE="DermaGlow"

# Supabase Client Credentials
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Server-Side Database Connection Pool
SUPABASE_DATABASE_URL="postgresql://postgres:[password]@db.your-project-ref.supabase.co:5432/postgres"

# AI Extraction Provider ("ollama" | "openai" | "mock")
LLM_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="qwen3:4b"
```

### Step 3: (Optional) Pull Ollama Model
If using local Ollama extraction:
```bash
ollama pull qwen3:4b
# Or: ollama pull llama3
```
*Note: If Ollama is offline or unavailable, BrandShield AI automatically falls back to its deterministic mock extractor, ensuring uninterrupted demo and evaluation flow.*

### Step 4: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The application will redirect to `/dashboard`.

---

## 5. Automated Verification & Quality Gates

BrandShield AI maintains comprehensive automated test suites covering rule verification, RAG chunking, human review workflows, policy intelligence, and operational resilience:

```bash
# 1. Type Safety Check (0 errors)
npx tsc --noEmit

# 2. ESLint Audit (0 errors, 0 warnings)
npm run lint

# 3. Phase 15 Operational Reliability & Resilience Suite (9/9 suites passing)
npm run test:phase15

# 4. Phase 5 Deterministic Verification Engine Suite (22/22 criteria passing)
npm run test:phase5

# 5. Phase 6 Human Review & Publication Gate Suite (32/32 tests passing)
npm run test:phase6:unit

# 6. Phase 7 Evidence Ingestion & RAG Suite (25/25 tests passing)
npm run test:phase7:unit

# 7. Phase 8 Audit Events & Analytics Suite (18/18 tests passing)
npm run test:phase8:unit

# 8. Phase 9 Policy Intelligence & Simulation Suite (19/19 tests passing)
npm run test:phase9:unit

# 9. Phase 10D UTF-16 Claim Offset Correction Suite (75/75 tests passing)
npm run test:phase10d

# 10. Production Build Verification (Compiles cleanly in Turbopack)
npm run build
```

---

## 6. Quick Hackathon Demonstration Guide (3 Minutes)

1. **Dashboard Overview (`/dashboard`)**:
   - Inspect the real-time compliance rate, total active claims, and workflow readiness banner.
   - Click **Health Diagnostics** in the top navigation to demonstrate live database and AI provider telemetry.
2. **Create Marketing Submission (`/submissions`)**:
   - Click **New Submission**.
   - Select **Scenario A: Compliant Launch** (pre-fills DermaGlow Vitamin C copy with approved 10% concentration and ₹1,999 launch price).
   - Click **Create Submission**.
3. **Extract Claims**:
   - Open the newly created submission.
   - Click **Extract Claims**. The system invokes Ollama, extracts atomic assertions, and computes exact UTF-16 text bounds.
4. **Run Batch Verification**:
   - Click **Verify All Claims**.
   - Observe both claims transitioning to `SUPPORTED` (Low Risk) backed by approved trial `DG-CT-2025-04` and the `Festival Glow Offer`.
5. **Inspect Publication Gate**:
   - Note the **Publication Gate: ELIGIBLE** status.
6. **Demonstrate Violation & Blocking (Scenario B)**:
   - Create a submission using **Scenario B: Misleading Overclaim** ("Cures eczema permanently overnight and eliminates 100% wrinkles in 3 minutes").
   - Extract and verify: Claims are flagged as `CONTRADICTED` with `CRITICAL RISK`.
   - Show that the **Publication Gate is LOCKED**—the marketing team is programmatically prevented from publishing illegal copy.
7. **Human Governance (`/reviews`)**:
   - Navigate to `/reviews` to show the compliance workbench.
   - Demonstrate reviewer controls: require a mandatory 10+ character legal rationale before overriding high-risk claims.
8. **Audit Trail (`/audit`)**:
   - Review the tamper-evident, append-only log verifying that every extraction, check, and review is permanently recorded.

---

## 7. Project Documentation & Hackathon Assets

### Core Hackathon Submission Assets
- 🏆 **[Hackathon Submission Document](docs/hackathon-submission.md)** — Complete official submission package, executive summary, problem statement, technical innovation, and architecture.
- 🎯 **[10-Slide Pitch Presentation](docs/hackathon-pitch-deck.md)** — Exact 10-slide deck with headlines, key messages, slide content, suggested visuals, and presenter notes.
- ⏱️ **[3-Minute Live Demo Script](docs/hackathon-live-demo.md)** — Precise second-by-second live presentation script with fallback procedures.
- 💡 **[Product Value & Differentiation](docs/product-differentiation.md)** — Detailed comparison matrix vs generic LLMs and traditional MLR software.
- ❓ **[Evaluator Q&A Preparation](docs/evaluator-qa.md)** — 22 in-depth technical questions and grounded answers for judges.

### Release & Staging Operations (v1.0.0 RC-1)
- 🚀 **[v1.0.0 Release Specification](docs/release-v1.0.0.md)** — Production release candidate baseline and acceptance criteria.
- 🌐 **[Staging Deployment Plan](docs/phase19-staging-plan.md)** — Staging architecture, hosting isolation, and deployment sequencing.
- 🗄️ **[Staging Database Validation](docs/phase19-database-validation.md)** — Schema dependency audit and ordered staging migration roadmap.
- 🛡️ **[Security & Tenant Validation](docs/phase19-security-validation.md)** — Multi-tenant RLS enforcement and session boundary test outcomes.
- 🧪 **[End-to-End Staging Test Results](docs/phase19-e2e-results.md)** — Scenarios A, B, C, D validation, provider fallback, and latency benchmarks.
- 📋 **[Production Smoke-Test Checklist](docs/production-smoke-tests.md)** — 12-category pre-flight checklist for staging deployments.
- 📖 **[Operations Runbook](docs/operations-runbook.md)** — SRE guide, diagnostic telemetry, and failure recovery playbooks.
- 🔄 **[Backup & Rollback Strategy](docs/backup-and-rollback.md)** — Custom-format backup procedures and disaster recovery protocols.

### System Architecture & Technical Specifications
- 📘 **[Architecture Guide](docs/architecture.md)** — High-level architecture, module breakdown, and Mermaid diagrams.
- 🗄️ **[Database Schema Specification](docs/database-schema.md)** — Entity relationships, table definitions, and migration status.
- 🤖 **[AI Pipeline Specification](docs/ai-pipeline.md)** — Ollama extraction, UTF-16 offsets, and evidence linking.
- 🔒 **[Security & RLS Guide](docs/security.md)** — Row Level Security, secret isolation, and data governance.
- ⚠️ **[System Limitations](docs/limitations.md)** — Transparent breakdown of implemented vs future migration capabilities.

---

## 8. License & Governance

Developed for the BrandShield AI Hackathon Demonstration. All rights reserved.  
Compliance policies and product datasets modeled after **DermaGlow Skincare**.
