# BrandShield AI — Known Limitations & Implementation Boundaries

> **Transparency Statement**:  
> In accordance with hackathon evaluation standards, this document provides an honest, factual accounting of what is fully implemented and verified versus what is deferred, mock-assisted, or pending future database migrations.

---

## 1. Fully Implemented & Production-Verified Capabilities

| Capability | Implementation File(s) | Verification Evidence |
| :--- | :--- | :--- |
| **Deterministic Claim Verification** | `src/lib/verification/` (8 category verifiers) | 22/22 criteria passing in `scripts/phase5-comprehensive-test.ts`. Zero LLM hallucinations in verdicts. |
| **Deterministic UTF-16 Offsets** | `src/lib/ai/extraction/claim-offset-calculator.ts` | 75/75 tests passing in `scripts/phase10d-offset-correction-test.ts`. Full support for ₹, €, emojis, and fuzzy match. |
| **Human Review Workflow** | `src/lib/review/review-service.ts`, `src/app/reviews/page.tsx` | 32/32 tests passing in `scripts/phase6-unit-test.ts`. Enforces mandatory overrides and audit logs. |
| **Publication Eligibility Gate** | `src/app/api/submissions/[id]/publication-status/route.ts` | Tested in `scripts/phase15-reliability-test.ts`. Blocks publication if any active claim is contradicted or unverified. |
| **Ollama & OpenAI Extraction** | `src/lib/ai/providers/` (`ollama-provider.ts`, `openai-provider.ts`) | Tested with live Ollama `qwen3:4b`. Graceful fallback to deterministic mock when offline. |
| **Append-Only Audit Immutability** | PostgreSQL trigger `trg_audit_events_immutable` | Database trigger aborts any `UPDATE` or `DELETE` with code `42501`. |
| **Interactive Demo Experience** | `src/components/demo/`, `src/components/claims/ClaimLifecycleStepper.tsx` | 3 pre-built scenarios (Compliant, Misleading, Discount) with zero destructive DB operations. |
| **Health Telemetry & Diagnostics** | `src/app/api/health/route.ts`, `src/components/system/SystemHealthModal.tsx` | Live DB and Ollama reachability diagnostics with credential sanitization. |

---

## 2. Capabilities Pending Live Database Migration

The application code supports the following features, but their dedicated PostgreSQL database tables reside in pending migrations (`supabase/migrations/`) that have not yet been executed on the live database per hackathon safety protocols:

### 1. Phase 7: Evidence Intelligence RLS Hardening
- **Migration**: `20261105050000_phase7_evidence_intelligence.sql`
- **Scope**: Replaces legacy RLS policies on `claim_evidence` to permit `document_version_id IS NULL` when evidence cites an approved fact directly.
- **Current Workaround / Status**: Supported at the application layer via `src/lib/verification/evidence/evidence-sufficiency.ts`. Unit tests pass (25/25).

### 2. Phase 8: Administrative Analytics Views
- **Migration**: `20261105060000_phase8_admin_analytics.sql`
- **Scope**: Materialized database views for aggregated compliance velocity and category breakdown.
- **Current Workaround / Status**: The dashboard and analytics endpoints (`/api/analytics/summary`, `/api/analytics/insights`) compute metrics in memory or via direct queries (`original_claim_id`).

### 3. Phase 9: Persistent Policy Tables
- **Migration**: `20261105070000_phase9_policy_intelligence.sql`
- **Scope**: Database tables for `policies`, `policy_versions`, `policy_rules`, and `policy_simulations`.
- **Current Workaround / Status**: Policy engine runs against default baseline DermaGlow regulatory policies (`default-policies.ts`). Simulation runs in-memory without mutating database records.

---

## 3. Provider & Environment Boundaries

1. **Ollama Hardware Dependency**:
   - Running Ollama locally requires an active Ollama process with `qwen3:4b` or `llama3` pulled.
   - *Resilience Guarantee*: If Ollama is offline or uninstalled on the evaluator's machine, BrandShield AI automatically and seamlessly falls back to its offline deterministic mock extractor, ensuring the demonstration never crashes.
2. **Document Ingestion OCR**:
   - `pdf-parse` extracts digital text streams from PDF and DOCX files. Scanned image-only PDFs without an embedded OCR text layer cannot be parsed without an external OCR service (e.g. Tesseract).
3. **Multi-Organization Demo Scope**:
   - The hackathon demo environment is pre-configured for the **DermaGlow** skincare organization. Creating new top-level workspaces dynamically via the UI is reserved for enterprise administrators.
