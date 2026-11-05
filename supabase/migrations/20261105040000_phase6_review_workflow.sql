-- ============================================================================
-- BRANDSHIELD AI — PHASE 6: HUMAN COMPLIANCE REVIEW & APPROVAL WORKFLOW
-- Migration: 20261105040000_phase6_review_workflow.sql
-- Description: Adds human review workflow state to claims, expands review_decisions
--              with historical tracking & provenance, adds publication eligibility
--              gate to submissions, and configures workspace-scoped RLS policies.
-- ============================================================================

-- 1. ENHANCE CLAIMS TABLE WITH REVIEW WORKFLOW STATE
DO $$
BEGIN
  -- Add review_status with closed enum check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'review_status'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (review_status IN ('pending', 'in_review', 'approved', 'rejected', 'modified', 'escalated'));
  END IF;

  -- Add assigned reviewer
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'assigned_reviewer'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN assigned_reviewer TEXT;
  END IF;

  -- Add last reviewed timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'last_reviewed_at'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN last_reviewed_at TIMESTAMPTZ;
  END IF;

  -- Add latest review notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN review_notes TEXT;
  END IF;

  -- Add lineage pointer for modified claim revisions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'original_claim_id'
  ) THEN
    ALTER TABLE claims
      ADD COLUMN original_claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claims_review_status ON claims(review_status);
CREATE INDEX IF NOT EXISTS idx_claims_assigned_reviewer ON claims(assigned_reviewer);
CREATE INDEX IF NOT EXISTS idx_claims_original_claim ON claims(original_claim_id);

-- 2. ENHANCE REVIEW_DECISIONS TABLE FOR HISTORICAL PRESERVATION & PROVENANCE
DO $$
BEGIN
  -- Workspace linkage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Submission linkage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'submission_id'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;
  END IF;

  -- Reviewer role classification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'reviewer_role'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN reviewer_role TEXT NOT NULL DEFAULT 'compliance_reviewer'
      CHECK (reviewer_role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'viewer'));
  END IF;

  -- Associated verification run provenance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'verification_run_id'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN verification_run_id UUID REFERENCES verification_runs(id) ON DELETE SET NULL;
  END IF;

  -- Original claim text snapshot at review time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'original_claim_text'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN original_claim_text TEXT;
  END IF;

  -- Modified claim text for modification decisions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'modified_claim_text'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN modified_claim_text TEXT;
  END IF;

  -- Structured escalation categorization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'escalation_category'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN escalation_category TEXT
      CHECK (escalation_category IS NULL OR escalation_category IN ('legal', 'regulatory', 'clinical', 'brand_compliance', 'evidence_conflict', 'other'));
  END IF;

  -- Documented override reason for policy exception approvals
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'override_reason'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN override_reason TEXT;
  END IF;

  -- Previous workflow state
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'previous_workflow_state'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN previous_workflow_state TEXT DEFAULT 'pending';
  END IF;

  -- New workflow state
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_decisions' AND column_name = 'new_workflow_state'
  ) THEN
    ALTER TABLE review_decisions
      ADD COLUMN new_workflow_state TEXT NOT NULL DEFAULT 'approved';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_review_decisions_workspace ON review_decisions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_submission ON review_decisions(submission_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_created_at ON review_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_review_decisions_decision ON review_decisions(decision);

-- 3. ENHANCE SUBMISSIONS TABLE WITH PUBLICATION ELIGIBILITY GATE
DO $$
BEGIN
  -- Update check constraint on submissions status
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_status_check'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT submissions_status_check;
  END IF;

  ALTER TABLE submissions
    ADD CONSTRAINT submissions_status_check
    CHECK (status IN (
      'draft',
      'submitted',
      'processing',
      'under_review',
      'in_review',
      'pending_review',
      'approved',
      'rejected',
      'changes_requested',
      'escalated'
    ));

  -- Add publication_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'publication_status'
  ) THEN
    ALTER TABLE submissions
      ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'ineligible'
      CHECK (publication_status IN ('ineligible', 'eligible', 'published'));
  END IF;

  -- Add publication eligibility details snapshot
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'publication_eligibility_details'
  ) THEN
    ALTER TABLE submissions
      ADD COLUMN publication_eligibility_details JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- Add last reviewed timestamp for submission
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'last_reviewed_at'
  ) THEN
    ALTER TABLE submissions
      ADD COLUMN last_reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_pub_status ON submissions(publication_status);

-- 4. BACKFILL DERMAGLOW WORKSPACE REFERENCES & INITIAL REVIEW STATES
UPDATE review_decisions rd
SET 
  workspace_id = s.workspace_id,
  submission_id = s.id,
  original_claim_text = c.claim_text
FROM claims c
JOIN submissions s ON c.submission_id = s.id
WHERE rd.claim_id = c.id
  AND rd.workspace_id IS NULL;

-- 5. ROW LEVEL SECURITY WRITE POLICIES FOR PHASE 6
DO $$
BEGIN
  -- Authenticated insertion into review_decisions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_decisions' AND policyname = 'Authenticated reviewers can record decisions'
  ) THEN
    CREATE POLICY "Authenticated reviewers can record decisions"
      ON review_decisions FOR INSERT
      TO authenticated
      WITH CHECK (
        workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
        OR claim_id IN (
          SELECT c.id FROM claims c
          JOIN submissions s ON c.submission_id = s.id
          WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
        )
      );
  END IF;

  -- Authenticated update on claims review status
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'claims' AND policyname = 'Authenticated reviewers can update claims'
  ) THEN
    CREATE POLICY "Authenticated reviewers can update claims"
      ON claims FOR UPDATE
      TO authenticated
      USING (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')))
      WITH CHECK (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));
  END IF;

  -- Authenticated update on submissions publication status
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'submissions' AND policyname = 'Authenticated reviewers can update submissions'
  ) THEN
    CREATE POLICY "Authenticated reviewers can update submissions"
      ON submissions FOR UPDATE
      TO authenticated
      USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'))
      WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));
  END IF;
END $$;
