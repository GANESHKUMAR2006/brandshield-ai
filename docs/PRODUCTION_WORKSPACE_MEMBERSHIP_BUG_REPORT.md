# BrandShield AI — Production Workspace and Membership Bug Investigation Report

**Document Version:** 1.0.0  
**Date:** November 13, 2026  
**Auditor / Investigator:** Senior Full-Stack Systems & Database Engineer  
**Workspace:** BrandShield AI (`d:\BrandShield\brandshield-ai`)  
**Target Environment:** Production PostgreSQL (Supabase) & Next.js 14 App Router  
**Investigation Mode:** Read-Only Source Code & Live Production Database Verification  

---

## Executive Summary

A comprehensive forensic investigation of the deployed BrandShield AI workspace and team management subsystems was conducted to analyze two reported production anomalies:
1. **Workspace Creation Conflict (`bio-tech` slug conflict):** A modal error notification stating `Workspace slug "bio-tech" is already in use. Please choose another.`
2. **Inconsistent Active Member Counts & Displayed Roster:** Two user sessions in the DermaGlow workspace displayed disparate states:
   - **Screenshot A:** 4 active members and 1 pending invitation (Sarah Chen, Marcus Vance, Elena Rostova, Alex Rivera; pending invite: Jordan Taylor).
   - **Screenshot B:** 3 active members and 2 pending invitations (Dr. Elena Vance, Marcus Brody, Esq., Compliance Administrator; 2 pending invitations).

### Summary of Verdicts

| Issue | Title | Classification | Impact | Summary |
|---|---|---|---|---|
| **Issue 1** | Workspace slug "bio-tech" conflict | **Expected Platform Behavior** (PostgreSQL Unique Constraint & Controlled 409 Conflict) | None / Graceful Recovery | A workspace with slug `"bio-tech"` (`id: 702ee8e7-568a-4492-bd89-e66619d745c8`) already exists in the live database. The API properly returns `HTTP 409 Conflict`, and the UI non-destructively presents an inline recoverable error while preserving form inputs. |
| **Issue 2** | Inconsistent Active Member Counts (4 vs 3 members; 1 vs 2 invites) | **Confirmed Bug — Dual Defect:**<br>1. Client-Side Mock Data Flash / Failure Fallback<br>2. Missing Status Filters on Backend API and UI Counters | High / User Confusion | **Screenshot A displays hardcoded mock fallback constants (`DEFAULT_MEMBERS` [4] and `DEFAULT_INVITATIONS` [1])**, triggered either during initial mount or when team API requests abort/fail/return 403. **Screenshot B displays live database rows**, but reveals that `Pending Invitations (2)` includes **revoked** invitations due to missing `WHERE status = 'pending'` filtering in `api/workspaces/[id]/invitations/route.ts`. |

---

## Section 1: Issue 1 — Workspace Creation Slug Collision

### 1.1 Observed Behavior
When attempting to create a new organization with the slug `"bio-tech"`, the user interface displays the following alert message:
> `Workspace slug "bio-tech" is already in use. Please choose another.`

The modal remains open, form inputs remain intact, and no crash or unhandled runtime rejection occurs.

---

### 1.2 Database & Schema Verification

We inspected the PostgreSQL schema and queried the live production database (`workspaces` table) to verify constraint enforcement:

