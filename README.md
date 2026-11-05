# BrandShield AI — Evidence-Linked Marketing Claim Governance

> **Hackathon Round 2 — Phase 5: Deterministic Marketing Claim Verification Engine**  
> Demonstration Organisation: **DermaGlow**  
> Engine Version: `1.0.0`

---

## 1. Project Overview

**BrandShield AI** is an enterprise marketing claim governance platform designed to bridge the gap between high-velocity brand marketing teams, scientific research dossiers, and legal/regulatory compliance departments.

Promotional claims in regulated consumer goods (e.g., dermatological skincare, cosmetics, and wellness) must be backed by verifiable scientific evidence before being published across paid social, packaging cartons, direct-to-consumer websites, or retail decks. BrandShield AI automates the extraction of marketing assertions, deterministically verifies them against indexed clinical trials and approved product dossiers, highlights discrepancies, calculates compliance risk, suggests defensible phrasing, and facilitates structured human-in-the-loop approvals.

---

## 2. Phase 5 Architecture: Deterministic Verification Engine

Phase 5 delivers a 100% deterministic, rule-based claim verification engine.

### Core Architectural Principle:
- **The LLM extracts claims.**
- **Approved organizational data provides evidence.**
- **Deterministic application rules determine verification outcomes.**
- **Humans retain final approval authority.**
- **Zero LLM calls inside the verification engine.**

### Five Closed Verification Statuses:
1. `SUPPORTED`: Direct approved evidence corroborates the assertion within valid temporal and channel boundaries.
2. `CONTRADICTED`: Authoritative approved evidence explicitly conflicts with the claim. (Absence of evidence is NEVER classified as contradiction).
3. `OUTDATED`: The supporting source document version or promotional pricing offer is expired or superseded for the submission date.
4. `UNVERIFIED`: Insufficient evidence exists in the organizational library to establish factual truth or contradiction.
5. `NEEDS_REVIEW`: Triggered by conflicting facts, unassigned product association, borderline extraction confidence, comparative claims without competitor evidence, or ungrounded absolute guarantees.

### Key Capabilities Delivered:
- **Promotion-Aware Price Verification**: Handles catalogue MRP (₹2,499), active promotional windows (₹1,999 Festival Glow Offer), expired discounts, and channel restrictions (`["Instagram", "DTC Website"]`).
- **Product Attribute Verification**: Evaluates concentrations and formulation specs against approved facts (e.g., 10% stabilised Vitamin C vs exaggerated 25% assertions).
- **Clinical & Guarantee Verification**: Validates 4-week radiance and 8-week barrier hydration endpoints against clinical trial `DG-CT-2025-04`, while rejecting ungrounded 100% overnight guarantees.
- **Evidence Sufficiency Pre-Determination Gate**: Enforces traceable database foreign keys, detects contradictory approved facts, and prevents false determinations.
- **Decimal-Safe Currency Math**: All monetary amounts evaluated using integer paise calculations (`Math.round(val * 100)`) to eliminate floating-point drift.
- **Inclusive Temporal Boundaries**: Date boundaries treated inclusively through 23:59:59.999 UTC.
- **Transactional Persistence & Frozen Evidence Snapshots**: Complete evidence snapshot recorded in `verification_runs.evidence_snapshot`, linked in `claim_evidence`, and logged in append-only `audit_events`.
- **Frontend Integration**:
  - `/claims`: Full Claim Ledger with risk filters, verification status pills, inline verification action, and interactive Claim Detail modal with defensible corrections and historical verification runs.
  - `/submissions`: Interactive "Verify All Claims" batch execution and per-claim verification with live badge updates.

---

## 3. Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router, Server Components & Route Handlers)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode enabled)
- **Database**: [Supabase PostgreSQL 17](https://supabase.com/) with `pgvector`
- **Database Pool**: `pg` Server Database Pool with transaction helpers (`withTransaction`)
- **LLM Client SDK**: `openai` (Structured Outputs for Claim Extraction)
- **Claim Verification**: Deterministic Rule-Based Engine (`src/lib/verification/`)
- **Client Libraries**: `@supabase/ssr`, `@supabase/supabase-js`
- **Schema Validation**: `zod`
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Code Quality**: ESLint 9 (Next.js core web vitals + TypeScript rules)
- **Package Manager**: `npm`

---

## 4. Test Suite Execution

All test suites connect to live Supabase PostgreSQL and execute against the real **DermaGlow** enterprise workspace:

```bash
# 1. Test database connectivity
npm run test:db

# 2. Test Phase 3 source library and versioning
npm run test:phase3

# 3. Test Phase 4 AI claim extraction engine
npm run test:phase4

# 4. Test Phase 5 Deterministic Verification Engine (All 22 Criteria)
npm run test:phase5
# Or alias:
npm run test:verification

# 5. Lint codebase (0 errors, 0 warnings)
npm run lint

# 6. Production build
npm run build
```

---

## 5. Verification Engine Test Results (22/22 Passing)

```
[PASS] 1. Exact approved product attribute verification
[PASS] 2. Incorrect concentration claim contradiction
[PASS] 3. Correct promotional price verification
[PASS] 4. Incorrect promotional price contradiction
[PASS] 5. Expired promotion verification
[PASS] 6. Invalid promotion channel restriction
[PASS] 7. Missing promotion terms
[PASS] 8. Expired source document detection
[PASS] 9. Superseded document version detection
[PASS] 10. Conflicting approved facts detection
[PASS] 11. Missing evidence (Never contradicted on absence)
[PASS] 12. Ambiguous product association
[PASS] 13. Unsupported efficacy claim
[PASS] 14. Unsupported absolute guarantee claim
[PASS] 15. Multiple claims in single submission batch verification
[PASS] 16. Duplicate verification attempts (Immutable history preservation)
[PASS] 17. Historical evidence snapshot verification
[PASS] 18. Unauthorized verification attempt / RLS enforcement
[PASS] 19. Cross-workspace isolation
[PASS] 20. Append-only audit event creation
[PASS] 21. Currency precision (Decimal-safe integer arithmetic)
[PASS] 22. Submission date boundary handling (Inclusive start & end of day UTC)
```
