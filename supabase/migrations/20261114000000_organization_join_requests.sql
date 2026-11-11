-- ============================================================================
-- BRANDSHIELD AI — ROUND 3: ORGANIZATION JOIN CODES & MEMBERSHIP REQUESTS
-- Migration: 20261114000000_organization_join_requests.sql
-- Description: Non-destructive schema additions for organization join codes,
--              membership access requests, and admin approval workflows.
-- Compliance: Retains full auditability under FDA 21 CFR Part 11 & FTC substantiation.
-- ============================================================================

-- 1. ADD JOIN CODE COLUMNS TO WORKSPACES TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workspaces' AND column_name = 'join_code_hash'
  ) THEN
    ALTER TABLE public.workspaces 
      ADD COLUMN join_code_hash TEXT,
      ADD COLUMN join_code_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN join_code_updated_at TIMESTAMPTZ,
      ADD COLUMN join_code_updated_by UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspaces_join_code_hash 
  ON public.workspaces(join_code_hash) 
  WHERE join_code_enabled = true;

-- 2. CREATE WORKSPACE JOIN REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  assigned_role TEXT CHECK (assigned_role IS NULL OR assigned_role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookup and rate-limiting / duplicate prevention
CREATE INDEX IF NOT EXISTS idx_workspace_join_requests_workspace 
  ON public.workspace_join_requests(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_join_requests_user 
  ON public.workspace_join_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_join_requests_status 
  ON public.workspace_join_requests(status);

-- Ensure a user can only have at most one active pending request per workspace
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_workspace_join_request 
  ON public.workspace_join_requests(workspace_id, user_id) 
  WHERE status = 'pending';

-- Updated-at trigger
DROP TRIGGER IF EXISTS trg_workspace_join_requests_updated_at ON public.workspace_join_requests;
CREATE TRIGGER trg_workspace_join_requests_updated_at
BEFORE UPDATE ON public.workspace_join_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.workspace_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own join requests" ON public.workspace_join_requests;
CREATE POLICY "Users can view own join requests"
  ON public.workspace_join_requests FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Workspace admins can view workspace join requests" ON public.workspace_join_requests;
CREATE POLICY "Workspace admins can view workspace join requests"
  ON public.workspace_join_requests FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.workspace_join_requests IS 'Tracks user requests to join organizations via organization join codes pending administrator approval';
COMMENT ON COLUMN public.workspaces.join_code_hash IS 'SHA-256 hash of the secret alphanumeric organization join code';

