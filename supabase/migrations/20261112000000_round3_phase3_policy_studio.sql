-- ============================================================================
-- BRANDSHIELD AI — PHASE 3: INTERACTIVE POLICY STUDIO & CUSTOM RULE ENGINE
-- Migration: 20261112000000_round3_phase3_policy_studio.sql
-- Description: Additive schema enhancements for visual policy builder, rule schema
--              validation, severity indexing, and 'validated' version lifecycle state.
-- ============================================================================

-- 1. EXTEND POLICY_VERSIONS STATUS TO INCLUDE 'validated'
DO $$
BEGIN
  -- Drop existing check constraint if it restricts status
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'policy_versions' AND constraint_name = 'policy_versions_status_check'
  ) THEN
    ALTER TABLE policy_versions DROP CONSTRAINT policy_versions_status_check;
  END IF;

  ALTER TABLE policy_versions
    ADD CONSTRAINT policy_versions_status_check
    CHECK (status IN ('draft', 'validated', 'active', 'archived', 'superseded'));
END $$;

-- 2. ADD SEVERITY TO POLICIES TABLE (Optional Denormalization for Efficient Querying)
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'high'
  CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_policies_severity ON policies(severity);

-- 3. ENSURE COMPOSITE INDEX FOR VERSION RESOLUTION
CREATE INDEX IF NOT EXISTS idx_policy_versions_lookup 
  ON policy_versions(policy_id, version_number DESC, status);

-- 4. RECORD MIGRATION IN SCHEMA REGISTRY IF EXISTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_schema_migrations') THEN
    INSERT INTO _schema_migrations (version, name, applied_at)
    VALUES ('20261112000000', 'round3_phase3_policy_studio', now())
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
