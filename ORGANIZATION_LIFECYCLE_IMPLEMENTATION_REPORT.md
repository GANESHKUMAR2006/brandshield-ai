# BrandShield AI — Organization Deletion & Lifecycle Management Implementation Report

**Document ID:** `BS-REP-LIFECYCLE-20261110`  
**Security Classification:** Enterprise Regulatory & Multi-Tenant Access Control  
**Target Platform:** BrandShield AI — Regulated Marketing Claim Governance Engine  
**Release Target:** Production (`main` branch)  
**Regulatory Standards:** FDA 21 CFR Part 11, FTC Marketing Substantiation (16 CFR § 255), ISO 22716 Good Manufacturing Practice (GMP), SOC 2 Type II Compliance

---

## 1. Executive Summary

BrandShield AI requires a secure, legally sound organization lifecycle workflow for enterprise customers who retire or sunset brand workspaces. In pharmaceutical, cosmetic, and healthcare marketing governance, permanent physical deletion (`DELETE FROM workspaces CASCADE`) is strictly forbidden:

1. **Regulatory Retention Mandate:** FDA 21 CFR Part 11 and FTC marketing substantiation laws require that all evidence evaluations, clinical citations, claim verification records, reviewer electronic sign-offs, and tamper-evident audit logs be preserved in an immutable, auditable state for regulatory inspections and legal discovery.
2. **Spoliation of Evidence Prevention:** A cascade hard-deletion destroys compliance audit trails, constituting spoliation of legal and regulatory evidence.
3. **Multi-Tenant State Isolation:** Retiring an organization must immediately revoke operational access, suspend active user memberships, invalidate pending invitations, and prevent new submissions, while strictly ensuring adjacent tenant records remain untouched.

To meet these strict regulatory and technical standards, we designed and implemented **Compliance Archival Lifecycle Management**:
- **Soft Deletion / Archival as Primary Operation:** Organizations transition into an immutable `'archived'` state.
- **Permanent Deletion Policy:** Physical hard deletion is permanently disabled in the UI and blocked by the API with an explicit regulatory compliance notice citing FDA 21 CFR Part 11 and FTC substantiation requirements.
- **Multi-Tenant RBAC & Exact Name Confirmation:** Archival requires verified Supabase session authentication, verified `admin` role in the workspace, and exact case-insensitive organization name entry.
- **Atomic Database Transitions:** Workspaces transition to `'archived'`, active memberships to `'suspended'`, pending invitations to `'revoked'`, and an immutable tamper-evident audit event is recorded.

---

## 2. Audit of Existing Implementation & Architecture

| Component | Pre-Implementation Audit State | Implementation Action Taken |
| :--- | :--- | :--- |
| `src/app/api/workspaces/[id]/route.ts` | Contained `GET` and `PATCH`. No `DELETE` endpoint existed. | Implemented `DELETE /api/workspaces/[id]` with server session identity, UUID validation, admin RBAC check, name confirmation, and atomic multi-entity archival. |
| `src/app/api/workspaces/route.ts` | Returned all active memberships without filtering archived workspaces. | Added filtering to omit archived organizations by default (`status != 'archived'`), while supporting `?includeArchived=true` for compliance auditors. |
| `src/lib/auth/server-session.ts` | Resolved any active membership without checking workspace status. | Added filter `(w.status IS NULL OR w.status != 'archived')` to prevent archived organizations from being resolved for active sessions. |
| `src/app/api/submissions/route.ts` | Checked workspace existence by slug without verifying status. | Enforced check: rejects submissions on archived workspaces with HTTP 403 `WorkspaceAccessError`. |
| `src/app/settings/page.tsx` | Contained General, Team, Diagnostics tabs. No Danger Zone existed. | Added **Danger Zone — Organization Lifecycle** in General tab; visible only to Administrators, with Archive Action and disabled Delete Action. |
| `src/components/workspace/` | Contained `CreateOrganizationModal`, `InviteMemberModal`, `WorkspaceSwitcher`. | Built `ArchiveOrganizationModal.tsx` with modal portal, impact warnings, compliance preservation notices, and exact name confirmation. |
| `supabase/migrations/` | `workspaces` table lacked lifecycle status, archival timestamp, and actor audit. | Created `20261113000000_workspace_lifecycle_archival.sql` adding `status`, `archived_at`, `archived_by`, and performance index `idx_workspaces_status`. |

