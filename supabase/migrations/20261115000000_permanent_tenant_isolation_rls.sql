-- ============================================================================
-- BRANDSHIELD AI — PERMANENT TENANT ISOLATION & ROW LEVEL SECURITY
-- Migration: 20261115000000_permanent_tenant_isolation_rls.sql
-- Description: Establishes security-definer membership verification functions,
--              drops legacy hardcoded DermaGlow bypass policies, and enforces
--              strict multi-tenant RLS across all organization tables.
-- ============================================================================

-- 1. Helper function: Check if current authenticated user has active membership in workspace
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.workspace_memberships wm
    JOIN public.workspaces w ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = target_workspace_id
      AND wm.status = 'active'
      AND (w.status IS NULL OR w.status != 'archived')
  );
$$;

-- 2. Helper function: Check if current authenticated user is an active admin of workspace
CREATE OR REPLACE FUNCTION public.user_is_workspace_admin(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.workspace_memberships wm
    JOIN public.workspaces w ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
      AND wm.workspace_id = target_workspace_id
      AND wm.role = 'admin'
      AND wm.status = 'active'
      AND (w.status IS NULL OR w.status != 'archived')
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_workspace_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_workspace_access(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.user_is_workspace_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_workspace_admin(UUID) TO authenticated, service_role;

-- 3. DROP LEGACY DERMAGLOW BYPASS & OBSOLETE POLICIES
DROP POLICY IF EXISTS "Public read workspace DermaGlow" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Admins can update their workspace" ON workspaces;

DROP POLICY IF EXISTS "Users can view memberships of their workspaces" ON workspace_memberships;
DROP POLICY IF EXISTS "Admins can manage memberships" ON workspace_memberships;

DROP POLICY IF EXISTS "Admins can manage invitations" ON workspace_invitations;

DROP POLICY IF EXISTS "Public read products for DermaGlow" ON products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Workspace members can view products" ON products;
DROP POLICY IF EXISTS "Workspace members can manage products" ON products;

DROP POLICY IF EXISTS "Public read approved facts for DermaGlow products" ON approved_facts;
DROP POLICY IF EXISTS "Workspace members can view approved facts" ON approved_facts;
DROP POLICY IF EXISTS "Workspace members can manage approved facts" ON approved_facts;

DROP POLICY IF EXISTS "Public read promotions for DermaGlow" ON promotions;
DROP POLICY IF EXISTS "Workspace members can view promotions" ON promotions;
DROP POLICY IF EXISTS "Workspace members can manage promotions" ON promotions;

DROP POLICY IF EXISTS "Public read source documents for DermaGlow" ON source_documents;
DROP POLICY IF EXISTS "Workspace members can view source documents" ON source_documents;
DROP POLICY IF EXISTS "Workspace members can manage source documents" ON source_documents;

DROP POLICY IF EXISTS "Public read document versions" ON document_versions;
DROP POLICY IF EXISTS "Workspace members can view document versions" ON document_versions;
DROP POLICY IF EXISTS "Workspace members can manage document versions" ON document_versions;

DROP POLICY IF EXISTS "Public read document chunks" ON document_chunks;
DROP POLICY IF EXISTS "Workspace members can view document chunks" ON document_chunks;

DROP POLICY IF EXISTS "Public read submissions for DermaGlow" ON submissions;
DROP POLICY IF EXISTS "Authenticated users can insert submissions" ON submissions;
DROP POLICY IF EXISTS "Authenticated reviewers can update submissions" ON submissions;
DROP POLICY IF EXISTS "Workspace members can view submissions" ON submissions;
DROP POLICY IF EXISTS "Workspace members can manage submissions" ON submissions;

DROP POLICY IF EXISTS "Public read submission versions" ON submission_versions;
DROP POLICY IF EXISTS "Authenticated users can insert submission versions" ON submission_versions;
DROP POLICY IF EXISTS "Workspace members can view submission versions" ON submission_versions;
DROP POLICY IF EXISTS "Workspace members can manage submission versions" ON submission_versions;

DROP POLICY IF EXISTS "Public read claims" ON claims;
DROP POLICY IF EXISTS "Authenticated users can insert claims" ON claims;
DROP POLICY IF EXISTS "Authenticated reviewers can update claims" ON claims;
DROP POLICY IF EXISTS "Authenticated users can update claims" ON claims;
DROP POLICY IF EXISTS "Workspace members can view claims" ON claims;
DROP POLICY IF EXISTS "Workspace members can manage claims" ON claims;

DROP POLICY IF EXISTS "Public read claim evidence" ON claim_evidence;
DROP POLICY IF EXISTS "Authenticated users can insert claim evidence" ON claim_evidence;
DROP POLICY IF EXISTS "Authenticated users can link claim evidence in their workspace" ON claim_evidence;
DROP POLICY IF EXISTS "Authenticated users can read claim evidence for their workspace" ON claim_evidence;
DROP POLICY IF EXISTS "Workspace members can view claim evidence" ON claim_evidence;
DROP POLICY IF EXISTS "Workspace members can insert claim evidence" ON claim_evidence;

DROP POLICY IF EXISTS "Public read review decisions" ON review_decisions;
DROP POLICY IF EXISTS "Authenticated reviewers can record decisions" ON review_decisions;
DROP POLICY IF EXISTS "Authenticated reviewers can insert review decisions" ON review_decisions;
DROP POLICY IF EXISTS "Workspace members can view review decisions" ON review_decisions;
DROP POLICY IF EXISTS "Workspace members can manage review decisions" ON review_decisions;

DROP POLICY IF EXISTS "Public read verification runs" ON verification_runs;
DROP POLICY IF EXISTS "Authenticated users can insert verification runs" ON verification_runs;
DROP POLICY IF EXISTS "Workspace members can view verification runs" ON verification_runs;
DROP POLICY IF EXISTS "Workspace members can manage verification runs" ON verification_runs;

DROP POLICY IF EXISTS "Public read extraction runs for DermaGlow" ON extraction_runs;
DROP POLICY IF EXISTS "Authenticated users can insert extraction runs" ON extraction_runs;
DROP POLICY IF EXISTS "Authenticated users can update extraction runs" ON extraction_runs;
DROP POLICY IF EXISTS "Workspace members can view extraction runs" ON extraction_runs;
DROP POLICY IF EXISTS "Workspace members can manage extraction runs" ON extraction_runs;

DROP POLICY IF EXISTS "Admins can manage policies" ON policies;
DROP POLICY IF EXISTS "Workspace members can view policies" ON policies;
DROP POLICY IF EXISTS "Workspace members can manage policies" ON policies;

DROP POLICY IF EXISTS "Admins can manage policy versions" ON policy_versions;
DROP POLICY IF EXISTS "Workspace members can view policy versions" ON policy_versions;
DROP POLICY IF EXISTS "Workspace members can manage policy versions" ON policy_versions;

DROP POLICY IF EXISTS "Public read audit events for DermaGlow" ON audit_events;
DROP POLICY IF EXISTS "Authenticated users can insert audit events" ON audit_events;
DROP POLICY IF EXISTS "Authenticated users can read workspace audit events" ON audit_events;
DROP POLICY IF EXISTS "Workspace members can view audit events" ON audit_events;
DROP POLICY IF EXISTS "Workspace members can insert audit events" ON audit_events;

-- 4. ENSURE RLS IS ENABLED ON ALL TABLES
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 5. DEFINE STRICT MULTI-TENANT RLS POLICIES

-- Workspaces
CREATE POLICY "Users can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(id));

CREATE POLICY "Admins can update their workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (public.user_is_workspace_admin(id))
  WITH CHECK (public.user_is_workspace_admin(id));

-- Workspace Memberships
CREATE POLICY "Users can view memberships of their workspaces"
  ON public.workspace_memberships FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Admins can manage memberships"
  ON public.workspace_memberships FOR ALL
  TO authenticated
  USING (public.user_is_workspace_admin(workspace_id))
  WITH CHECK (public.user_is_workspace_admin(workspace_id));

-- Workspace Invitations
CREATE POLICY "Admins can manage invitations"
  ON public.workspace_invitations FOR ALL
  TO authenticated
  USING (public.user_is_workspace_admin(workspace_id))
  WITH CHECK (public.user_is_workspace_admin(workspace_id));

-- Products
CREATE POLICY "Workspace members can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Approved Facts
CREATE POLICY "Workspace members can view approved facts"
  ON public.approved_facts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = approved_facts.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

CREATE POLICY "Workspace members can manage approved facts"
  ON public.approved_facts FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = approved_facts.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = approved_facts.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

-- Promotions
CREATE POLICY "Workspace members can view promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = promotions.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

CREATE POLICY "Workspace members can manage promotions"
  ON public.promotions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = promotions.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = promotions.product_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

-- Source Documents
CREATE POLICY "Workspace members can view source documents"
  ON public.source_documents FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage source documents"
  ON public.source_documents FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Document Versions
CREATE POLICY "Workspace members can view document versions"
  ON public.document_versions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd
    WHERE sd.id = document_versions.source_document_id
      AND public.user_has_workspace_access(sd.workspace_id)
  ));

