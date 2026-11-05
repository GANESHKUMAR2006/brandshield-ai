-- ============================================================================
-- BRANDSHIELD AI — PHASE 3: SUBMISSIONS ENHANCEMENTS & LIFECYCLE
-- Migration: 20261105010000_phase3_submissions_enhancements.sql
-- Description: Non-destructive migration adding product_id to submissions,
--              expanding status check constraint to support full lifecycle,
--              and establishing versioning indexes.
-- ============================================================================

-- 1. ADD PRODUCT_ID TO SUBMISSIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE submissions
      ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_product ON submissions(product_id);

-- 2. UPDATE SUBMISSIONS STATUS CHECK CONSTRAINT TO SUPPORT EXTENDED LIFECYCLE
DO $$
BEGIN
  -- Drop existing status check if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_status_check'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT submissions_status_check;
  END IF;

  -- Add updated check constraint supporting full lifecycle + legacy compatibility
  ALTER TABLE submissions
    ADD CONSTRAINT submissions_status_check
    CHECK (status IN (
      'draft',
      'submitted',
      'processing',
      'under_review',
      'in_review',
      'approved',
      'rejected',
      'changes_requested'
    ));
END $$;

-- 3. LINK BENCHMARK SUBMISSIONS TO DERMAGLOW VITAMIN C SERUM
UPDATE submissions
SET product_id = '00000000-0000-0000-0000-000000000010'
WHERE workspace_id = '00000000-0000-0000-0000-000000000001'
  AND product_id IS NULL;

-- 4. ENSURE RLS ALLOWS READ ACCESS INCLUDING PRODUCT_ID
-- Existing SELECT policy already covers all columns via table row access.
