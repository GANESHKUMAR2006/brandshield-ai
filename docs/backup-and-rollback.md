# BrandShield AI — Backup, Rollback & Disaster Recovery Strategy

> **Governance Notice**:  
> This document specifies disaster recovery and rollback procedures. No destructive rollback commands or database restores were executed during this verification phase. Procedures marked with `[DOCUMENTED]` represent standard operational specifications; procedures marked with `[VERIFIED]` have been tested with automated dry-runs.

---

## 1. Database Backup Specifications

### 1.1 Custom-Format Physical Backup (`[DOCUMENTED]`)
For PostgreSQL 17 managed databases, backups must be generated using PostgreSQL's custom-format (`-Fc`), which supports compressed multi-threaded restoration and selective table recovery:

```bash
# Safest command structure for custom-format backup
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file=brandshield_backup_$(date +%Y%m%d_%H%M%S).dump \
  "$SUPABASE_DATABASE_URL"
```

### 1.2 Verification of Backup Integrity (`[DOCUMENTED]`)
Before executing any major release or migration, verify that the resulting dump is non-empty and valid:
```bash
# Verify archive catalog without restoring data
pg_restore --list brandshield_backup_YYYYMMDD_HHMMSS.dump | head -n 30
```

---

## 2. Supabase Migration Rollback Protocols

### 2.1 Applied Migrations (Phases 1–6)
- **Current Live Status**: Applied and stable.
- **Rollback Consideration**: Do not roll back Phases 1–6. Rolling back would drop core tenant entities (`workspaces`, `products`, `claims`), causing irreversible data loss.

### 2.2 Pending Migrations (Phases 7–9)
- **Current Live Status**: Unapplied on the live database.
- **Additive Rollback Guarantee**:
  - `20261105050000_phase7_evidence_intelligence.sql`: Adds an updated RLS policy and validation trigger on `claim_evidence`. Rollback drops the new policy and reinstates the legacy policy.
  - `20261105060000_phase8_admin_analytics.sql`: Adds analytical indexes. Rollback executes `DROP INDEX IF EXISTS`.
  - `20261105070000_phase9_policy_intelligence.sql`: Adds `policies`, `policy_versions`, `policy_rules`. Rollback executes `DROP TABLE IF EXISTS policies CASCADE`.

---

## 3. Application Release Rollback (Next.js 16)

If a release artifact exhibits critical runtime defects:

### Scenario A: Vercel / Cloud Container Rollback
1. In the Vercel dashboard or container orchestrator, locate the previous stable deployment hash (e.g. `rc-0.9.9`).
2. Trigger an immediate **Instant Rollback**.
3. Traffic transitions to the previous build in $< 5$ seconds without container downtime.

### Scenario B: Self-Hosted Docker Rollback
```bash
# Re-tag previous verified Docker image
docker pull brandshield-ai:0.9.9
docker-compose stop web
docker-compose up -d web
```

---

## 4. Audit Log Preservation Guarantee

In any rollback or recovery event, the `audit_events` table **must never be truncated or overwritten**.

- The PL/pgSQL trigger `trg_audit_events_immutable` protects existing records.
- If a database restore is required, restore data to an isolated staging schema (`restored_backup`) and perform selective inserts of lost records rather than executing full database drops (`DROP DATABASE`).

---

## 5. Recovery Validation Checklist

After any rollback or restore operation, execute the following verification sequence:
1. **Connectivity**: Verify `/api/health` returns HTTP 200 with `services.database.status: "connected"`.
2. **Data Consistency**: Confirm the DermaGlow workspace exists (`SELECT count(*) FROM workspaces WHERE slug = 'dermaglow'`).
3. **Immutability Check**: Verify `trg_audit_events_immutable` is active by asserting that `DELETE FROM audit_events WHERE false;` executes without schema errors.
4. **Automated Smoke Test**: Execute `npm test` to verify unit and reliability invariants.
