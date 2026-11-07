# BrandShield AI — Security, Authorization & RLS Specification

## 1. Security Architecture & Threat Model

BrandShield AI enforces defense-in-depth across the web application, API transport, and PostgreSQL persistence layers:

1. **Zero Secret Key Exposure**:
   - High-privilege credentials (`SUPABASE_DATABASE_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) are exclusively accessible to server-side code.
   - Client bundles strictly receive public tokens (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - `.env.local` and all secret-bearing files are protected by `.gitignore`.
2. **Database-Level Immutability**:
   - The compliance audit log (`audit_events`) is protected by a PostgreSQL database trigger (`trg_audit_events_immutable`).
   - Any `UPDATE` or `DELETE` executed against `audit_events`—even by authenticated administrators—raises an unhandled database exception (`RAISE EXCEPTION 'audit_events is append-only'`).
3. **Workspace Multi-Tenant Isolation**:
   - All data rows belong to a tenant workspace (`workspace_id`).
   - Foreign workspace records cannot be queried or mutated through the application layer.

---

## 2. Role-Based Access Control (RBAC)

The application models 4 distinct compliance roles:

| Role | Permissions | Restrictions |
| :--- | :--- | :--- |
| **Administrator** | Manage policies, configure AI providers, view audit logs, manage workspaces. | Cannot delete or alter audit logs. |
| **Compliance Reviewer** | Review claims, approve supported claims, record modifications, request escalations. | Must provide documented rationale ($\ge 10$ chars) to approve contradicted/high-risk claims. |
| **Legal Reviewer** | Review escalated claims, authorize clinical claims, verify publication eligibility. | Restricted from modifying system-wide regulatory policies. |
| **Viewer** | Read-only access to submissions, claims, and dashboard metrics. | Strictly prohibited from recording review decisions or triggering publication. |

---

## 3. Row Level Security (RLS) Policies

All tables in the Supabase PostgreSQL database have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

| Table | Policy Name | Permitted Roles | SQL Command | RLS Condition |
| :--- | :--- | :--- | :--- | :--- |
| `workspaces` | `Public read workspace DermaGlow` | `anon`, `authenticated` | `SELECT` | `slug = 'dermaglow'` |
| `products` | `Public read products for DermaGlow` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `approved_facts`| `Public read approved facts for DermaGlow`| `anon`, `authenticated`| `SELECT` | `product_id IN (SELECT id FROM products WHERE workspace_id = ...)` |
| `promotions` | `Public read promotions for DermaGlow` | `anon`, `authenticated` | `SELECT` | `product_id IN (SELECT id FROM products WHERE workspace_id = ...)` |
| `source_documents`| `Public read source documents` | `anon`, `authenticated` | `SELECT` | `workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')` |
| `submissions` | `Public read submissions for DermaGlow` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow workspace |
| `submissions` | `Authenticated users can insert submissions` | `authenticated` | `INSERT` | Must match target workspace |
| `claims` | `Public read claims` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow submission |
| `claim_evidence` | `Public read claim evidence` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow claim |
| `review_decisions`| `Authenticated reviewers can insert decisions`| `authenticated` | `INSERT` | Belongs to authorized claim |
| `audit_events` | `Public read audit events for DermaGlow` | `anon`, `authenticated` | `SELECT` | Belongs to DermaGlow workspace |
| `audit_events` | `Authenticated users can insert audit events` | `authenticated` | `INSERT` | Append-only insertion |

> [!IMPORTANT]
> Unconditional `USING (true)` policies are strictly prohibited. All public demo reads are scoped strictly to the `DermaGlow` workspace to prevent multi-tenant data leakage.

---

## 4. Secret Sanitization in Health & Telemetry

The system health diagnostic endpoint (`/api/health`) and UI modal (`SystemHealthModal.tsx`) inspect database latency and provider reachability. To guarantee zero credential exposure:
1. Database URLs are sanitized using regex masks (`postgresql://user:***@host:port/db`).
2. Authentication tokens (`HF_TOKEN`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are stripped before serialization.
3. Automated test `scripts/phase15-reliability-test.ts` asserts that health payloads never contain cleartext passwords or secret keys.

---

## 5. Known Security Limitations & Mitigations

1. **Demonstration Workspace Public Read**:
   - *Limitation*: For the hackathon demonstration, public `SELECT` policies are enabled for the `DermaGlow` workspace to allow frictionless judge evaluation without requiring individual logins.
   - *Mitigation*: Public access is strictly read-only. Mutation operations (`INSERT`, `UPDATE`, `DELETE`) require authenticated or service roles.
2. **Pending Phase 7 RLS Hardening**:
   - *Limitation*: The revised Phase 7 migration (`20261105050000_phase7_evidence_intelligence.sql`) containing strict approved-fact-only evidence isolation is pending execution on the live database.
   - *Mitigation*: Application-level validation in `evidence-sufficiency.ts` strictly enforces foreign key checks and workspace isolation before writing claim evidence links.