---

## 3. Data Safety & Retention Analysis

### 3.1 Foreign Key Cascade Risk Evaluation
An audit of `supabase/migrations/20261105000000_initial_schema.sql` and `20261110000000_round3_multi_tenancy.sql` revealed foreign keys configured with `ON DELETE CASCADE`:
- `products` -> `workspaces(id) ON DELETE CASCADE`
- `source_documents` -> `workspaces(id) ON DELETE CASCADE`
- `submissions` -> `workspaces(id) ON DELETE CASCADE`
- `claims` -> `submissions(id) ON DELETE CASCADE`
- `claim_evidence` -> `claims(id) ON DELETE CASCADE`
- `review_decisions` -> `claims(id) ON DELETE CASCADE`
- `audit_events` -> `workspaces(id) ON DELETE CASCADE`
- `policies` -> `workspaces(id) ON DELETE CASCADE`
- `workspace_memberships` -> `workspaces(id) ON DELETE CASCADE`
- `workspace_invitations` -> `workspaces(id) ON DELETE CASCADE`

Furthermore, `prevent_audit_tampering()` enforces audit trail immutability:
```sql
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;
```
If an administrator executes a SQL `DELETE FROM workspaces`, the cascade would either trigger a database exception from `prevent_audit_tampering()` or destroy all evidence, review determinations, and audit logs.

### 3.2 Regulatory Retention Conclusion
Under FDA 21 CFR Part 11, FTC Marketing Substantiation, and ISO 22716, **permanent physical deletion of workspaces is legally and technically unsafe**. Therefore:
- Permanent hard deletion is disabled across all user-facing interfaces and backend APIs.
- The lifecycle operation for workspace termination is **Compliance Archival**.

---

## 4. Backend Architecture & Security Safeguards