CREATE POLICY "Workspace members can manage document versions"
  ON public.document_versions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.source_documents sd
    WHERE sd.id = document_versions.source_document_id
      AND public.user_has_workspace_access(sd.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.source_documents sd
    WHERE sd.id = document_versions.source_document_id
      AND public.user_has_workspace_access(sd.workspace_id)
  ));

-- Document Chunks
CREATE POLICY "Workspace members can view document chunks"
  ON public.document_chunks FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.document_versions dv
    JOIN public.source_documents sd ON dv.source_document_id = sd.id
    WHERE dv.id = document_chunks.document_version_id
      AND public.user_has_workspace_access(sd.workspace_id)
  ));

-- Submissions
CREATE POLICY "Workspace members can view submissions"
  ON public.submissions FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage submissions"
  ON public.submissions FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Submission Versions
CREATE POLICY "Workspace members can view submission versions"
  ON public.submission_versions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_versions.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

CREATE POLICY "Workspace members can manage submission versions"
  ON public.submission_versions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_versions.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = submission_versions.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

-- Claims
CREATE POLICY "Workspace members can view claims"
  ON public.claims FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = claims.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

CREATE POLICY "Workspace members can manage claims"
  ON public.claims FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = claims.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id = claims.submission_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

-- Claim Evidence
CREATE POLICY "Workspace members can view claim evidence"
  ON public.claim_evidence FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    JOIN public.submissions s ON c.submission_id = s.id
    WHERE c.id = claim_evidence.claim_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

