# BrandShield AI — Production Operations Runbook

> **Target Audience**: Site Reliability Engineers (SRE), DevOps Engineers, Platform Administrators  
> **Release Target**: BrandShield AI v1.0.0  
> **Scope**: Routine operations, service telemetry, incident diagnosis, recovery playbooks, and escalation procedures.

---

## 1. System Startup Procedures

### 1.1 Local Development / Demo Mode Startup
1. **Start Ollama Service** (Terminal 1):
   ```bash
   ollama serve
   ```
   Verify target model is available:
   ```bash
   ollama list
   # If missing:
   ollama pull qwen3:4b
   ```
2. **Start Web Application** (Terminal 2):
   ```bash
   npm run dev
   ```
   Verify application launches at `http://localhost:3000`.

### 1.2 Production Server Startup
```bash
# Build standalone bundle
npm run build

# Start production server
npm run start
```
By default, the server binds to `0.0.0.0:3000`.

---

## 2. Health Monitoring & Diagnostic Telemetry

### 2.1 The `/api/health` Telemetry Endpoint
BrandShield AI provides a real-time health check endpoint:
```bash
curl -f http://localhost:3000/api/health
```

### 2.2 Telemetry Invariants & Status Codes
- **HTTP 200 `status: "ok"`**: PostgreSQL is connected, Ollama daemon is reachable, and the target model is pulled.
- **HTTP 200 `status: "degraded"`**: Database is connected, but Ollama is offline or uninstalled. *The platform automatically engages the offline deterministic mock extractor.*
- **HTTP 503 `status: "error"`**: Database connection failed or unconfigured. *Core platform cannot persist data.*

### 2.3 Secret Masking Invariant
The health endpoint **never** includes cleartext database passwords or API keys. Connection strings are masked:
$$\text{postgresql://postgres:***@db.ref.supabase.co:5432/postgres}$$

---

## 3. Incident Playbooks & Failure Recovery

### Incident 1: Ollama Service Offline / Unreachable
- **Symptoms**:
  - `/api/health` reports `services.ollama.status: "disconnected"`.
  - Health modal displays amber warning with recovery hint.
  - Claim extraction continues working via the fallback mock provider.
- **Root Cause**: Local Ollama process terminated or port `11434` blocked.
- **Recovery Action**:
  ```bash
  # Check if Ollama is running
  curl http://localhost:11434/api/tags
  
  # Restart service
  ollama serve
  ```

### Incident 2: Target Model Not Pulled
- **Symptoms**:
  - `/api/health` reports `services.ollama.status: "connected"`, but `modelInstalled: false`.
  - Recovery hint indicates: `Target model "qwen3:4b" is not pulled`.
- **Recovery Action**:
  ```bash
  ollama pull qwen3:4b
  # Or pull mistral/llama3:
  ollama pull llama3
  ```

### Incident 3: Supabase Database Timeout / Disconnected
- **Symptoms**:
  - `/api/health` returns HTTP 503 with `services.database.status: "disconnected"`.
  - UI displays connection alert banner.
- **Root Cause**: Invalid `SUPABASE_DATABASE_URL`, network disruption, or Supabase project paused.
- **Recovery Action**:
  1. Inspect `.env.local` to verify `SUPABASE_DATABASE_URL` credentials.
  2. Test raw connectivity:
     ```bash
     npm run test:db
     ```
  3. Verify Supabase project status in the Supabase Cloud Management Console.

### Incident 4: Publication Gate Unexpectedly Locked
- **Symptoms**:
  - User cannot publish marketing campaign; status displays **PUBLICATION GATE LOCKED**.
- **Root Cause**: The submission contains at least one active claim that is `contradicted`, `unverified`, `outdated`, or `rejected`.
- **Resolution**:
  1. Inspect `/reviews` to find flagged claims.
  2. Reviewers can modify the claim with approved defensible copy, or provide a documented legal justification ($\ge 10$ characters) to approve.
  3. Once 100% of active claims are approved, the gate automatically unlocks.

---

## 4. Logging & Audit Verification

- **Application Logs**: Emitted to standard output (`stdout`) in JSON-formatted streams.
- **Compliance Audit Events**: Persisted in PostgreSQL table `audit_events`.
  - Contains `workspace_id`, `actor_id`, `action`, `payload`, and `created_at`.
  - Protected against deletion by PL/pgSQL trigger `trg_audit_events_immutable`.
- **Querying Recent Audit Logs**:
  ```sql
  SELECT action, actor_id, created_at, payload
  FROM audit_events
  ORDER BY created_at DESC
  LIMIT 25;
  ```

---

## 5. Escalation Matrix

| Level | Role | Responsibilities | Contact |
| :---: | :--- | :--- | :--- |
| **Tier 1** | Compliance Reviewer | Review flagged claims, apply defensible copy suggestions. | Assigned campaign lead |
| **Tier 2** | Regulatory / Legal Counsel | Adjudicate high-risk overrides, review clinical efficacy claims. | Legal Affairs Desk |
| **Tier 3** | SRE / Database Admin | Address database latency, manage connection pools, manage migrations. | Infrastructure SRE On-Call |
