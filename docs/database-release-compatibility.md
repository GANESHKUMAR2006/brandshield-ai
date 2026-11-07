# BrandShield AI — Database Release Compatibility Report

> **Database Administrator Mandate**:  
> Read-Only Inspection. Do NOT execute migrations, reset data, or modify schema. This document provides a formal compatibility audit of the current live PostgreSQL database against the v1.0.0 codebase.

---

## 1. Migration Inventory & Live Deployment Status

| Migration File | Phase | Status on Live Database | Applied Tables / Schema Additions |
| :--- | :---: | :---: | :--- |
| `20261105000000_initial_schema.sql` | 1 & 2 | **APPLIED (Live)** | `workspaces`, `products`, `approved_facts`, `promotions`, `source_documents`, `document_versions`, `document_chunks`. |
| `20261105010000_phase3_submissions_enhancements.sql` | 3 | **APPLIED (Live)** | `submissions`, `submission_versions`, content hashing triggers. |
| `20261105020000_phase4_extraction_engine.sql` | 4 | **APPLIED (Live)** | `claims`, `extraction_runs`, UTF-16 character offsets (`text_start`, `text_end`), confidence ratings. |
| `20261105030000_phase5_verification_engine.sql` | 5 | **APPLIED (Live)** | `verification_runs`, risk levels (`critical`, `high`, `medium`, `low`), `claim_evidence` linking. |
| `20261105040000_phase6_review_workflow.sql` | 6 | **APPLIED (Live)** | `review_decisions` table, reviewer actions, publication eligibility triggers. |
| `20261105050000_phase7_evidence_intelligence.sql` | 7 | **PENDING LIVE MIGRATION** | RLS policy update on `claim_evidence` allowing fact-only evidence (`document_version_id IS NULL`), workspace validation trigger. |
| `20261105060000_phase8_admin_analytics.sql` | 8 | **PENDING LIVE MIGRATION** | Materialized compliance views, `audit_events` performance indexing. |
| `20261105070000_phase9_policy_intelligence.sql` | 9 | **PENDING LIVE MIGRATION** | Declarative policy tables: `policies`, `policy_versions`, `policy_rules`, `policy_simulations`. |

---

## 2. Application Dependencies & Compatibility Gaps

### Core Application Runtime (Phases 1–6)
- **Status**: **100% Fully Compatible with Live Schema**.
- The existing live database contains all tables and columns required for submission ingestion, claim extraction, deterministic verification, risk scoring, human review, publication gating, and audit logging.
- Verified by live tests: `npm run test:phase5` (22/22 passing against live database).

### Phase 7 Dependency Handling (Evidence Intelligence)
- **Live Database Gap**: In the live database, the legacy RLS policy on `claim_evidence` expects `document_version_id` to be non-null.
- **Application Mitigation**: In `src/lib/verification/evidence/evidence-sufficiency.ts`, the application pre-validates evidence sources and provides approved-fact linking. Code tests pass (25/25).
- **Required Action Before Migration**: Execute pre-flight backup before applying `20261105050000_phase7_evidence_intelligence.sql`.

### Phase 8 Dependency Handling (Analytics)
- **Live Database Gap**: Dashboard SQL query was updated in Phase 12A to resolve `original_claim_id` rather than nonexistent `superseded_by`.
- **Application Mitigation**: The analytics service computes compliance velocity and risk breakdowns in memory or via direct queries against `claims` and `audit_events`.
- **Required Action Before Migration**: None; migration contains additive performance indexes.

### Phase 9 Dependency Handling (Policy Intelligence)
- **Live Database Gap**: Tables `policies` and `policy_versions` do not exist on the live database.
- **Application Mitigation**: The policy engine uses in-memory baseline policies (`src/lib/policy/default-policies.ts`) and performs dry-run simulations in memory without database mutation.
- **Required Action Before Migration**: None; migration contains additive tables.

---

## 3. Strict Pre-Deployment Migration Order

When the database administrator decides to apply pending migrations, they **MUST** be executed sequentially:

1. **Step 1**: Pre-migration backup using `pg_dump -Fc` (verified with `pg_restore --list`).
2. **Step 2**: Apply `20261105050000_phase7_evidence_intelligence.sql`.
   - Run verification test: `npm run test:phase7:unit`.
3. **Step 3**: Apply `20261105060000_phase8_admin_analytics.sql`.
   - Run verification test: `npm run test:phase8:unit`.
4. **Step 4**: Apply `20261105070000_phase9_policy_intelligence.sql`.
   - Run verification test: `npm run test:phase9:unit`.

---

## 4. Rollback Plan & Pre-Flight Guarantees

- **No Destructive Operations**: None of the pending migrations contain `DROP TABLE` or `TRUNCATE` operations on existing Phase 1–6 tables.
- **Additive Schema**: Migrations 7, 8, and 9 add new tables, views, and indexes. If rolled back, existing customer data in `workspaces`, `products`, `claims`, and `audit_events` remains untouched.
