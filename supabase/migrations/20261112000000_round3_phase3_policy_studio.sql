-- ============================================================================
-- BRANDSHIELD AI — PHASE 3: INTERACTIVE POLICY STUDIO & CUSTOM RULE ENGINE
-- Migration: 20261112000000_round3_phase3_policy_studio.sql
-- Description: Additive schema enhancements for visual policy builder, rule schema
--              validation, severity indexing, and 'validated' version lifecycle state.
-- Safety: Explicit public schema qualification, pg_constraint catalog lookup,
--         idempotent DDL operations, transactional execution.
-- ============================================================================

-- 1. EXTEND POLICY_VERSIONS STATUS TO INCLUDE 'validated'
DO $$
BEGIN
  -- Drop existing check constraint if it restricts status using table-specific catalog lookup
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'policy_versions_status_check'
      AND conrelid = 'public.policy_versions'::regclass
  ) THEN
    ALTER TABLE public.policy_versions
      DROP CONSTRAINT policy_versions_status_check;
  END IF;

  ALTER TABLE public.policy_versions
    ADD CONSTRAINT policy_versions_status_check
    CHECK (status IN ('draft', 'validated', 'active', 'archived', 'superseded'));
END $$;

-- 2. ADD SEVERITY TO POLICIES TABLE (Optional Denormalization for Efficient Querying)
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'high'
  CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_policies_severity
  ON public.policies(severity);

-- 3. ENSURE COMPOSITE INDEX FOR VERSION RESOLUTION
CREATE INDEX IF NOT EXISTS idx_policy_versions_lookup 
  ON public.policy_versions(policy_id, version_number DESC, status);
