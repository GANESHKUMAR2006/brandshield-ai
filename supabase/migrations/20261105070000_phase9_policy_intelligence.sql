-- ============================================================================
-- BRANDSHIELD AI — PHASE 9: POLICY INTELLIGENCE & COMPLIANCE CONFIGURATION
-- Migration: 20261105070000_phase9_policy_intelligence.sql
-- Description: Configurable, versioned compliance policies, deterministic rules,
--              immutability triggers, multi-tenant RLS, and claim policy metadata.
-- ============================================================================

-- 1. POLICIES TABLE (Master Registry)
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE, -- NULL means workspace-wide
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'prohibited_claims',
    'restricted_efficacy',
    'clinical_requirements',
    'guarantee_restrictions',
    'comparative_advertising',
    'price_discount_rules',
    'promotion_validity',
    'required_disclaimers',
    'mandatory_human_review',
    'product_restrictions'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_policies_workspace_code UNIQUE (workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_policies_workspace ON policies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_policies_product ON policies(product_id);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);

-- 2. POLICY_VERSIONS TABLE (Immutable Once Activated)
CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'superseded')),
  description TEXT,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  CONSTRAINT uq_policy_versions_version UNIQUE (policy_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_status ON policy_versions(status);
CREATE INDEX IF NOT EXISTS idx_policy_versions_validity ON policy_versions(valid_from, valid_until);

-- Foreign key reference from policies.active_version_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_policies_active_version'
  ) THEN
    ALTER TABLE policies
      ADD CONSTRAINT fk_policies_active_version
      FOREIGN KEY (active_version_id) REFERENCES policy_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. TRIGGER FUNCTION: PREVENT MODIFICATION OF ACTIVATED POLICY VERSIONS
CREATE OR REPLACE FUNCTION prevent_active_policy_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- If record was already active or archived, prevent modifying rules, version_number, or valid_from
  IF OLD.status IN ('active', 'archived', 'superseded') THEN
    IF NEW.rules IS DISTINCT FROM OLD.rules OR
       NEW.version_number IS DISTINCT FROM OLD.version_number OR
       NEW.valid_from IS DISTINCT FROM OLD.valid_from THEN
      RAISE EXCEPTION 'Policy version % is immutable because it is % (archived/active). Changes require creating a new draft version.',
        OLD.version_number, OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_policy_versions_immutable ON policy_versions;
CREATE TRIGGER trg_policy_versions_immutable
  BEFORE UPDATE ON policy_versions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_active_policy_tampering();

-- 4. ENHANCE CLAIMS TABLE WITH POLICY COMPLIANCE FIELDS
ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS policy_compliance_status TEXT DEFAULT 'pending'
    CHECK (policy_compliance_status IS NULL OR policy_compliance_status IN ('compliant', 'non_compliant', 'review_required', 'pending')),
  ADD COLUMN IF NOT EXISTS mandatory_reviewer_role TEXT
    CHECK (mandatory_reviewer_role IS NULL OR mandatory_reviewer_role IN ('admin', 'compliance_reviewer', 'legal_reviewer')),
  ADD COLUMN IF NOT EXISTS required_evidence_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS triggered_policy_rules JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_claims_policy_compliance ON claims(policy_compliance_status);

-- 5. ENHANCE VERIFICATION_RUNS TABLE WITH POLICY EVALUATION SNAPSHOT
ALTER TABLE verification_runs
  ADD COLUMN IF NOT EXISTS policy_version_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS policy_evaluation JSONB DEFAULT '{}'::jsonb;

-- 6. MULTI-TENANT ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;

-- Policies read access (workspace members)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'policies' AND policyname = 'Workspace members can view policies'
  ) THEN
    CREATE POLICY "Workspace members can view policies"
      ON policies FOR SELECT
      TO authenticated
      USING (
        workspace_id IN (
          SELECT id FROM workspaces
          WHERE slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
      );
  END IF;

  -- Policies write access (admins only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'policies' AND policyname = 'Admins can manage policies'
  ) THEN
    CREATE POLICY "Admins can manage policies"
      ON policies FOR ALL
      TO authenticated
      USING (
        workspace_id IN (
          SELECT id FROM workspaces
          WHERE slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
      WITH CHECK (
        workspace_id IN (
          SELECT id FROM workspaces
          WHERE slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );
  END IF;

  -- Policy versions read access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'policy_versions' AND policyname = 'Workspace members can view policy versions'
  ) THEN
    CREATE POLICY "Workspace members can view policy versions"
      ON policy_versions FOR SELECT
      TO authenticated
      USING (
        policy_id IN (
          SELECT p.id FROM policies p
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
      );
  END IF;

  -- Policy versions write access (admins only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'policy_versions' AND policyname = 'Admins can manage policy versions'
  ) THEN
    CREATE POLICY "Admins can manage policy versions"
      ON policy_versions FOR ALL
      TO authenticated
      USING (
        policy_id IN (
          SELECT p.id FROM policies p
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      )
      WITH CHECK (
        policy_id IN (
          SELECT p.id FROM policies p
          JOIN workspaces w ON p.workspace_id = w.id
          WHERE w.slug = COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'workspace_slug',
            'dermaglow'
          )
        )
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );
  END IF;
END $$;

