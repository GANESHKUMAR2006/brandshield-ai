-- ============================================================================
-- BRANDSHIELD AI — PHASE 5: DETERMINISTIC CLAIM VERIFICATION ENGINE MIGRATION
-- Migration: 20261105030000_phase5_verification_engine.sql
-- Description: Adds risk_level and verified_at to claims, provides RLS write
--              policies for verification_runs and claim_evidence.
-- ============================================================================

-- 1. Enhance claims table with risk_level and verification timestamp
ALTER TABLE claims 
  ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_claims_risk ON claims(risk_level);
CREATE INDEX IF NOT EXISTS idx_claims_verified_at ON claims(verified_at);

-- 2. Ensure RLS policies for verification_runs and claim_evidence write operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'verification_runs' AND policyname = 'Authenticated users can insert verification runs'
  ) THEN
    CREATE POLICY "Authenticated users can insert verification runs"
      ON verification_runs FOR INSERT
      TO authenticated
      WITH CHECK (claim_id IN (
        SELECT c.id FROM claims c
        JOIN submissions s ON c.submission_id = s.id
        WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_evidence' AND policyname = 'Authenticated users can insert claim evidence'
  ) THEN
    CREATE POLICY "Authenticated users can insert claim evidence"
      ON claim_evidence FOR INSERT
      TO authenticated
      WITH CHECK (claim_id IN (
        SELECT c.id FROM claims c
        JOIN submissions s ON c.submission_id = s.id
        WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
      ));
  END IF;
END $$;
