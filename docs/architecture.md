# BrandShield AI — System Architecture Specification

## 1. Architectural Overview

**BrandShield AI** is an enterprise brand compliance platform designed to govern marketing claims for regulated consumer goods organizations. Built on **Next.js 16 (App Router)** and **Supabase PostgreSQL 17** with `pgvector`, it combines AI-driven claim extraction with 100% deterministic, rule-based evidence verification and human-in-the-loop review.

```mermaid
flowchart TD
    subgraph Client["Presentation Layer (Next.js 16 App Router)"]
        UI_Dash["Executive Dashboard (/dashboard)"]
        UI_Subs["Submission Hub (/submissions)"]
        UI_Claims["Claim Repository (/claims)"]
        UI_Reviews["Compliance Workbench (/reviews)"]
        UI_Policies["Policy Engine (/policies)"]
        UI_Sources["Source Library (/sources)"]
        UI_Audit["Audit Trail (/audit)"]
        UI_Demo["Guided Demo & Presenter Mode"]
    end

    subgraph API["Transport Layer (Next.js Server Route Handlers)"]
        API_Client["Typed API Client (src/lib/api-client.ts)"]
        API_Subs["/api/submissions/*"]
        API_Claims["/api/claims/*"]
        API_Reviews["/api/reviews"]
        API_Policies["/api/policies/*"]
        API_Health["/api/health"]
        API_Audit["/api/audit"]
    end

    subgraph Core["Domain Services Layer (src/lib/)"]
        subgraph Extraction["AI Extraction Pipeline"]
            Provider["Configured Provider (Ollama / OpenAI / Mock)"]
            Prompt["Extraction Prompts & Few-Shot Examples"]
            Normalizer["Schema Normalizer (Zod)"]
            Offset["Deterministic Offset Calculator (UTF-16)"]
        end

        subgraph Verification["Deterministic Verification Engine"]
            Sufficiency["Evidence Sufficiency Gate"]
            Router["Verification Router"]
            Rules["8 Category Verifiers (Price, Discount, Clinical, etc.)"]
            RiskCalc["Composite Risk Calculator (0-100)"]
        end

        subgraph Governance["Governance & Review Subsystem"]
            ReviewSvc["Review Workflow Service"]
            PubGate["Publication Eligibility Gatekeeper"]
            AuditSvc["Audit Logging Service"]
        end

        subgraph RAG["Evidence & Ingestion Subsystem"]
            Ingest["Doc Ingestion (PDF / DOCX / TXT)"]
            Chunker["Deterministic Sentence Chunker"]
            Retriever["Hybrid Retriever (Semantic + BM25)"]
        end
    end

    subgraph Storage["Data & Persistence Layer (Supabase PostgreSQL 17)"]
        DB_Relational[("Relational Tables: workspaces, products, approved_facts, claims, reviews")]
        DB_Vector[("pgvector: document_chunks embeddings vector(1536)")]
        DB_Audit[("Append-Only audit_events (Trigger Immutability)")]
        DB_RLS["Row Level Security (RLS) Tenant Policies"]
    end

    UI_Dash & UI_Subs & UI_Claims & UI_Reviews & UI_Policies & UI_Sources & UI_Audit & UI_Demo --> API_Client
    API_Client --> API_Subs & API_Claims & API_Reviews & API_Policies & API_Health & API_Audit
    
    API_Subs --> Extraction
    API_Claims --> Verification
    API_Reviews --> Governance
    API_Policies --> Verification
    
    Extraction --> Storage
    Verification --> Storage
    Governance --> Storage
    RAG --> Storage
```

---

## 2. Core Architectural Principles

1. **The LLM Extracts; Deterministic Code Verifies**:
   - Large Language Models are probabilistic and prone to hallucination.
   - LLMs are strictly restricted to **claim extraction** and entity parsing.
   - All verification determinations (verdict, compliance risk, and suggested phrasing) are executed by **100% deterministic, rule-based TypeScript engines**.
   - Zero LLM calls exist inside the verification loop.
