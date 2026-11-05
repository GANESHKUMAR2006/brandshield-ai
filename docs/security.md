# BrandShield AI — Security & Row Level Security (RLS) Specification

## 1. Security Architecture & Threat Model

BrandShield AI operates on a multi-layer security model:
1. **Zero Secret Key Exposure**: Server-only connection credentials (`SUPABASE_DATABASE_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`) are stored strictly in server environments and are never bundled into client-facing JavaScript.
2. **Browser-Safe Client Credentials**: Browser clients communicate strictly via `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. **Database-Level Immutability**: Critical compliance audit logs (`audit_events`) are protected by a PL/pgSQL database trigger (`trg_audit_events_immutable`) that throws exceptions on any `UPDATE` or `DELETE` attempt.
4. **Environment Isolation**: `.env.local` and secret files are protected by `.gitignore`.

---

## 2. Row Level Security (RLS) Policies

Every table in the `public` schema has Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

### Summary of Policies Applied:

| Table | Policy Name | Permitted Role | Operation | Condition / Expression |
|---|---|---|---|---|
| `workspaces` | `Public read workspace DermaGlow` | `anon`, `authenticated` | `SELECT` | `slug = 'dermaglow'` |
| `products` | `Public read products for DermaGlow` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `approved_facts` | `Public read approved facts for DermaGlow` | `anon`, `authenticated` | `SELECT` | `product_id IN (SELECT id FROM products WHERE workspace_id = ...)` |
| `promotions` | `Public read promotions for DermaGlow` | `anon`, `authenticated` | `SELECT` | `product_id IN (SELECT id FROM products WHERE workspace_id = ...)` |
| `source_documents` | `Public read source documents for DermaGlow` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `document_versions` | `Public read document versions` | `anon`, `authenticated` | `SELECT` | `source_document_id IN (SELECT id FROM source_documents ...)` |
| `document_chunks` | `Public read document chunks` | `anon`, `authenticated` | `SELECT` | Document version belongs to DermaGlow workspace |
| `submissions` | `Public read submissions for DermaGlow` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `submission_versions`| `Public read submission versions` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow submission |
| `claims` | `Public read claims` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow submission |
| `claim_evidence` | `Public read claim evidence` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow claim |
| `verification_runs` | `Public read verification runs` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow claim |
| `review_decisions` | `Public read review decisions` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow claim |
| `audit_events` | `Public read audit events for DermaGlow` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `submissions` | `Authenticated users can insert submissions` | `authenticated` | `INSERT` | Must belong to valid workspace |
| `review_decisions` | `Authenticated reviewers can insert decisions`| `authenticated` | `INSERT` | Must belong to valid claim |
| `audit_events` | `Authenticated users can insert audit events` | `authenticated` | `INSERT` | Must belong to valid workspace |

*Note: Unconditional `USING (true)` policies are strictly prohibited. All public reads are scoped to the demonstration workspace.*

---

## 3. Database Constraints & Invariants

1. **Date Invariants**:
   - `approved_facts`: `CHECK (valid_until IS NULL OR valid_from <= valid_until)`
   - `document_versions`: `CHECK (valid_until IS NULL OR valid_from <= valid_until)`
   - `promotions`: `CHECK (start_date <= end_date)`
2. **Value Invariants**:
   - `products.reference_price`: `CHECK (reference_price >= 0)`
   - `promotions.resulting_price`: `CHECK (resulting_price >= 0)`
   - `claims.extraction_confidence`: `CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1)`
   - `claim_evidence.relevance_score`: `CHECK (relevance_score >= 0 AND relevance_score <= 1)`
3. **Enum Protections**:
   - `claims.verification_status IN ('supported', 'contradicted', 'outdated', 'unverified', 'needs_review')`
   - `verification_runs.risk_level IN ('low', 'medium', 'high', 'critical')`
   - `review_decisions.decision IN ('approved', 'rejected', 'escalated', 'modified')`
4. **Append-Only Immutability**:
   - `audit_events`: Any attempt to execute `UPDATE` or `DELETE` triggers a PL/pgSQL exception.

---

## 4. Phase 3 Security Verification & Findings

During Phase 3 pre-flight and automated testing, the following security guarantees were verified with live tests:
- **Anonymous Mutation Prevention**: Tests verified that anonymous PostgREST clients attempting `INSERT`, `UPDATE`, or `DELETE` on `audit_events`, `submissions`, and `products` are blocked with PostgreSQL error code `42501` (insufficient privileges).
- **Tenant Isolation**: Foreign workspace queries return zero rows.
- **Audit Immutability**: Database triggers `trg_audit_events_immutable` successfully abort any attempt to `UPDATE` or `DELETE` records from `audit_events`.
- **Temporal Integrity**: Expiration flags and promotion active periods are determined with SQL timestamp checks (`valid_from <= now()` and `valid_until >= now()`).
- **Credential Hygiene**: Server secrets (`SUPABASE_DATABASE_URL`, `SUPABASE_DB_PASSWORD`) do not leak into client JavaScript bundles. Only `NEXT_PUBLIC_` variables are accessible in browser runtime.
