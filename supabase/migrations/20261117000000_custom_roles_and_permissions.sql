-- ============================================================================
-- BRANDSHIELD AI — CUSTOM ROLES & PERMISSION MANAGEMENT
-- Migration: 20261117000000_custom_roles_and_permissions.sql
-- Description: Non-destructive custom role definitions, granular permissions,
--              member-to-role assignments, indexes, triggers, and tenant RLS.
-- ============================================================================

-- 1. WORKSPACE ROLES TABLE
CREATE TABLE IF NOT EXISTS public.workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_roles_workspace_name UNIQUE (workspace_id, name),
  CONSTRAINT chk_workspace_roles_name_nonempty CHECK (char_length(trim(name)) > 0),
  CONSTRAINT chk_workspace_roles_name_not_reserved CHECK (lower(trim(name)) NOT IN ('admin', 'administrator', 'superadmin', 'owner'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_roles_workspace ON public.workspace_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_roles_name ON public.workspace_roles(workspace_id, name);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_workspace_roles_updated_at ON public.workspace_roles;
CREATE TRIGGER trg_workspace_roles_updated_at
BEFORE UPDATE ON public.workspace_roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. WORKSPACE ROLE PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_role_permission UNIQUE (role_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_workspace_role_perms_role ON public.workspace_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_role_perms_workspace ON public.workspace_role_permissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_role_perms_perm ON public.workspace_role_permissions(permission);

-- 3. WORKSPACE MEMBER ROLES TABLE (Member-to-Role Assignment)
CREATE TABLE IF NOT EXISTS public.workspace_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.workspace_memberships(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_member_custom_role UNIQUE (membership_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_membership ON public.workspace_member_roles(membership_id);
CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_role ON public.workspace_member_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_workspace ON public.workspace_member_roles(workspace_id);

-- 4. EXTEND WORKSPACE MEMBERSHIPS WITH CUSTOM ROLE REFERENCE
ALTER TABLE public.workspace_memberships
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.workspace_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_custom_role ON public.workspace_memberships(custom_role_id);

-- Update role check constraint safely to support 'custom'
DO $$
BEGIN
  ALTER TABLE public.workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;
  ALTER TABLE public.workspace_memberships DROP CONSTRAINT IF EXISTS chk_workspace_memberships_role;
  ALTER TABLE public.workspace_memberships
    ADD CONSTRAINT chk_workspace_memberships_role
    CHECK (role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer', 'custom'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Role constraint update handled: %', SQLERRM;
END $$;

-- 5. EXTEND WORKSPACE INVITATIONS WITH CUSTOM ROLE REFERENCE
ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.workspace_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_custom_role ON public.workspace_invitations(custom_role_id);

-- Update invitations role check constraint safely
DO $$
BEGIN
  ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_role_check;
  ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS chk_workspace_invitations_role;
  ALTER TABLE public.workspace_invitations
    ADD CONSTRAINT chk_workspace_invitations_role
    CHECK (role IN ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer', 'custom'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Invitations role constraint update handled: %', SQLERRM;
END $$;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member_roles ENABLE ROW LEVEL SECURITY;

-- Workspace Roles Policies
DROP POLICY IF EXISTS "Members can view workspace roles" ON public.workspace_roles;
CREATE POLICY "Members can view workspace roles" ON public.workspace_roles
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage workspace roles" ON public.workspace_roles;
CREATE POLICY "Admins can manage workspace roles" ON public.workspace_roles
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
  );

-- Workspace Role Permissions Policies
DROP POLICY IF EXISTS "Members can view role permissions" ON public.workspace_role_permissions;
CREATE POLICY "Members can view role permissions" ON public.workspace_role_permissions
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.workspace_role_permissions;
CREATE POLICY "Admins can manage role permissions" ON public.workspace_role_permissions
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
  );

-- Workspace Member Roles Policies
DROP POLICY IF EXISTS "Members can view member roles" ON public.workspace_member_roles;
CREATE POLICY "Members can view member roles" ON public.workspace_member_roles
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage member roles" ON public.workspace_member_roles;
CREATE POLICY "Admins can manage member roles" ON public.workspace_member_roles
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_memberships wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'admin' AND wm.status = 'active'
    )
  );
