-- ============================================================================
-- BRANDSHIELD AI — PHASE 4: AI MARKETING CLAIM EXTRACTION ENGINE MIGRATION
-- Migration: 20261105020000_phase4_extraction_engine.sql
-- Description: Creates extraction_runs table, adds extraction_run_id and
--              is_active to claims table, enables RLS with policies.
-- ============================================================================

-- 1. Create extraction_runs table to track provenance of LLM extractions
CREATE TABLE IF NOT EXISTS extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_version_id UUID NOT NULL REFERENCES submission_versions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model_identifier TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  claims_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  raw_output JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_workspace ON extraction_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_sub ON extraction_runs(submission_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_version ON extraction_runs(submission_version_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_status ON extraction_runs(status);

-- 2. Add columns to claims table for extraction run linkage and re-extraction versioning
ALTER TABLE claims 
  ADD COLUMN IF NOT EXISTS extraction_run_id UUID REFERENCES extraction_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_claims_extraction_run ON claims(extraction_run_id);
CREATE INDEX IF NOT EXISTS idx_claims_is_active ON claims(is_active);

-- 3. Enable RLS on extraction_runs
ALTER TABLE extraction_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extraction_runs' AND policyname = 'Public read extraction runs for DermaGlow'
  ) THEN
    CREATE POLICY "Public read extraction runs for DermaGlow"
      ON extraction_runs FOR SELECT
      TO anon, authenticated
      USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extraction_runs' AND policyname = 'Authenticated users can insert extraction runs'
  ) THEN
    CREATE POLICY "Authenticated users can insert extraction runs"
      ON extraction_runs FOR INSERT
      TO authenticated
      WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'extraction_runs' AND policyname = 'Authenticated users can update extraction runs'
  ) THEN
    CREATE POLICY "Authenticated users can update extraction runs"
      ON extraction_runs FOR UPDATE
      TO authenticated
      USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claims' AND policyname = 'Authenticated users can update claims'
  ) THEN
    CREATE POLICY "Authenticated users can update claims"
      ON claims FOR UPDATE
      TO authenticated
      USING (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));
  END IF;
END $$;