CREATE POLICY "Workspace members can insert claim evidence"
  ON public.claim_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.submissions s ON c.submission_id = s.id
      WHERE c.id = claim_evidence.claim_id
        AND public.user_has_workspace_access(s.workspace_id)
    )
    AND (
      document_version_id IS NULL OR EXISTS (
        SELECT 1 FROM public.document_versions dv
        JOIN public.source_documents sd ON dv.source_document_id = sd.id
        JOIN public.claims c ON c.id = claim_evidence.claim_id
        JOIN public.submissions s ON c.submission_id = s.id
        WHERE dv.id = claim_evidence.document_version_id
          AND sd.workspace_id = s.workspace_id
      )
    )
    AND (
      approved_fact_id IS NULL OR EXISTS (
        SELECT 1 FROM public.approved_facts af
        JOIN public.products p ON af.product_id = p.id
        JOIN public.claims c ON c.id = claim_evidence.claim_id
        JOIN public.submissions s ON c.submission_id = s.id
        WHERE af.id = claim_evidence.approved_fact_id
          AND p.workspace_id = s.workspace_id
      )
    )
  );

-- Review Decisions
CREATE POLICY "Workspace members can view review decisions"
  ON public.review_decisions FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage review decisions"
  ON public.review_decisions FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Verification Runs
CREATE POLICY "Workspace members can view verification runs"
  ON public.verification_runs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    JOIN public.submissions s ON c.submission_id = s.id
    WHERE c.id = verification_runs.claim_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

CREATE POLICY "Workspace members can manage verification runs"
  ON public.verification_runs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.claims c
    JOIN public.submissions s ON c.submission_id = s.id
    WHERE c.id = verification_runs.claim_id
      AND public.user_has_workspace_access(s.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.claims c
    JOIN public.submissions s ON c.submission_id = s.id
    WHERE c.id = verification_runs.claim_id
      AND public.user_has_workspace_access(s.workspace_id)
  ));

-- Extraction Runs
CREATE POLICY "Workspace members can view extraction runs"
  ON public.extraction_runs FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage extraction runs"
  ON public.extraction_runs FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Policies
CREATE POLICY "Workspace members can view policies"
  ON public.policies FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can manage policies"
  ON public.policies FOR ALL
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id))
  WITH CHECK (public.user_has_workspace_access(workspace_id));

-- Policy Versions
CREATE POLICY "Workspace members can view policy versions"
  ON public.policy_versions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

CREATE POLICY "Workspace members can manage policy versions"
  ON public.policy_versions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND public.user_has_workspace_access(p.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.policies p
    WHERE p.id = policy_versions.policy_id
      AND public.user_has_workspace_access(p.workspace_id)
  ));

-- Audit Events
CREATE POLICY "Workspace members can view audit events"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id));

CREATE POLICY "Workspace members can insert audit events"
  ON public.audit_events FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_workspace_access(workspace_id));
