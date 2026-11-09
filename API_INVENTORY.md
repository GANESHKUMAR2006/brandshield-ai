# BrandShield AI — Complete API Route Inventory
## CodeNexus Round 3 API Catalog & Endpoint Matrix

---

## 1. Existing Route Handler Inventory (28 Endpoints)

### 1.1 Authentication & Session Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | No (Public) | None | `{ email, password }` | Set session cookie, `{ user, role, workspaces }` |
| `POST` | `/api/auth/logout` | Yes | Viewer | None | Clear session cookies, `{ success: true }` |
| `GET` | `/api/auth/me` | Yes | Viewer | None | Current user session identity, role, workspace |
| `POST` | `/api/auth/forgot-password` | No (Public) | None | `{ email }` | Dispatches recovery link via Supabase Auth |

### 1.2 Submissions & Campaign Governance Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/submissions` | Yes | Viewer | Query params (status, search) | List of submissions with claim summary stats |
| `POST` | `/api/submissions` | Yes | Creator / Reviewer | `{ title, content, channel, submitted_by }` | Created submission record with version 1 |
| `GET` | `/api/submissions/[id]` | Yes | Viewer | URL parameter `id` | Full submission details, versions, active claims |
| `POST` | `/api/submissions/[id]/extract` | Yes | Creator / Reviewer | None | Invokes Groq LLM, calculates offsets, extracts claims |
| `POST` | `/api/submissions/[id]/verify` | Yes | Compliance Reviewer | None | Runs verification router across all extracted claims |
| `GET` | `/api/submissions/[id]/publication-status` | Yes | Viewer | URL parameter `id` | Evaluates publication eligibility gate, blocking reasons |

### 1.3 Claims & Deterministic Verification Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/claims` | Yes | Viewer | Query params (submission_id, status) | List of claims with offsets, types, and statuses |
| `GET` | `/api/claims/[id]` | Yes | Viewer | URL parameter `id` | Claim details, linked evidence, verification runs |
| `GET` | `/api/claims/[id]/evidence` | Yes | Viewer | URL parameter `id` | Linked clinical excerpts and relevance scores |
| `POST` | `/api/claims/[id]/verify` | Yes | Compliance Reviewer | None | Single-claim verification execution |

### 1.4 Evidence Sources & Ingestion Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/sources` | Yes | Viewer | Query params (status, search) | List of source documents, current versions, dates |
| `POST` | `/api/sources/ingest` | Yes | Admin / Reviewer | Multipart form (file, title, docType) | Parses text/docx/pdf, chunks, embeds, saves to pgvector |

### 1.5 Policy Intelligence & Compliance Studio Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/policies` | Yes | Viewer | Query params (category, status, search) | List of master policies, rules count, active version |
| `POST` | `/api/policies` | Yes | Admin | `{ name, code, category, description, rules }` | Creates policy draft and version 1 |
| `GET` | `/api/policies/[id]` | Yes | Viewer | URL parameter `id` | Full policy details, active version rules |
| `GET` | `/api/policies/[id]/versions`| Yes | Viewer | URL parameter `id` | Complete version history of the policy |
| `POST` | `/api/policies/[id]/activate`| Yes | Admin | `{ versionId }` | Activates policy version, triggers immutability |
| `POST` | `/api/policies/[id]/archive` | Yes | Admin | None | Archives policy, deactivates rule enforcement |
| `POST` | `/api/policies/simulate` | Yes | Compliance Reviewer | `{ sampleClaims: [{ claim_text, claim_type }] }` | In-memory evaluation against draft rules |

### 1.6 Review Decisions & Human Oversight Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reviews` | Yes | Viewer | Query params (status, claim_id) | Review queue items, pending claims, decisions |
| `POST` | `/api/reviews` | Yes | Compliance / Legal Reviewer | `{ claim_id, decision, comments, override_reason }` | Records review decision, updates claim state |

### 1.7 Catalog, Analytics, Audit & Health Domain

| Method | Endpoint | Auth Required | Minimum Role | Request Payload | Response Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Yes | Viewer | Query params (status) | Product SKU catalog, reference prices, ingredients |
| `GET` | `/api/dashboard/stats` | Yes | Viewer | None | Executive KPI metrics, active claims count |
| `GET` | `/api/analytics/summary` | Yes | Reviewer / Admin | None | Workspace compliance ratios, verification distribution |
| `GET` | `/api/analytics/insights`| Yes | Reviewer / Admin | None | Trend telemetry, violation breakdown |
| `GET` | `/api/audit` | Yes | Viewer / Admin | Query params (entity_type, actor, dates) | Immutable audit log events, before/after states |
| `GET` | `/api/health` | No (Public) | None | None | Application health, database & LLM provider status |

---

## 2. New & Enhanced APIs Required for Round 3

### 2.1 Workspace & Multi-Tenancy Management (Phase 1)

1. `GET /api/workspaces`
   - **Access:** Authenticated Users
   - **Returns:** List of workspaces the user is an active member of.
2. `POST /api/workspaces`
   - **Access:** Authenticated Users
   - **Payload:** `{ name: string, slug?: string, domain?: string }`
   - **Behavior:** Creates new organization workspace and assigns creator as `admin` in `workspace_memberships`.
3. `GET /api/workspaces/[id]/members`
   - **Access:** Workspace Admin
   - **Returns:** Active members, emails, roles, join dates.
4. `POST /api/workspaces/[id]/invitations`
   - **Access:** Workspace Admin
   - **Payload:** `{ email: string, role: "admin" | "compliance_reviewer" | "legal_reviewer" | "creator" | "viewer" }`
   - **Behavior:** Dispatches invitation token and persists to `workspace_invitations`.
5. `POST /api/workspaces/invitations/accept`
   - **Access:** Authenticated User
   - **Payload:** `{ token: string }`
   - **Behavior:** Validates expiration and binds user to workspace in `workspace_memberships`.
6. `DELETE /api/workspaces/[id]/invitations/[inviteId]`
   - **Access:** Workspace Admin
   - **Behavior:** Revokes pending invitation.

### 2.2 Evidence Citation & Document Viewer (Phase 2)

1. `GET /api/sources/[id]/content`
   - **Access:** Viewer
   - **Returns:** Raw source text/structure with page boundaries for client-side citation viewer rendering.
2. `GET /api/claims/[id]/citation`
   - **Access:** Viewer
   - **Returns:** Exact document ID, page number, character offsets, matched excerpt, and source validity status for interactive highlighting.

### 2.3 Policy QA Dataset Simulation (Phase 3)

1. `GET /api/policies/qa-dataset`
   - **Access:** Compliance Reviewer / Admin
   - **Returns:** Curated suite of test claims covering all 6 baseline categories to simulate policy changes against historical benchmarks.