2. **Absence of Proof is Never Contradiction**:
   - If an assertion lacks backing evidence, the engine classifies it strictly as `UNVERIFIED` or `NEEDS_REVIEW`.
   - Claims are only classified as `CONTRADICTED` when authoritative approved data explicitly conflicts with the claim.
3. **Decimal-Safe Financial Math**:
   - All currency and discount comparisons use integer paise arithmetic (`Math.round(val * 100)`) to eliminate JavaScript floating-point inaccuracies.
4. **Deterministic UTF-16 Character Offsets**:
   - Extracted claims must satisfy the character offset invariant:
     $$\text{content.slice}(\text{text\_start}, \text{text\_end}) \equiv \text{claim\_text}$$
   - Includes full support for Unicode currency symbols (₹, €, ¥, £, $) and multi-byte UTF-16 emoji surrogate pairs.
5. **Fail-Closed Gatekeeping**:
   - Marketing copy cannot be published unless 100% of its active claims have been verified and approved.
   - Any single active claim that is unverified, contradicted, or rejected locks the publication gate.

---

## 3. Layer Breakdown & Responsibilities

### 3.1 Presentation Layer (`src/components/`, `src/app/`)
- **Pages**: Follows the Next.js 16 App Router architecture. Rendered using server and client components.
- **Feature Modals**:
  - `CreateSubmissionModal.tsx`: Ingests custom marketing text or loads one of the three guided demo presets.
  - `SubmissionDetailModal.tsx`: Controls the end-to-end lifecycle: claim extraction, batch verification, claim filtering, and publication gating.
  - `ClaimDetailModal.tsx`: Detailed forensic claim inspection displaying verified facts, source excerpts, risk justification, and defensible copy recommendations.
  - `SystemHealthModal.tsx`: Live telemetry checking database latency and Ollama reachability.
  - `PresenterViewModal.tsx`: Side-by-side presentation view displaying real-time compliance results.

### 3.2 Transport Layer (`src/app/api/`)
- Pure JSON REST APIs enforcing request schema validation via `zod`.
- Interacts with domain services and returns standard status codes (`200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`, `500 Internal Error`).
- Resilient client SDK (`src/lib/api-client.ts`) handles timeouts, retries, and offline demo fallbacks.

### 3.3 Domain Services Layer (`src/lib/`)
- **AI Extraction (`src/lib/ai/`)**: Supports local Ollama (`qwen3:4b`), cloud OpenAI (`gpt-4o-mini`), and an offline deterministic mock extractor.
- **Verification Engine (`src/lib/verification/`)**: 8 specialized verifiers:
  1. `price-verification.ts`: Validates MSRP against product catalogue.
  2. `discount-verification.ts`: Validates promotional prices, active campaign dates, and channel permissions.
  3. `product-attribute-verification.ts`: Validates concentrations, formulations, and active ingredients.
  4. `efficacy-verification.ts`: Validates clinical trial endpoints and study durations.
  5. `guarantee-verification.ts`: Enforces brand safety rules against ungrounded absolute guarantees.
  6. `comparative-verification.ts`: Evaluates comparative claims against competitor benchmarks.
  7. `availability-verification.ts`: Validates stock and distribution assertions.
  8. `promotional-verification.ts`: Validates marketing event timelines.
- **Policy Engine (`src/lib/policy/`)**: Declarative AST condition evaluator allowing compliance teams to define brand-wide rules and dry-run simulations.
- **Review Workflow (`src/lib/review/`)**: Enforces human governance, prevents unauthorized reviewer overrides, and evaluates publication gate eligibility.

### 3.4 Data & Persistence Layer (`supabase/`, `src/lib/db/`)
- **Supabase PostgreSQL 17**: Houses normalized relational tables with Row Level Security (RLS) policies.
- **Connection Pooling**: Utilizes native `pg` pool (`server-db.ts`) for high-throughput transactional queries.
- **Audit Immutability**: Uses PostgreSQL trigger `trg_audit_events_immutable` to strictly reject any `UPDATE` or `DELETE` queries on compliance event logs.

