-- ============================================================================
-- BRANDSHIELD AI — PHASE 7: EVIDENCE INTELLIGENCE & RAG RETRIEVAL MIGRATION
-- Migration: 20261105050000_phase7_evidence_intelligence.sql
-- Description: Enhances claim_evidence with chunk linkage, provenance, stance,
--              and retrieval rationale. Adds pgvector index optimizations.
--
-- SAFETY INVARIANT: Non-destructive, idempotent (IF NOT EXISTS).
-- ============================================================================

-- 1. Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Enhance claim_evidence table with RAG chunk linkage and stance classification
DO $$
BEGIN
  -- Add foreign key link to exact document chunk
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'document_chunk_id'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN document_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL;
  END IF;

  -- Add evidence stance tag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'stance'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN stance TEXT DEFAULT 'contextual'
      CHECK (stance IN ('supporting', 'contradicting', 'inconclusive', 'contextual'));
  END IF;

  -- Add retrieval rationale text
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'retrieval_rationale'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN retrieval_rationale TEXT;
  END IF;

  -- Add section reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'section_reference'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN section_reference TEXT;
  END IF;

  -- Add page number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'page_number'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN page_number INT;
  END IF;
END $$;

-- 3. Indexes for evidence retrieval performance
CREATE INDEX IF NOT EXISTS idx_claim_evidence_chunk ON claim_evidence(document_chunk_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_relevance ON claim_evidence(relevance_score);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_stance ON claim_evidence(stance);

-- 4. RLS Policy for claim_evidence write and read operations
DO $$
BEGIN
  -- Drop obsolete single-tenant policy if exists
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_evidence' AND policyname = 'Authenticated workspace users can link claim evidence'
  ) THEN
    DROP POLICY "Authenticated workspace users can link claim evidence" ON claim_evidence;
  END IF;

  -- Multi-tenant INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_evidence' AND policyname = 'Authenticated users can link claim evidence in their workspace'
  ) THEN
    CREATE POLICY "Authenticated users can link claim evidence in their workspace"
      ON claim_evidence FOR INSERT
      TO authenticated
      WITH CHECK (
        -- 1. Tenant workspace isolation: Claim must belong to an authenticated workspace
        claim_id IN (
          SELECT c.id FROM claims c
          JOIN submissions s ON c.submission_id = s.id
          JOIN workspaces w ON s.workspace_id = w.id
          WHERE (
            w.slug = (auth.jwt() -> 'app_metadata' ->> 'workspace_slug')
            OR (auth.jwt() -> 'app_metadata' -> 'workspaces') ? w.slug
            OR w.id::text = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')
          )
        )
        -- 2. Anti-cross-tenant leakage: Document version must belong to the SAME workspace as the claim
        AND document_version_id IN (
          SELECT dv.id FROM document_versions dv
          JOIN source_documents sd ON dv.source_document_id = sd.id
          JOIN claims c ON c.id = claim_evidence.claim_id
          JOIN submissions s ON c.submission_id = s.id
          WHERE sd.workspace_id = s.workspace_id
        )
      );
  END IF;

  -- Multi-tenant SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claim_evidence' AND policyname = 'Authenticated users can read claim evidence for their workspace'
  ) THEN
    CREATE POLICY "Authenticated users can read claim evidence for their workspace"
      ON claim_evidence FOR SELECT
      TO authenticated
      USING (
        claim_id IN (
          SELECT c.id FROM claims c
          JOIN submissions s ON c.submission_id = s.id
          JOIN workspaces w ON s.workspace_id = w.id
          WHERE (
            w.slug = (auth.jwt() -> 'app_metadata' ->> 'workspace_slug')
            OR (auth.jwt() -> 'app_metadata' -> 'workspaces') ? w.slug
            OR w.id::text = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')
          )
        )
      );
  END IF;
END $$;

