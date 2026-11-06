-- ============================================================================
-- BRANDSHIELD AI — PHASE 8: AUDIT LOGGING, ANALYTICS & ADMIN INTELLIGENCE
-- Migration: 20261105060000_phase8_admin_analytics.sql
-- Description: Enhances audit_events with actor roles, correlation IDs,
--              high-performance composite indexes, and multi-tenant RLS.
--
-- SAFETY INVARIANT: Non-destructive, idempotent (IF NOT EXISTS).
-- ============================================================================

-- 1. Enhance audit_events with actor_role and correlation_id columns if absent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_events' AND column_name = 'actor_role'
  ) THEN
    ALTER TABLE audit_events
      ADD COLUMN actor_role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_events' AND column_name = 'correlation_id'
  ) THEN
    ALTER TABLE audit_events
      ADD COLUMN correlation_id TEXT;
  END IF;
END $$;

-- 2. Performance indexes for audit trail queries and filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_created
  ON audit_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_action
  ON audit_events(workspace_id, action);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON audit_events(workspace_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_correlation
  ON audit_events(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- 3. Composite indexes on claims for rapid operational analytics aggregation
CREATE INDEX IF NOT EXISTS idx_claims_workspace_active_review
  ON claims(submission_id, is_active, review_status);

CREATE INDEX IF NOT EXISTS idx_claims_workspace_active_verification
  ON claims(submission_id, is_active, verification_status);

CREATE INDEX IF NOT EXISTS idx_claims_workspace_active_risk
  ON claims(submission_id, is_active, risk_level);

-- 4. Multi-tenant RLS policy for audit_events SELECT
DO $$
BEGIN
  -- Drop obsolete single-tenant policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_events' AND policyname = 'Public read audit events for DermaGlow'
  ) THEN
    DROP POLICY "Public read audit events for DermaGlow" ON audit_events;
  END IF;

  -- Create multi-tenant SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_events' AND policyname = 'Authenticated users can read workspace audit events'
  ) THEN
    CREATE POLICY "Authenticated users can read workspace audit events"
      ON audit_events FOR SELECT
      TO authenticated
      USING (
        workspace_id IN (
          SELECT id FROM workspaces
          WHERE slug = (auth.jwt() -> 'app_metadata' ->> 'workspace_slug')
             OR (auth.jwt() -> 'app_metadata' -> 'workspaces') ? slug
             OR id::text = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')
        )
      );
  END IF;
END $$;