### 4.1 Database Migration (`20261113000000_workspace_lifecycle_archival.sql`)
An idempotent PostgreSQL migration was created:
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'status'
  ) THEN
    ALTER TABLE workspaces 
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
      CHECK (status IN ('active', 'archived', 'suspended'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE workspaces ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE workspaces ADD COLUMN archived_by UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
```

### 4.2 Endpoint Implementation (`DELETE /api/workspaces/[id]`)
Located in [`src/app/api/workspaces/[id]/route.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/api/workspaces/[id]/route.ts):

1. **Authentication:** Authenticates exclusively via validated Supabase server session (`resolveAuthenticatedUser`). Rejects unauthenticated callers with HTTP 401.
2. **UUID Integrity:** Validates that both the URL parameter `id` and the resolved `user.id` are valid RFC 4122 UUIDs. Non-UUID strings (including legacy demo IDs like `"usr-01-elena"`) are rejected immediately.
3. **RBAC & Multi-Tenant Scoping:** Queries `workspace_memberships` for `workspace_id = id AND user_id = user.id AND status = 'active'`. If the caller is not an active member or their role is not `'admin'`, returns HTTP 403 Forbidden.
4. **Permanent Delete Rejection:** If `body.hardDelete === true`, rejects with HTTP 400:
   > *"Permanent hard deletion is prohibited under compliance regulations (FDA 21 CFR Part 11, FTC Marketing Substantiation, ISO 22716). All records must be preserved via Archival."*
5. **Exact Name Confirmation:** Validates `confirmName.trim().toLowerCase() === ws.name.trim().toLowerCase()`. Returns HTTP 400 if mismatched.
6. **Atomic Transaction (`withTransaction`):**
   - Updates `workspaces`: sets `status = 'archived'`, `archived_at = now()`, `archived_by = user.id`.
   - Updates `workspace_memberships`: sets `status = 'suspended'` for all active members in the workspace.
   - Updates `workspace_invitations`: sets `status = 'revoked'` for all pending invitations.
   - Appends audit event: records `action: 'workspace_archived'` with before/after state snapshots.
7. **Telemetry & Sanitized Errors:** Catches unexpected errors, logs them securely on the server with a generated `correlationId`, and returns sanitized JSON without exposing database internals.

---

## 5. Frontend UI & Danger Zone Experience

### 5.1 Settings Page Danger Zone
Located in [`src/app/settings/page.tsx`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/settings/page.tsx):
- Placed in the **General & Governance** tab.
- Rendered with a dedicated rose/warning styling and "Admin Access Only" badge.
- If the active user does not have an `'admin'` role, displays an informational lockout card explaining that organization lifecycle actions require Workspace Administrator privileges.
- For Administrators, provides two distinct action cards:
  1. **Archive Organization:**
     - Displays Organization Name and Workspace Slug.
     - Details the lifecycle impact (membership suspension, invitation cancellation, read-only retention, regulatory evidence preservation).
     - Provides an "Archive Organization" action button opening `ArchiveOrganizationModal`.
  2. **Permanently Delete Organization:**
     - Clearly marked with a "Disabled by Policy" badge.
     - Explains the regulatory reasoning (FDA 21 CFR Part 11, FTC Marketing Substantiation, ISO 22716 spoliation rules).
     - Action button is permanently disabled with lock icon.

### 5.2 Archive Organization Modal
Located in [`src/components/workspace/ArchiveOrganizationModal.tsx`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/components/workspace/ArchiveOrganizationModal.tsx):
- **Portal Rendering:** Renders into `document.body` via React Portal with backdrop blur, preventing parent container clipping.
- **Header & Footer Pinning:** Pinned header with warning styling and pinned footer with action buttons; scrollable content area.
- **Warning Details:** Lists consequences (active membership suspension, invitation revocation, exclusion from workspace switchers, submission blocking).
- **Compliance Callout:** Informs the user that clinical documents, extracted claims, and audit history are permanently preserved.
- **Exact Name Confirmation:** Requires typing the exact organization name to activate the "Archive Organization" button.
- **Optional Reason Field:** Allows documenting an administrative reason for the archival.
- **Keyboard & Focus Handling:** Traps focus, handles Escape key, restores focus on close, and disables background scrolling.
- **Graceful Workspace Switching:** Upon archival, clears active workspace from localStorage, queries remaining workspaces via `fetchWorkspaces()`, switches to the next available active workspace, or redirects to `/workspaces` if no active workspaces remain.

---

## 6. Automated Verification & Test Results

A comprehensive automated regression suite was developed in [`scripts/test-organization-lifecycle.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/scripts/test-organization-lifecycle.ts) alongside existing multi-tenant test suites.

### 6.1 Test Suite Execution Summary

```
========================================================================
 BRANDSHIELD AI: ORGANIZATION LIFECYCLE & ARCHIVAL VERIFICATION SUITE   
========================================================================

--- Suite 1: Authentication & Format Guards ---
  [PASS] 1.1 Unauthenticated request fails closed with HTTP 401
  [PASS] 1.2 Non-UUID workspace ID rejected with HTTP 400

--- Suite 2: Multi-Tenant RBAC & Cross-Tenant Rejection ---
  [PASS] 2.1 Cross-tenant user rejected with HTTP 403
  [PASS] 2.2 Compliance Reviewer role rejected with HTTP 403

--- Suite 3: Name Confirmation & Regulatory Protections ---
  [PASS] 3.1 Mismatched organization name returns HTTP 400
  [PASS] 3.2 Informative confirmation mismatch error returned
         └─ Organization name confirmation does not match. Expected "Lumina Therapeutics".
  [PASS] 3.3 Hard delete request strictly rejected with HTTP 400
  [PASS] 3.4 Cites FDA 21 CFR Part 11 and FTC compliance retention requirement
         └─ Permanent hard deletion is prohibited under compliance regulations (FDA 21 CFR Part 11, FTC Marketing Substantiation, ISO 22716). All records must be preserved via Archival.

--- Suite 4: Authorized Archival Execution & Atomic State Transition ---
  [PASS] 4.1 Authorized admin archival succeeds with HTTP 200
  [PASS] 4.2 Response indicates success = true
  [PASS] 4.3 Response payload returns workspace.status = 'archived'
  [PASS] 4.4 Workspace table status set to 'archived'
  [PASS] 4.5 Workspace table archived_at timestamp recorded
  [PASS] 4.6 Workspace table archived_by records administrator UUID
  [PASS] 4.7 All active memberships for the archived workspace are set to 'suspended'
  [PASS] 4.8 Other workspace memberships remain 'active' (no cross-tenant leakage)
  [PASS] 4.9 Pending invitations transition to 'revoked'
  [PASS] 4.10 Append-only audit trail records 'workspace_archived' event
  [PASS] 4.11 Audit record correctly attributes actor UUID
  [PASS] 4.12 Audit after_state records archived status
  [PASS] 4.13 Attempting to re-archive an already archived organization returns HTTP 400

--- Suite 5: Post-Archival Filtering & Workspace Isolation ---
  [PASS] 5.1 GET /api/workspaces omits archived organization from active list
  [PASS] 5.2 GET /api/workspaces?includeArchived=true includes archived workspaces for audit reviews
  [PASS] 5.3 Submission creation on archived workspace blocked with HTTP 403 Forbidden

--- Suite 6: Transaction Atomicity & Failure Rollback ---
  [PASS] 6.1 Database failure returns HTTP 500
  [PASS] 6.2 Returns sanitized correlationId for audit telemetry
         └─ 9e17c1ed-76c5-423d-9373-5fee60025d42

========================================================================
 RESULTS: 26 PASSED, 0 FAILED (TOTAL: 26)
========================================================================
```

### 6.2 Regression Verification Across All Suites

| Verification Suite | Target | Result |
| :--- | :--- | :--- |
| `scripts/test-organization-lifecycle.ts` | Archival API, RBAC, Name Confirmation, Atomic Suspension, Audit Logging | **26/26 PASSED** |
| `scripts/test-create-organization-uuid-identity.ts` | Server session UUID resolution, Demo ID rejection, 401 fail-close | **27/27 PASSED** |
| `scripts/test-workspace-isolation.ts` | Multi-tenant isolation, cross-tenant rejection, no hardcoded fallbacks | **52/52 PASSED** |
| `npm test` | Phase 15 reliability (9), Phase 6 review engine (32), Phase 10D offsets (75) | **116/116 PASSED** |
| `npx tsc --noEmit` | Strict TypeScript compilation across the entire project | **0 ERRORS** |
| `npm run build` | Turbopack production compilation & static/dynamic route generation (41 routes) | **BUILD SUCCESS** |

---

## 7. Modified & Created Files

1. [`supabase/migrations/20261113000000_workspace_lifecycle_archival.sql`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/supabase/migrations/20261113000000_workspace_lifecycle_archival.sql) — Non-destructive database migration for workspace lifecycle tracking (`status`, `archived_at`, `archived_by`, index).
2. [`src/app/api/workspaces/[id]/route.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/api/workspaces/[id]/route.ts) — Added `DELETE /api/workspaces/[id]` archival endpoint and enhanced `GET` with lifecycle status.
3. [`src/app/api/workspaces/route.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/api/workspaces/route.ts) — Filtered archived workspaces out of active lists while supporting `?includeArchived=true`.
4. [`src/lib/auth/server-session.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/lib/auth/server-session.ts) — Enforced active workspace lifecycle validation in session resolution.
5. [`src/app/api/submissions/route.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/api/submissions/route.ts) — Blocked new submissions on archived workspaces with HTTP 403 `WorkspaceAccessError`.
6. [`src/lib/api-client.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/lib/api-client.ts) — Added `archiveWorkspace` client function.
7. [`src/components/workspace/ArchiveOrganizationModal.tsx`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/components/workspace/ArchiveOrganizationModal.tsx) — Full-featured confirmation modal with impact warnings, exact name verification, and compliance notes.
8. [`src/app/settings/page.tsx`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/src/app/settings/page.tsx) — Added Danger Zone section with Archive Organization and disabled Delete Organization controls.
9. [`scripts/test-organization-lifecycle.ts`](file:///c:/Users/ganes/OneDrive/Documents/html/brandshield-ai/scripts/test-organization-lifecycle.ts) — 26-test automated regression suite verifying lifecycle transitions, RBAC, and transaction atomicity.

---

## 8. Conclusion & Sign-Off

The Organization Deletion & Lifecycle Management system is fully implemented, verified, and compliant with FDA 21 CFR Part 11, FTC substantiation, and ISO 22716 standards. All audit trails and historical records are preserved, active tenant resources are protected against cross-tenant access, and automated test suites confirm production readiness.
