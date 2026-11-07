# BrandShield AI — v1.0.0 Release Specification

**Application Name**: BrandShield AI  
**Release Version**: `1.0.0`  
**Release Target**: Production-Ready Release Candidate (RC-1)  
**Release Date**: November 7, 2026  
**Demonstration Workspace**: DermaGlow Skincare  
**Git Working Tree**: Verified clean, uncommitted files tracked, secrets excluded

---

## 1. Release Overview

**BrandShield AI v1.0.0** is the first enterprise-ready production release of the evidence-linked marketing claim governance platform.

Built on **Next.js 16.4.5 (App Router)** and **Supabase PostgreSQL 17**, BrandShield AI provides end-to-end automation to extract marketing claims from copy, deterministically verify assertions against approved clinical trials and product catalogues, calculate compliance risk ratings, facilitate structured human compliance review, and enforce fail-closed publication gates.

---

## 2. Version Information & Artifacts

- **SemVer**: `1.0.0`
- **Application Core**: Next.js `16.4.5`, React `19.3.0`, TypeScript `5.x`, Tailwind CSS `4.x`.
- **Database Engine**: PostgreSQL `17.x` with `pgvector` extension.
- **Node.js Target**: Node.js `>= 20.x` or `>= 22.x` (LTS).
- **Package Manifest**: `package.json` (`"version": "1.0.0"`).
- **License**: Proprietary / Enterprise Hackathon Demonstration.

---

## 3. Major Implemented Features

### 1. AI Claim Extraction Engine
- Parses natural language marketing text into atomic assertions.
- Integrates with local Ollama (`qwen3:4b` / `llama3`), cloud OpenAI (`gpt-4o-mini`), and deterministic offline mock provider.
- Enforces strict Zod schema validation (`ExtractionSchema`).

### 2. Deterministic UTF-16 Offset Resolution & Recovery
- Enforces the character offset invariant:
  $$\text{content.slice}(\text{text\_start}, \text{text\_end}) \equiv \text{claim\_text}$$
- Handles Unicode currency symbols (₹, €, ¥, £, $) and multi-byte UTF-16 emoji surrogate pairs (🧴, ✨, 🌟).
- Incorporates Levenshtein distance fuzzy matching to realign hallucinated quote boundaries.

### 3. 100% Deterministic Rule-Based Verification Engine
- Evaluates extracted claims across 8 specialized domain verifiers:
  1. `price-verification.ts`: Validates MSRP against base catalogue using integer paise arithmetic.
  2. `discount-verification.ts`: Validates promotional prices, active UTC date horizons, and channel permissions.
  3. `product-attribute-verification.ts`: Validates ingredient concentrations and formulation specs.
  4. `efficacy-verification.ts`: Validates clinical trial endpoints and study duration requirements.
  5. `guarantee-verification.ts`: Flags ungrounded absolute guarantees and medical cure assertions.
  6. `comparative-verification.ts`: Validates competitor comparisons against comparative study data.
  7. `availability-verification.ts`: Validates distribution and inventory claims.
  8. `promotional-verification.ts`: Validates seasonal campaign dates.
- Zero LLM calls inside the verification loop.
- Epistemological safety: Absence of evidence defaults strictly to `UNVERIFIED` (never false contradiction).

### 4. Human-in-the-Loop Review Workbench (`/reviews`)
- Compliance actions: Approve, Reject, Escalate to Legal, Modify Claim.
- Mandatory override justification: Reviewers must provide documented rationale ($\ge 10$ characters) to approve contradicted or critical-risk claims.
- Defensible Copy Generator: Automatically recommends compliant phrasing derived from approved clinical dossiers.

### 5. Fail-Closed Publication Gatekeeper
- Evaluates publication eligibility in real time.
- Programmatically locks publication if any active claim remains unverified, contradicted, or rejected.

### 6. Tamper-Evident Audit Trail (`/audit`)
- Immutable compliance event log.
- Protected by PostgreSQL database trigger `trg_audit_events_immutable`, preventing any `UPDATE` or `DELETE` queries.

### 7. Interactive Demo Console & Preset Scenarios
- 3 pre-built scenarios:
  - **Scenario A (Compliant Launch)**: 10% Vitamin C at ₹1,999 $\rightarrow$ Supported $\rightarrow$ Publication Eligible.
  - **Scenario B (Misleading Overclaim)**: Overnight eczema cure at ₹999 $\rightarrow$ Contradicted (Critical Risk) $\rightarrow$ Publication Locked.
  - **Scenario C (Unverified Clinical Claim)**: 95% fine lines in 7 days $\rightarrow$ Unverified $\rightarrow$ Requires Review.

### 8. Operational Telemetry & Diagnostics
- Dedicated diagnostic endpoint (`/api/health`) and UI modal (`SystemHealthModal.tsx`).
- Live PostgreSQL latency and Ollama reachability checks with automated secret sanitization.

---

## 4. Database Compatibility

- **Target PostgreSQL Version**: PostgreSQL 17.11 (Supabase managed).
- **Applied Migrations (Live Database)**:
  - `20261105000000_initial_schema.sql` (Phase 1 & 2): Workspaces, products, approved facts, promotions.
  - `20261105010000_phase3_submissions_enhancements.sql` (Phase 3): Submissions and content hashing.
  - `20261105020000_phase4_extraction_engine.sql` (Phase 4): Claims table and extraction metadata.
  - `20261105030000_phase5_verification_engine.sql` (Phase 5): Verification runs, risk levels, and evidence linking.
  - `20261105040000_phase6_review_workflow.sql` (Phase 6): Review decisions and human workflow.
- **Pending Migrations (Authored & Tested, Unapplied on Live DB)**:
  - `20261105050000_phase7_evidence_intelligence.sql` (Phase 7): RLS policy correction for fact-based evidence.
  - `20261105060000_phase8_admin_analytics.sql` (Phase 8): Compliance analytics materialized views.
  - `20261105070000_phase9_policy_intelligence.sql` (Phase 9): Declarative policy tables.
- **Compatibility Status**: **Fully Compatible.** Application code operates seamlessly on the current live database schema and provides in-memory fallback for unapplied tables.

---

## 5. Supported Local Environments

- **Operating Systems**: Windows 11 / 10, macOS (Apple Silicon / Intel), Ubuntu Linux 22.04 LTS.
- **Node.js**: `v20.x` or `v22.x` (LTS recommended).
- **Package Manager**: `npm` `v10.x` or higher.
- **Local AI Provider**: Ollama `v0.3.x` or higher running `qwen3:4b` or `llama3`.

---

## 6. Release Acceptance Criteria

| Criteria | Verification Target | Observed Result | Verdict |
| :--- | :--- | :--- | :--- |
| **Type Check** | `npx tsc --noEmit` | 0 errors | **PASS** |
| **Linter Check** | `npm run lint` | 0 errors, 0 warnings | **PASS** |
| **Test Suite** | `npm test` | 116 passing unit assertions | **PASS** |
| **Comprehensive Tests** | `npm run test:phase5`, `test:phase15`, etc. | 200 criteria passing | **PASS** |
| **Production Build** | `npm run build` | Turbopack compiles in 26.1s (25 routes) | **PASS** |
| **Secrets Hygiene** | Secret scanning | No credentials in tracked files | **PASS** |
| **Release Verdict** | Formal baseline review | Ready for v1.0.0 tagging and staging deployment | **ACCEPT** |
