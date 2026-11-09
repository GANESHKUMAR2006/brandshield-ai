-- ============================================================================
-- BRANDSHIELD AI — ROUND 3: ENTERPRISE MULTI-TENANCY & RBAC
-- Migration: 20261110000000_round3_multi_tenancy.sql
-- Description: Non-destructive multi-tenant membership, invitations, role-based
--              access control, indexes, triggers, and tenant-aware RLS.
-- ============================================================================

-- 1. WORKSPACE MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user ON workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_role ON workspace_memberships(role);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_status ON workspace_memberships(status);

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_workspace_memberships_updated_at ON workspace_memberships;
CREATE TRIGGER trg_workspace_memberships_updated_at
BEFORE UPDATE ON workspace_memberships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. WORKSPACE INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_invitation_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_workspace_invitations_updated_at ON workspace_invitations;
CREATE TRIGGER trg_workspace_invitations_updated_at
BEFORE UPDATE ON workspace_invitations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. ROW LEVEL SECURITY POLICIES
ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if exist for idempotency
DROP POLICY IF EXISTS "Users can view memberships of their workspaces" ON workspace_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON workspace_memberships;
DROP POLICY IF EXISTS "Admins can manage invitations" ON workspace_invitations;

-- Memberships: Users can view memberships in their authorized workspaces, or DermaGlow demo
CREATE POLICY "Users can view memberships of their workspaces"
  ON workspace_memberships FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_memberships wm 
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
    OR workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
  );

-- Admins can insert/update/delete memberships
CREATE POLICY "Admins can manage memberships"
  ON workspace_memberships FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_memberships wm 
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
  );

-- Invitations: Admins can view and manage invitations
CREATE POLICY "Admins can manage invitations"
  ON workspace_invitations FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_memberships wm 
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
    OR workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
  );

-- 4. BACKFILL MEMBERSHIPS FOR EXISTING DERMAGLOW AUTH USERS
DO $$
DECLARE
  v_workspace_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = 'dermaglow';
  IF v_workspace_id IS NOT NULL THEN
    -- Elena Vance (Lead Compliance Reviewer)
    BEGIN
      SELECT id INTO v_user_id FROM auth.users WHERE email = 'elena.vance@dermaglow.com' LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES (v_workspace_id, v_user_id, 'compliance_reviewer', 'active')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'compliance_reviewer', status = 'active';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      -- auth.users not accessible directly in local mock
      NULL;
    END;

    -- Admin (Workspace Administrator)
    BEGIN
      SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@dermaglow.com' LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES (v_workspace_id, v_user_id, 'admin', 'active')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin', status = 'active';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;

    -- Marcus Brody (Legal Counsel)
    BEGIN
      SELECT id INTO v_user_id FROM auth.users WHERE email = 'marcus.brody@dermaglow.com' LIMIT 1;
      IF v_user_id IS NOT NULL THEN
        INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
        VALUES (v_workspace_id, v_user_id, 'legal_reviewer', 'active')
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'legal_reviewer', status = 'active';
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;
END $$;
