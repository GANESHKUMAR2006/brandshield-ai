# BrandShield AI — Production Smoke-Test Checklist

> **Purpose**: Standard operating checklist for verifying a new deployment before releasing to end users.  
> **Classification**: Tests marked `[LOCAL / STAGING]` can be validated locally. Tests marked `[STAGING ONLY]` require a separate staging database.

---

## 1. Pre-Flight Application Startup `[LOCAL / STAGING]`
- [ ] **Check 1.1**: Application server starts cleanly with `npm run start` without throwing unhandled exceptions.
- [ ] **Check 1.2**: Server listens on configured port (default: `3000`).
- [ ] **Check 1.3**: Next.js App Router responds with HTTP 200 on root path `/` and redirects cleanly to `/dashboard`.

---

## 2. Executive Dashboard Loading `[LOCAL / STAGING]`
- [ ] **Check 2.1**: `/dashboard` loads in under 2 seconds.
- [ ] **Check 2.2**: KPI metric cards (Overall Compliance Rate, Active Claims, Total Submissions) render non-NaN numerical values.
- [ ] **Check 2.3**: Workflow Readiness Banner displays active system status without error banners.
- [ ] **Check 2.4**: Recent Activity Feed lists latest compliance events.

---

## 3. Authentication & Workspace Isolation `[LOCAL / STAGING]`
- [ ] **Check 3.1**: Top navigation displays active workspace indicator: `Workspace: DermaGlow`.
- [ ] **Check 3.2**: Foreign workspace queries are blocked; anonymous access to non-whitelisted workspace slugs returns zero rows.
- [ ] **Check 3.3**: Server session resolution enforces workspace boundary.

---

## 4. Submission Creation `[LOCAL / STAGING]`
- [ ] **Check 4.1**: Clicking **New Submission** opens `CreateSubmissionModal`.
- [ ] **Check 4.2**: Preset buttons (Scenario A, Scenario B, Scenario C) successfully populate campaign title, target product, and marketing copy.
- [ ] **Check 4.3**: Submitting creates a new record in `submissions` with an initial version and SHA-256 content hash.

---

## 5. AI Claim Extraction `[LOCAL / STAGING]`
- [ ] **Check 5.1**: Clicking **Extract Claims** initiates LLM extraction via Ollama (or configured provider).
- [ ] **Check 5.2**: Extracted claims decompose compound sentences into atomic assertions.
- [ ] **Check 5.3**: Offsets satisfy the strict invariant: `content.slice(text_start, text_end) === claim_text`.
- [ ] **Check 5.4**: Unicode currency symbols (₹, €) and multi-byte emojis do not cause offset drift.

---

## 6. Evidence Retrieval & Linking `[LOCAL / STAGING]`
- [ ] **Check 6.1**: Claims are linked to valid approved facts in `approved_facts` or source documents in `source_documents`.
- [ ] **Check 6.2**: Unapproved, draft, or expired clinical dossiers are strictly excluded from supporting evidence.
- [ ] **Check 6.3**: Evidence from foreign workspaces is blocked.

---

## 7. Deterministic Claim Verification `[LOCAL / STAGING]`
- [ ] **Check 7.1**: Clicking **Verify All Claims** evaluates claims across the 8 domain rule verifiers.
- [ ] **Check 7.2**: Approved 10% Vitamin C concentration evaluates to `SUPPORTED` (Low Risk).
- [ ] **Check 7.3**: Exaggerated 25% Vitamin C concentration evaluates to `CONTRADICTED` (High Risk).
- [ ] **Check 7.4**: Medical cure claims (*"cures eczema overnight"*) evaluate to `CONTRADICTED` (Critical Risk).
- [ ] **Check 7.5**: Missing evidence strictly defaults to `UNVERIFIED`—never false contradiction.

---

## 8. Human Compliance Review `[LOCAL / STAGING]`
- [ ] **Check 8.1**: `/reviews` displays flagged, contradicted, and unverified claims.
- [ ] **Check 8.2**: Reviewer can approve supported claims without restriction.
- [ ] **Check 8.3**: Attempting to approve a contradicted or critical-risk claim prompts for a **Mandatory Policy Override reason ($\ge 10$ characters)**.
- [ ] **Check 8.4**: Reviewer can accept "Defensible Phrasing" recommendations to modify claims.

---

## 9. Publication Gatekeeper Enforcement `[LOCAL / STAGING]`
- [ ] **Check 9.1**: For Scenario A (100% supported claims), Publication Gate status displays **ELIGIBLE FOR PUBLICATION (Passed)** with an unlocked green badge.
- [ ] **Check 9.2**: For Scenario B (contains contradicted claims), Publication Gate status displays **PUBLICATION GATE LOCKED (Blocked)** with a red badge.
- [ ] **Check 9.3**: Publishing or release endpoints reject submissions with locked gates.

---

## 10. Tamper-Evident Audit Trail `[LOCAL / STAGING]`
- [ ] **Check 10.1**: Navigating to `/audit` displays chronological events for every submission, extraction, verification run, and review decision.
- [ ] **Check 10.2**: Database trigger `trg_audit_events_immutable` actively rejects any direct SQL `UPDATE` or `DELETE` queries.

---

## 11. Health Diagnostics Telemetry `[LOCAL / STAGING]`
- [ ] **Check 11.1**: Navigating to `/api/health` returns HTTP 200 with JSON status payload.
- [ ] **Check 11.2**: Top navigation **Health Diagnostics** button opens telemetry modal showing latency and service statuses.
- [ ] **Check 11.3**: Health JSON payload masks all passwords and secrets (`postgresql://***`).

---

## 12. Failure Handling & Provider Resilience `[LOCAL / STAGING]`
- [ ] **Check 12.1**: When Ollama daemon is stopped, health telemetry transitions to `degraded` and claim extraction automatically engages the offline mock provider.
- [ ] **Check 12.2**: The application displays an informative notification banner rather than throwing unhandled client exceptions.

---

## 13. Staging-Only Infrastructure Verification `[STAGING ONLY]`
- [ ] **Check 13.1**: SSL/TLS certificate is valid and enforces HTTPS.
- [ ] **Check 13.2**: CDN edge caching rules preserve dynamic route behavior for `/api/*` and cache static assets under `/_next/static/*`.
- [ ] **Check 13.3**: Database connection pool gracefully handles 50 concurrent simulated client requests without pool exhaustion.