1. **Schema Definition:**
   In [supabase/migrations/20261105000000_initial_schema.sql](file:///d:/BrandShield/brandshield-ai/supabase/migrations/20261105000000_initial_schema.sql#L36-L45):
   ```sql
   CREATE TABLE workspaces (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       name TEXT NOT NULL,
       slug TEXT NOT NULL UNIQUE,
       domain TEXT,
       settings JSONB DEFAULT '{}'::jsonb,
       status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_workspaces_slug ON workspaces(slug);
   ```
   **Verification:** `slug` has an unconditional `UNIQUE` constraint and a dedicated B-tree index `idx_workspaces_slug`.

2. **Live Database Query:**
   A direct SQL query on the active database confirmed:
   ```sql
   SELECT id, name, slug, domain, status, created_at 
   FROM workspaces 
   WHERE slug = 'bio-tech';
   ```
   **Result:**
   - `id`: `702ee8e7-568a-4492-bd89-e66619d745c8`
   - `name`: `"Bio"`
   - `slug`: `"bio-tech"`
   - `domain`: `null`
   - `status`: `"active"`
   - `created_at`: `2026-11-13 14:04:36.657929+00`

The slug `"bio-tech"` is actively owned by an existing workspace record created in the current environment.

---

### 1.3 Backend API Verification

Inspecting [src/app/api/workspaces/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/route.ts#L204-L215):
```typescript
// Check slug uniqueness
const existingSlug = await query<{ id: string }>(
  `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
  [slug]
);

if (existingSlug.rows.length > 0) {
  return NextResponse.json(
    { success: false, error: `Workspace slug "${slug}" is already in use. Please choose another.` },
    { status: 409 }
  );
}
```
**Verification:**
- The API explicitly checks slug availability before attempting insertion.
- It returns HTTP status **409 Conflict** with an informative, human-readable error payload.
- If a race condition were to occur between two simultaneous requests, PostgreSQL's `UNIQUE` constraint on `slug` would reject the secondary insert and trigger the route's `try/catch` block, safely returning an error without database corruption.

---

### 1.4 Frontend Client Verification

Inspecting [src/components/workspace/CreateOrganizationModal.tsx](file:///d:/BrandShield/brandshield-ai/src/components/workspace/CreateOrganizationModal.tsx#L140-L191):
1. **Error Handling & State Recovery:**
   ```typescript
   try {
     const res = await fetch('/api/workspaces', { ... });
     const data = await res.json();
     if (!res.ok || !data.success) {
       setError(data.error || 'Failed to create workspace.');
       setIsSubmitting(false);
       return;
     }
     ...
   } catch (err: any) {
     setError(err.message || 'An unexpected error occurred.');
     setIsSubmitting(false);
   }
   ```
2. **Form Preservation:**
   - State variables `name`, `slug`, and `domain` are controlled React states (`useState`).
   - When `setError(...)` is called, `name`, `slug`, and `domain` are **not reset**.
   - The user can click into the "Workspace Slug" input field, edit the slug to a unique string (e.g., `"bio-tech-labs"`), and re-submit immediately without reloading or losing any data.
3. **Auto-Clear on User Input:**
   In [CreateOrganizationModal.tsx](file:///d:/BrandShield/brandshield-ai/src/components/workspace/CreateOrganizationModal.tsx#L250-L260):
   ```typescript
   onChange={(e) => {
     setName(e.target.value);
     if (error) setError(null);
     ...
   }}
   ```
   Editing any input automatically dismisses the stale error banner.

---

### 1.5 Classification & Recommendations (Issue 1)

- **Classification:** **Expected Platform Behavior** (Valid Business & Database Constraint Enforcement). Not a bug.
- **Recommended Architectural Improvements:**
  1. **Debounced Real-Time Slug Availability Check:** Introduce a lightweight check endpoint (`GET /api/workspaces/check-slug?slug=...`) debounced at 300ms. Display a real-time inline indicator (e.g., green checkmark or red "Slug unavailable" text) while the user types, before form submission.
  2. **Automated Slug Disambiguation:** If the suggested slug is taken, the client or backend can suggest an available suffix (e.g., `bio-tech-1` or `bio-tech-team`).

---

## Section 2: Issue 2 — Inconsistent Active Member Counts & Roster

### 2.1 Observed Behavior
Two screenshots taken of the team administration panel within the DermaGlow workspace display completely disparate data:

| Metric / Item | Screenshot A | Screenshot B | Live Database (DermaGlow) |
|---|---|---|---|
| **Active Members Count** | **4 active members** | **3 active members** | **3 active members** |
| **Member Row 1** | Sarah Chen (`sarah.chen@dermaglow.com`) | Dr. Elena Vance (`elena.vance@dermaglow.com`) | Dr. Elena Vance (`elena.vance@dermaglow.com`) |
| **Member Row 2** | Marcus Vance (`marcus.vance@dermaglow.com`) | Marcus Brody, Esq. (`marcus.brody@dermaglow.com`) | Marcus Brody, Esq. (`marcus.brody@dermaglow.com`) |
| **Member Row 3** | Elena Rostova (`elena.rostova@dermaglow.com`) | Compliance Administrator (`admin@dermaglow.com`) | Compliance Administrator (`admin@dermaglow.com`) |
| **Member Row 4** | Alex Rivera (`alex.rivera@dermaglow.com`) | *(None)* | *(None)* |
| **Pending Invitations Count**| **1 pending invitation** | **2 pending invitations** | **0 pending / 2 revoked invitations** |
| **Invitation Details** | Jordan Taylor (`jordan.taylor@dermaglow.com`) | 2 invitations (`tosaran09@gmail.com`, `sarans.cse2024@citchennai.net`) | 2 invitations (both status `'revoked'`) |

---

### 2.2 Forensic Analysis: Answers to the 9 Technical Questions

#### Question 1: User ID Resolution (Same vs Different Users)
* **Finding:** The two sessions resolved under different authentication/role contexts:
  - **Screenshot B (3 members, 2 invitations):** Resolved as an authenticated user with the **`admin`** role (specifically the `Compliance Administrator` account, `admin@dermaglow.com`).
  - **Screenshot A (4 members, 1 invitation):** Resolved either as a **non-admin role** (`compliance_reviewer`, `legal_reviewer`, or `marketing_creator`), or as an unauthenticated/mock fallback session.
* **Mechanism:**
  In [src/app/api/workspaces/[id]/invitations/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/invitations/route.ts#L23-L37):
  ```typescript
  if (!user || !canManageWorkspaceMembers(user.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Insufficient permissions to view invitations' },
      { status: 403 }
    );
  }
  ```
  In [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L400-L404):
  ```typescript
  if (invitesResult.status === 'fulfilled' && invitesResult.value) {
    setInvitations(invitesResult.value.length > 0 ? invitesResult.value : DEFAULT_INVITATIONS);
  } else {
    setInvitations(DEFAULT_INVITATIONS);
  }
  ```
  When any non-admin views the Settings page, the invitations fetch returns **HTTP 403 Forbidden**. The frontend catches this rejection and silently overwrites the invitation state with `DEFAULT_INVITATIONS` (which contains exactly **1** invitation for Jordan Taylor).

---

#### Question 2: Workspace UUID Resolution (Same UUID vs Different Workspaces)
* **Finding:** Both sessions target the **exact same workspace UUID**: `00000000-0000-0000-0000-000000000001`.
* **Database Verification:**
  ```sql
  SELECT id, name, slug FROM workspaces WHERE name ILIKE '%dermaglow%';
  ```
  **Result:** Exactly 1 row:
  - `id`: `00000000-0000-0000-0000-000000000001`
  - `name`: `"DermaGlow"`
  - `slug`: `"dermaglow"`
  There are no duplicate or shadow workspaces named DermaGlow.

---

#### Question 3: Database Environment Consistency
* **Finding:** There is only **one** unified database environment.
* Both API routes (`/api/workspaces/[id]/members` and `/api/workspaces/[id]/invitations`) connect to the single Supabase PostgreSQL instance via `@/lib/db`.
* There is no database read replica lag or split multi-tenant DB causing data fragmentation.

---

#### Question 4: Members API Behavior Across Refreshes and Sessions
* **Finding:** The API endpoint `GET /api/workspaces/[id]/members` is deterministic and always returns 3 records for DermaGlow when authenticated:
  1. `Dr. Elena Vance` (id: `00000000-0000-0000-0000-000000000002`, role: `compliance_reviewer`)
  2. `Marcus Brody, Esq.` (id: `00000000-0000-0000-0000-000000000003`, role: `legal_reviewer`)
  3. `Compliance Administrator` (id: `00000000-0000-0000-0000-000000000004`, role: `admin`)
* The 4 members displayed in Screenshot A (`Sarah Chen`, `Marcus Vance`, `Elena Rostova`, `Alex Rivera`) **do not exist anywhere in the database**. They are hardcoded mock constants inside [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L81-L118):
  ```typescript
  const DEFAULT_MEMBERS: WorkspaceMemberItem[] = [
    { id: 'usr-01', user_id: 'usr-01', name: 'Sarah Chen', email: 'sarah.chen@dermaglow.com', role: 'admin', status: 'active', joined_at: '2026-01-15T10:00:00Z' },
    { id: 'usr-02', user_id: 'usr-02', name: 'Marcus Vance', email: 'marcus.vance@dermaglow.com', role: 'legal_reviewer', status: 'active', joined_at: '2026-02-01T14:30:00Z' },
    { id: 'usr-03', user_id: 'usr-03', name: 'Elena Rostova', email: 'elena.rostova@dermaglow.com', role: 'compliance_reviewer', status: 'active', joined_at: '2026-02-15T09:15:00Z' },
    { id: 'usr-04', user_id: 'usr-04', name: 'Alex Rivera', email: 'alex.rivera@dermaglow.com', role: 'marketing_creator', status: 'active', joined_at: '2026-03-01T11:45:00Z' },
  ];
  ```

---

#### Question 5: Invitation & Membership Lifecycle Events
* **Database Inspection of Invitations:**
  ```sql
  SELECT id, email, role, status, expires_at, created_at 
  FROM workspace_invitations 
  WHERE workspace_id = '00000000-0000-0000-0000-000000000001';
  ```
  **Results:**
  1. `email`: `tosaran09@gmail.com` | `role`: `compliance_reviewer` | `status`: `revoked`
  2. `email`: `sarans.cse2024@citchennai.net` | `role`: `compliance_reviewer` | `status`: `revoked`

* **Finding:** There are **zero pending invitations** in DermaGlow. Both invitations have `status = 'revoked'`.
* Why Screenshot B showed `Pending Invitations (2)`:
  Inspecting [src/app/api/workspaces/[id]/invitations/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/invitations/route.ts#L42-L52):
  ```typescript
  const result = await query(
    `SELECT id, email, role, status, expires_at, created_at, invited_by
     FROM workspace_invitations
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );
  ```
  The SQL query fetches **all** invitation records regardless of status! It does not have `WHERE status = 'pending'`.
  Then, in [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L1279):
  ```tsx
  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
    Pending Invitations ({invitations.length})
  </span>
  ```
  The header badge literally displays `invitations.length`, labeling revoked invitations as "Pending Invitations".

---

#### Question 6: Client-Side Caching, Stale React State, and Initial Mount Flash
* **Finding:** In [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L152-L153):
  ```typescript
  const [members, setMembers] = useState<WorkspaceMemberItem[]>(DEFAULT_MEMBERS);
  const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>(DEFAULT_INVITATIONS);
  ```
  The React component initializes state directly with the 4-member mock dataset `DEFAULT_MEMBERS` and the 1-invitation mock dataset `DEFAULT_INVITATIONS`.
* When the page first mounts, React renders `DEFAULT_MEMBERS` immediately before the asynchronous network requests complete.
* Furthermore, if an API fetch fails or returns an empty array, the component actively falls back to the mock data:
  ```typescript
  if (membersResult.status === 'fulfilled' && membersResult.value) {
    setMembers(membersResult.value.length > 0 ? membersResult.value : DEFAULT_MEMBERS);
  } else {
    setMembers(DEFAULT_MEMBERS);
  }
  ```
  If a workspace genuinely has 0 members or the request aborts, it forces `DEFAULT_MEMBERS` onto the screen.

---

#### Question 7: Filtering Logic Inconsistencies (Active Members vs Displayed Rows)
* **Finding:** The header badge in [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L1158) says:
  ```tsx
  <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
    <span>Active Members</span>
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
      {members.length}
    </span>
  </h3>
  ```
* However:
  1. `GET /api/workspaces/[id]/members` executes:
     ```sql
     SELECT wm.id, wm.user_id, wm.role, wm.status, wm.created_at as joined_at,
            u.full_name as name, u.email, u.avatar_url
     FROM workspace_memberships wm
     JOIN users u ON wm.user_id = u.id
     WHERE wm.workspace_id = $1
     ORDER BY ...
     ```
     Notice that `WHERE wm.status = 'active'` is **missing**. Suspended or archived memberships would be counted in `{members.length}`.
  2. In contrast, `GET /api/workspaces` (used by workspace switchers) calculates member count using:
     ```sql
     (SELECT COUNT(*)::int FROM workspace_memberships wm WHERE wm.workspace_id = w.id AND wm.status = 'active') as member_count
     ```
     This creates a discrepancy between the workspace switcher count (`status = 'active'`) and the Settings page count (unfiltered memberships).

---

#### Question 8: Loading Indicators Hiding Slow or Failed Background Fetches
* In [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx#L1164-L1170):
  ```tsx
  {isLoadingTeam && (
    <span className="flex items-center gap-1.5 text-xs text-brand-400">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      Syncing team directory...
    </span>
  )}
  ```
  `isLoadingTeam` only displays a tiny inline spinner text next to the header. It **does not render a skeleton placeholder** over the table.
* As a result, the user clearly sees and reads the `DEFAULT_MEMBERS` (Sarah Chen, Marcus Vance, Elena Rostova, Alex Rivera) while the query is in flight. If the network is slow or screenshot captured within the first 200–500ms, Screenshot A is produced.

---

#### Question 9: Stale Data on Workspace / Account Switching
* When switching workspaces via TopNav or the Settings organization dropdown:
  - `currentWorkspace` updates.
  - `loadTeamData(currentWorkspace.id)` is triggered in a `useEffect`.
  - However, `members` and `invitations` are **not cleared** upon workspace change. The previous workspace's members remain visible until the new fetch settles.
  - If the user switches accounts to a user who lacks permission to view invitations, `invitesResult` fails with 403, instantly resetting the invitations to `DEFAULT_INVITATIONS` (Jordan Taylor).

---

### 2.3 Detailed Root Cause Identification (Issue 2)

The discrepancy between Screenshot A and Screenshot B is caused by the confluence of two architectural flaws:

1. **Client-Side Mock Fallback Contamination (Screenshot A):**
   - [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx) embeds development mock data (`DEFAULT_MEMBERS` and `DEFAULT_INVITATIONS`) in production client code.
   - Initial state is initialized to these mock arrays instead of empty arrays (`[]`).
   - The team table renders these rows immediately on mount.
   - Any API error (401, 403, network glitch) or empty response re-injects this mock data.
   - Screenshot A was captured either during initial page mount / loading window or while authenticated as a user role that receives 403 on the invitations endpoint.

2. **Backend API Filter Omission & Label Inconsistency (Screenshot B):**
   - [src/app/api/workspaces/[id]/invitations/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/invitations/route.ts) selects all invitation records without filtering by `WHERE status = 'pending'`.
   - The live database contains two invitations for DermaGlow, both revoked (`tosaran09@gmail.com` and `sarans.cse2024@citchennai.net`).
   - The Settings page displays `Pending Invitations ({invitations.length})`, which renders as `Pending Invitations (2)`, even though 0 invitations are pending.
   - Similarly, `GET /api/workspaces/[id]/members` lacks `WHERE wm.status = 'active'`, creating inconsistent counts across endpoints.

---

### 2.4 Affected Files and APIs (Issue 2)

| File / Component | Role | Issue |
|---|---|---|
| [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx) | Settings & Team Management UI | 1. Initializes `useState` with `DEFAULT_MEMBERS` & `DEFAULT_INVITATIONS`<br>2. Overrides empty/failed API responses with mock data<br>3. Displays mock data during loading rather than skeleton UI<br>4. Header badge counts `invitations.length` without checking `invitation.status === 'pending'` |
| [src/app/api/workspaces/[id]/invitations/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/invitations/route.ts) | Invitations Management API | 1. `SELECT` query does not filter `WHERE status = 'pending'`<br>2. Returns 403 Forbidden to non-admin roles without returning a graceful `{ invitations: [] }` structure or allowing read access |
| [src/app/api/workspaces/[id]/members/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/members/route.ts) | Members Management API | 1. `SELECT` query does not filter `WHERE wm.status = 'active'`<br>2. Causes discrepancy with `GET /api/workspaces` aggregate count |

---

## Section 3: Recommended Technical Fixes & Implementation Plan

*(Note: Per prompt constraints, these changes are documented for review and deployment planning. No production application files were altered during this audit).*

### 3.1 Frontend Fix: Remove Mock Fallback & Introduce Clean Skeleton Loading
In [src/app/settings/page.tsx](file:///d:/BrandShield/brandshield-ai/src/app/settings/page.tsx):
1. **Remove `DEFAULT_MEMBERS` and `DEFAULT_INVITATIONS`:**
   ```typescript
   // Change initial states from mock arrays to empty arrays
   const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
   const [invitations, setInvitations] = useState<WorkspaceInvitationItem[]>([]);
   ```
2. **Update Response Resolution in `loadTeamData`:**
   ```typescript
   // Do not fall back to mock data on error or empty array
   if (membersResult.status === 'fulfilled' && membersResult.value) {
     setMembers(membersResult.value);
   } else {
     setMembers([]);
   }

   if (invitesResult.status === 'fulfilled' && invitesResult.value) {
     setInvitations(invitesResult.value);
   } else {
     setInvitations([]);
   }
   ```
3. **Render Skeleton Rows When `isLoadingTeam` is True:**
   If `isLoadingTeam` is active, render 3–4 animated skeleton rows rather than rendering stale or empty state rows.
4. **Filter Invitations by Status in UI Counters:**
   ```typescript
   const pendingInvitations = useMemo(
     () => invitations.filter((inv) => inv.status === 'pending'),
     [invitations]
   );
   ```
   Update badge to:
   ```tsx
   <span>Pending Invitations ({pendingInvitations.length})</span>
   ```

---

### 3.2 Backend Fix: Explicit Status Filtering in API Queries

1. In [src/app/api/workspaces/[id]/invitations/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/invitations/route.ts#L42-L52):
   ```sql
   -- Support filtering by status or default to pending invitations
   SELECT id, email, role, status, expires_at, created_at, invited_by
   FROM workspace_invitations
   WHERE workspace_id = $1 AND status = 'pending'
   ORDER BY created_at DESC
   ```
   *(Or allow query param `?status=all` if an audit history view is created).*

2. In [src/app/api/workspaces/[id]/members/route.ts](file:///d:/BrandShield/brandshield-ai/src/app/api/workspaces/[id]/members/route.ts#L52-L65):
   ```sql
   -- Explicitly filter active memberships
   SELECT wm.id, wm.user_id, wm.role, wm.status, wm.created_at as joined_at,
          u.full_name as name, u.email, u.avatar_url
   FROM workspace_memberships wm
   JOIN users u ON wm.user_id = u.id
   WHERE wm.workspace_id = $1 AND wm.status = 'active'
   ORDER BY wm.created_at ASC
   ```

---

## Section 4: Regression Test & Verification Plan

### Test Suite 1: Organization Creation & Slug Collision
1. **Slug Conflict Handling:**
   - Attempt to create an organization with slug `"bio-tech"`.
   - **Expectation:** Modal remains open; red alert appears with message `Workspace slug "bio-tech" is already in use. Please choose another.`; input field contents are preserved.
2. **Slug In-Place Recovery:**
   - Modify slug to `"bio-tech-test-unique"` without refreshing page.
   - **Expectation:** Error message clears upon editing; submission proceeds successfully.

### Test Suite 2: Workspace Team Directory & Roster Integrity
1. **Mock Data Elimination Test:**
   - Inspect network tab on cold load of `/settings` with throttling (Slow 3G).
   - **Expectation:** Neither "Sarah Chen" nor "Jordan Taylor" appears at any point during loading. Skeletons are rendered until live DB rows arrive.
2. **Non-Admin Role Permission Test:**
   - Log in as `compliance_reviewer` or `legal_reviewer`.
   - Navigate to `/settings`.
   - **Expectation:** Team members table displays Dr. Elena Vance, Marcus Brody, and Compliance Administrator. Invitations section either displays an empty pending list or an informative "Contact an admin to view invitations" notice, never mock data.
3. **Invitation Status Filter Test:**
   - With 2 revoked invitations and 0 pending invitations in DermaGlow:
   - **Expectation:** Pending invitations counter displays `(0)` and empty state displays `"No pending invitations"`.

---

## Conclusion
- **Issue 1** is verified to be a correct, standard database uniqueness constraint and graceful error handling workflow.
- **Issue 2** is a verified frontend mock fallback leakage compounded by missing status filters on invitations and members endpoints.
- Implementing the recommended frontend state cleanup and SQL status filters will completely eliminate discrepancies between user sessions.

