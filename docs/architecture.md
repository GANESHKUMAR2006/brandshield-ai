# BrandShield AI — System Architecture (Phase 5)

## 1. Architectural Overview

BrandShield AI is an evidence-linked marketing claim governance platform built on Next.js 16 (App Router) and Supabase PostgreSQL 17 with `pgvector`. It provides verifiable claim extraction, deterministic evidence verification, defensible copy suggestions, and human-in-the-loop approval workflows for regulated consumer enterprises.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js App Router UI                           │
│   (Dashboard, Source Library, Submissions, Claim Ledger, Reviews)      │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
            (Client Component)               (Server Route / API)
                    │                                │
       @supabase/ssr (Browser)             Server Database / Verification Engine
                    │                                │
                    ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Verification Pipeline                           │
│   ┌─────────────────────┐               ┌──────────────────────────┐   │
│   │   AI Extraction     │               │   Deterministic          │   │
│   │   (OpenAI / Mock)   │ ────────────> │   Verification Engine    │   │
│   └─────────────────────┘               └────────────┬─────────────┘   │
│                                                      │                 │
│                                                      ▼                 │
│                                         ┌──────────────────────────┐   │
│                                         │ Category-Specific Rules  │   │
│                                         │ - price-verification     │   │
│                                         │ - discount-verification  │   │
│                                         │ - product-attribute      │   │
│                                         │ - efficacy & clinical    │   │
│                                         │ - guarantee-verification │   │
│                                         │ - comparative / other    │   │
│                                         └────────────┬─────────────┘   │
│                                                      │                 │
│                                                      ▼                 │
│                                         ┌──────────────────────────┐   │
│                                         │ Evidence Sufficiency     │   │
│                                         │ Pre-Determination Gate   │   │
│                                         └────────────┬─────────────┘   │
│                                                      │                 │
│                                                      ▼                 │
│                                         ┌──────────────────────────┐   │
│                                         │ PostgreSQL Transaction   │   │
│                                         │ - verification_runs      │   │
│                                         │ - claim_evidence links   │   │
│                                         │ - claims status & risk   │   │
│                                         │ - append-only audit_event│   │
│                                         └────────────┬─────────────┘   │
│                                                      │                 │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │
                                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Supabase Layer                                │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │            Row Level Security (RLS) Isolation                │     │
│   │    - Public read for DermaGlow demo workspace                │     │
│   │    - Mutation restricted to Authenticated / Service roles    │     │
│   │    - Immutable append-only audit events                      │     │
│   └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Core Entities & Lifecycle

1. **Workspace (`workspaces`)**: Top-level tenant container (`DermaGlow`), isolating products, sources, and submissions.
2. **Product Catalogue (`products`)**: Master catalog of SKUs, categories, and approved reference MRPs.
3. **Approved Facts (`approved_facts`)**: Ground-truth assertions (e.g. 10% stabilised Vitamin C) with explicit validity windows (`valid_from` to `valid_until`).
4. **Promotions Engine (`promotions`)**: Dynamic promotional pricing with valid date ranges, channel restrictions, and discount values.
5. **Evidence Repository (`source_documents`, `document_versions`, `document_chunks`)**: Versioned clinical dossiers and PDF documentation.
6. **Submissions Pipeline (`submissions`, `submission_versions`)**: Marketing campaign collaterals and ad variants with immutable version histories.
7. **Claim Registry (`claims`, `claim_evidence`, `verification_runs`)**: Isolated assertions mapped to specific submission versions, frozen evidence snapshots, and deterministic risk ratings.
8. **Compliance Reviews (`review_decisions`)**: Structured human reviewer decisions (`approved`, `rejected`, `escalated`, `modified`).
9. **Tamper-Evident Trail (`audit_events`)**: Append-only log with database-level immutability triggers (`trg_audit_events_immutable`).

---

## 3. Deterministic Claim Verification Architecture (Phase 5)

Phase 5 introduces a 100% deterministic, rule-based verification pipeline with **zero LLM calls** inside the verification engine.

### Governing Principle
> The LLM extracts claims. Approved organizational data provides evidence. Deterministic application rules determine verification outcomes. Humans retain final approval authority.

### Verification Statuses (Closed Enum)
1. `SUPPORTED`: Direct approved evidence corroborates the assertion within valid temporal and channel boundaries.
2. `CONTRADICTED`: Authoritative approved evidence explicitly conflicts with the claim. (Absence of evidence is NEVER classified as contradiction).
3. `OUTDATED`: The supporting source document version or promotional pricing offer is expired or superseded for the submission date.
4. `UNVERIFIED`: Insufficient evidence exists in the organizational library to establish factual truth or contradiction.
5. `NEEDS_REVIEW`: Triggered by conflicting facts, unassigned product association, borderline extraction confidence, comparative claims without competitor evidence, or ungrounded absolute guarantees.

### Deterministic Risk Scoring
Risk is deterministically computed based on verification status and claim severity:
- `critical`: Contradicted clinical/efficacy claims, contradicted absolute guarantees, safety policy violations.
- `high`: Contradicted pricing assertions, contradicted active ingredient concentrations, ungrounded guarantees.
- `medium`: Outdated promotional prices, outdated documents, ambiguous assertions requiring human compliance review.
- `low`: Supported claims, unverified non-hazardous factual assertions.

### Verification Modules (`src/lib/verification/`)
- `verification-engine.ts`: Master orchestrator, transactional persistence, frozen evidence snapshot generation, and append-only audit logging.
- `verification-context.ts`: Context loader querying PostgreSQL for claim, submission, product, approved facts, promotions, and current source documents.
- `verification-router.ts`: Dispatches claims to category-specific verification rules based on `claim_type`.
- `evidence/evidence-validator.ts`: Temporal checks (`valid_from`, `valid_until`), channel applicability, approval status, decimal-safe integer currency math (`Math.round(val * 100)`).
- `evidence/evidence-sufficiency.ts`: Pre-determination gate enforcing traceable foreign key IDs, contradictory fact detection, and sufficiency classification.
- `risk/risk-calculator.ts`: Deterministic risk matrix evaluator.
- `rules/price-verification.ts`: Promotion-aware pricing engine (MRP vs active promotion vs channel restrictions).
- `rules/discount-verification.ts`: Percentage and fixed amount discount evaluator.
- `rules/product-attribute-verification.ts`: Active concentration and ingredient specification matcher.
- `rules/efficacy-verification.ts`: Clinical trial study endpoint matcher (DG-CT-2025-04).
- `rules/guarantee-verification.ts`: Absolute promise and overnight turnaround checker.
- `rules/comparative-verification.ts`: Comparative and superlative claim router.
- `rules/availability-verification.ts`: Stock availability and market distribution validator.
- `rules/promotional-verification.ts`: General marketing campaign terms validator.

---

## 4. Technology Matrix

| Layer | Component | Version / Specification |
|---|---|---|
| Frontend | Next.js App Router | 16.4.5 (Turbopack) |
| UI Framework | React | 19.3.0 |
| Language | TypeScript | 5.x (Strict mode) |
| Styling | Tailwind CSS | 4.x |
| Database | Supabase PostgreSQL | 17.x with `pgvector` |
| Connection Pool | Node `pg` Pool | 8.23.1 with SSL |
| Claim Extraction | OpenAI SDK / Structured JSON | 4.x / gpt-4o-mini |
| Claim Verification | Deterministic Rules Engine | Custom TypeScript v1.0.0 (Zero LLM) |
| Testing | Automated Test Suites | `test:db`, `test:phase3`, `test:phase4`, `test:phase5` |
