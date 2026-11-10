-- ============================================================================
-- BRANDSHIELD AI — ENTERPRISE WORKSPACE LIFECYCLE & RETENTION ARCHIVAL
-- Migration: 20261113000000_workspace_lifecycle_archival.sql
-- Description: Non-destructive workspace lifecycle tracking (active, archived,
--              suspended), timestamps, and actor auditing.
--
-- Compliance Note:
-- Under FDA 21 CFR Part 11, FTC Marketing Substantiation, and ISO 22716,
-- immutable audit trails, evidence evaluations, and claim decisions must be
-- preserved. Hard deletion (CASCADE) destroys compliance evidence and constitutes
-- spoliation of legal/regulatory records. Therefore, workspace deletion is
-- implemented via Compliance Archival (soft-delete lifecycle transition).
-- ============================================================================

DO $$
BEGIN
  -- 1. Add status column with check constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'status'
  ) THEN
    ALTER TABLE workspaces 
      ADD COLUMN status TEXT NOT NULL DEFAULT 'active' 
      CHECK (status IN ('active', 'archived', 'suspended'));
  END IF;

  -- 2. Add archived_at timestamp column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE workspaces 
      ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;

  -- 3. Add archived_by UUID column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'archived_by'
  ) THEN
    ALTER TABLE workspaces 
      ADD COLUMN archived_by UUID;
  END IF;
END $$;

-- 4. Create performance index on workspace status for query filtering
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

-- 5. Comments for schema documentation
COMMENT ON COLUMN workspaces.status IS 'Lifecycle state: active (normal operations), archived (compliance retention, read-only), or suspended (administratively locked)';
COMMENT ON COLUMN workspaces.archived_at IS 'Timestamp when the organization was transitioned to archived state';
COMMENT ON COLUMN workspaces.archived_by IS 'Supabase user UUID of the administrator who executed the archival action';