---

## 4. End-to-End Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Marketer as Marketing Team
    actor Reviewer as Compliance Officer
    participant UI as BrandShield Web UI
    participant API as Next.js API Routes
    participant Extractor as AI Extraction Pipeline
    participant Verifier as Deterministic Verification Engine
    participant DB as Supabase PostgreSQL

    Marketer->>UI: Create Submission (Text & Target Product)
    UI->>API: POST /api/submissions
    API->>DB: INSERT into submissions & submission_versions
    DB-->>API: 201 Created (submission_id)
    API-->>UI: Submission Created

    Marketer->>UI: Click "Extract Claims"
    UI->>API: POST /api/submissions/:id/extract
    API->>Extractor: Run Ollama Extraction & UTF-16 Offset Matching
    Extractor-->>API: Extracted Claims with Offsets
    API->>DB: INSERT into claims (status: unverified)
    DB-->>API: Persisted
    API-->>UI: Return Extracted Claims

    Marketer->>UI: Click "Verify All Claims"
    UI->>API: POST /api/submissions/:id/verify
    API->>Verifier: Execute Deterministic Rules against Approved Facts
    Verifier-->>API: Verification Verdicts & Risk Ratings
    API->>DB: UPDATE claims & INSERT verification_runs & audit_events
    DB-->>API: Persisted
    API-->>UI: Updated Verification Results

    Reviewer->>UI: Inspect Contradicted / Flagged Claims
    Reviewer->>UI: Approve with Documented Legal Override
    UI->>API: POST /api/reviews
    API->>DB: INSERT into review_decisions & audit_events
    DB-->>API: Persisted
    API-->>UI: Decision Recorded

    Marketer->>UI: Check Publication Status
    UI->>API: GET /api/submissions/:id/publication-status
    API->>Verifier: Evaluate Publication Gate Rules
    Verifier-->>API: Gate Status: ELIGIBLE / BLOCKED
    API-->>UI: Display Final Publication Gate
```

---

## 5. Human Review & Publication Gate Architecture

```mermaid
flowchart TD
    subgraph Submission["Submission Verification State"]
        Claims["Extracted & Verified Claims"]
        VerdictCheck{"Are ALL active claims\nSUPPORTED?"}
    end

    subgraph ReviewWorkbench["Human Compliance Review Workbench"]
        Flagged["Contradicted / Unverified / High Risk Claims"]
        ReviewerAction{"Reviewer Action"}
        Action_Reject["Reject Claim\n(Mark Ineligible)"]
        Action_Escalate["Escalate to Legal\n(Assign Category)"]
        Action_Modify["Modify Claim Phrasing\n(Defensible Suggestion)"]
        Action_Override["Approve with Legal Override\n(Requires Reason >= 10 chars)"]
    end

    subgraph Gatekeeper["Publication Eligibility Gatekeeper"]
        ActiveCheck{"Any active claim\nUnverified, Contradicted,\nor Rejected?"}
        GateLocked["PUBLICATION GATE LOCKED\n(Blocked: Copy Ineligible)"]
        GateUnlocked["PUBLICATION GATE UNLOCKED\n(Eligible: Ready for Ad Manager)"]
    end

    Claims --> VerdictCheck
    VerdictCheck -- "Yes" --> GateUnlocked
    VerdictCheck -- "No" --> Flagged
    Flagged --> ReviewerAction
    ReviewerAction --> Action_Reject & Action_Escalate & Action_Modify & Action_Override

    Action_Reject --> ActiveCheck
    Action_Escalate --> ActiveCheck
    Action_Modify --> ActiveCheck
    Action_Override --> ActiveCheck

    ActiveCheck -- "Yes" --> GateLocked
    ActiveCheck -- "No (100% Approved)" --> GateUnlocked
```
