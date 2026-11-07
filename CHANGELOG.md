# Changelog — BrandShield AI

All notable changes to the BrandShield AI platform are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-11-07

### Added
- **AI Claim Extraction Engine**: Automated decomposition of promotional copy into atomic assertions using local Ollama (`qwen3:4b` / `llama3`), cloud OpenAI (`gpt-4o-mini`), or offline deterministic mock.
- **Deterministic UTF-16 Offset Engine**: Exact character span mapping supporting Unicode currency symbols (₹, €, ¥, £, $) and multi-byte UTF-16 emoji surrogate pairs (🧴, ✨, 🌟).
- **Fuzzy Quote Boundary Recovery**: Levenshtein distance recovery algorithm realigning hallucinated quotation punctuation to exact source spans.
- **Deterministic Verification Engine**: 8 category-specific rule engines evaluating catalog pricing, promotional calendars, ingredient specs, clinical endpoints, absolute guarantees, availability, and comparative claims with zero LLM hallucinations in verdicts.
- **Fail-Closed Publication Gatekeeper**: Programmatic gating logic blocking marketing copy from publication unless 100% of active claims are verified and approved.
- **Human Compliance Review Workbench (`/reviews`)**: Structured reviewer actions (Approve, Reject, Escalate, Modify) with mandatory justification rationale ($\ge 10$ characters) for high-risk overrides.
- **Defensible Phrasing Generator**: Auto-generates compliant copy suggestions derived directly from approved clinical trial endpoints.
- **Append-Only Tamper-Evident Audit Trail (`/audit`)**: Compliance event tracking protected by PostgreSQL trigger `trg_audit_events_immutable`.
- **Interactive Demo Walkthrough**: 3 pre-built scenarios (Scenario A: Compliant Launch, Scenario B: Misleading Overclaim, Scenario C: Unverified Clinical Endpoint) with zero database mutations.
- **System Health Diagnostics (`/api/health`)**: Live telemetry inspecting database latency and Ollama reachability with automated credential sanitization.
- **Presenter View Console**: Specialized split-screen console designed for live stage presentations and evaluator inspection.

### Improved
- **Dashboard Analytics Query**: Resolved invalid column reference by querying `original_claim_id` rather than nonexistent `superseded_by`.
- **Decimal-Safe Financial Math**: Evaluated promotional discounts and MSRP in integer paise (`Math.round(val * 100)`) to eliminate floating-point drift.
- **Temporal Validity Horizons**: Inclusive UTC boundary handling through 23:59:59.999 UTC for promotional pricing windows.
- **Provider Resilience**: Automatic graceful fallback to offline deterministic mock extractor when Ollama daemon is unreachable.
- **Responsive UI Design System**: Unified design tokens using Tailwind CSS v4, custom status badges, and mobile navigation drawer.

### Security
- **Multi-Tenant Row Level Security (RLS)**: Enforced RLS across all Supabase PostgreSQL tables; public reads strictly restricted to `DermaGlow` demonstration workspace.
- **Database Trigger Immutability**: Active PL/pgSQL trigger rejecting any `UPDATE` or `DELETE` query against `audit_events`.
- **Zero Secret Key Exposure**: Server-only connection credentials isolated from browser JavaScript bundles.
- **Health Telemetry Masking**: Connection URLs and provider tokens automatically sanitized before JSON emission.

### Documentation
- **Architecture Specification**: `docs/architecture.md` detailing Next.js 16 App Router architecture, service breakdown, and Mermaid flowcharts.
- **Database Schema**: `docs/database-schema.md` with table catalog, foreign keys, migration status table, and Mermaid ER diagram.
- **AI Pipeline Guide**: `docs/ai-pipeline.md` detailing Ollama prompting, UTF-16 offsets, hybrid retrieval, and verification rules.
- **Demo Script**: `docs/demo-guide.md` & `docs/hackathon-live-demo.md` with second-by-second 3-minute presentation scripts.
- **Evaluator Q&A**: `docs/evaluator-qa.md` covering 22 technical questions with grounded implementation answers.
- **Product Differentiation**: `docs/product-differentiation.md` contrasting deterministic verification against generic LLM chatbots.
- **Operations & Runbooks**: `docs/operations-runbook.md`, `docs/production-environment.md`, `docs/deployment-guide.md`, `docs/backup-and-rollback.md`, and `docs/production-smoke-tests.md`.

### Known Limitations
- **Pending Live Database Migrations**: Migrations for Phase 7 (evidence RLS), Phase 8 (analytics views), and Phase 9 (declarative policies) reside in `supabase/migrations/` and have been verified with 200 automated tests, but remain unapplied on the live database per hackathon safety protocols.
- **Ollama Local Hardware Dependency**: Running Ollama requires a local Ollama process; offline fallback mock ensures zero disruption if Ollama is offline.
- **Scanned PDF OCR**: Ingestion parses native digital text streams from PDF and DOCX files; image-only scanned PDFs require external OCR pre-processing.
