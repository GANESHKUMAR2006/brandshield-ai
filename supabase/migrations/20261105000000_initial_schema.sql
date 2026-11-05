-- ============================================================================
-- BRANDSHIELD AI — PHASE 2: SUPABASE POSTGRESQL DATABASE SCHEMA
-- Migration: 20261105000000_initial_schema.sql
-- Description: Core relational schema, pgvector extension, audit protections,
--              temporal constraints, indexes, and Row Level Security.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. AUDIT IMMUTABILITY TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CORE TABLES (CREATED IN DEPENDENCY ORDER)
-- ============================================================================

-- A. WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- B. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  reference_price NUMERIC(12, 2) NOT NULL CHECK (reference_price >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- E. SOURCE_DOCUMENTS (Created before approved_facts and document_versions)
CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  current_version_id UUID, -- Foreign key added below after document_versions table
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'in_review', 'rejected', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_docs_workspace ON source_documents(workspace_id);

CREATE TRIGGER trg_source_documents_updated_at
BEFORE UPDATE ON source_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- F. DOCUMENT_VERSIONS
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  approval_date TIMESTAMPTZ,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'superseded', 'draft', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_doc_version UNIQUE (source_document_id, version_number),
  CONSTRAINT valid_version_dates CHECK (valid_until IS NULL OR valid_from <= valid_until)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_source ON document_versions(source_document_id);

-- Add circular foreign key from source_documents to document_versions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_source_docs_current_version'
  ) THEN
    ALTER TABLE source_documents
      ADD CONSTRAINT fk_source_docs_current_version
      FOREIGN KEY (current_version_id)
      REFERENCES document_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- C. APPROVED_FACTS
CREATE TABLE IF NOT EXISTS approved_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fact_key TEXT NOT NULL,
  fact_value JSONB NOT NULL,
  fact_type TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected', 'superseded')),
  source_document_id UUID REFERENCES source_documents(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_fact_dates CHECK (valid_until IS NULL OR valid_from <= valid_until)
);

CREATE INDEX IF NOT EXISTS idx_approved_facts_product ON approved_facts(product_id);
CREATE INDEX IF NOT EXISTS idx_approved_facts_key ON approved_facts(fact_key);

CREATE TRIGGER trg_approved_facts_updated_at
BEFORE UPDATE ON approved_facts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- D. PROMOTIONS
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  promotion_name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percentage', 'bundle')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
  resulting_price NUMERIC(12, 2) NOT NULL CHECK (resulting_price >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  applicable_channels JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  terms TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'scheduled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_promotion_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- G. DOCUMENT_CHUNKS (pgvector embeddings for semantic retrieval)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- Dimension: 1536 (OpenAI text-embedding-3-small standard)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chunk_index UNIQUE (document_version_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_version ON document_chunks(document_version_id);

-- H. SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'changes_requested', 'rejected')),
  submitted_by TEXT NOT NULL,
  submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_workspace ON submissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE TRIGGER trg_submissions_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- I. SUBMISSION_VERSIONS
CREATE TABLE IF NOT EXISTS submission_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  CONSTRAINT uq_submission_version UNIQUE (submission_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_sub_versions_submission ON submission_versions(submission_id);

-- J. CLAIMS
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  submission_version_id UUID NOT NULL REFERENCES submission_versions(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT 'efficacy',
  text_start INT,
  text_end INT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  extracted_entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('supported', 'contradicted', 'outdated', 'unverified', 'needs_review')),
  evidence_sufficiency TEXT,
  explanation TEXT,
  suggested_correction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claims_submission ON claims(submission_id);
CREATE INDEX IF NOT EXISTS idx_claims_version ON claims(submission_version_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(verification_status);

CREATE TRIGGER trg_claims_updated_at
BEFORE UPDATE ON claims
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- K. CLAIM_EVIDENCE
CREATE TABLE IF NOT EXISTS claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  approved_fact_id UUID REFERENCES approved_facts(id) ON DELETE SET NULL,
  evidence_excerpt TEXT NOT NULL,
  relevance_score NUMERIC(4, 3) NOT NULL DEFAULT 1.000 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  evidence_type TEXT NOT NULL DEFAULT 'clinical_dossier',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim ON claim_evidence(claim_id);

-- L. VERIFICATION_RUNS
CREATE TABLE IF NOT EXISTS verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  engine_version TEXT NOT NULL DEFAULT '1.0.0',
  verification_status TEXT NOT NULL CHECK (verification_status IN ('supported', 'contradicted', 'outdated', 'unverified', 'needs_review')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  explanation TEXT NOT NULL,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_claim ON verification_runs(claim_id);

-- M. REVIEW_DECISIONS
CREATE TABLE IF NOT EXISTS review_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'escalated', 'modified')),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_claim ON review_decisions(claim_id);

-- N. AUDIT_EVENTS (Append-Only)
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_workspace ON audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- Enforce database-level append-only immutability on audit_events
CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_audit_tampering();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all 14 tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Read policies for demonstration DermaGlow workspace (public/anon read-access)
CREATE POLICY "Public read workspace DermaGlow"
  ON workspaces FOR SELECT
  USING (slug = 'dermaglow');

CREATE POLICY "Public read products for DermaGlow"
  ON products FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));

CREATE POLICY "Public read approved facts for DermaGlow products"
  ON approved_facts FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read promotions for DermaGlow"
  ON promotions FOR SELECT
  USING (product_id IN (SELECT id FROM products WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read source documents for DermaGlow"
  ON source_documents FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));

CREATE POLICY "Public read document versions"
  ON document_versions FOR SELECT
  USING (source_document_id IN (SELECT id FROM source_documents WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read document chunks"
  ON document_chunks FOR SELECT
  USING (document_version_id IN (
    SELECT dv.id FROM document_versions dv
    JOIN source_documents sd ON dv.source_document_id = sd.id
    WHERE sd.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')
  ));

CREATE POLICY "Public read submissions for DermaGlow"
  ON submissions FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));

CREATE POLICY "Public read submission versions"
  ON submission_versions FOR SELECT
  USING (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read claims"
  ON claims FOR SELECT
  USING (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read claim evidence"
  ON claim_evidence FOR SELECT
  USING (claim_id IN (SELECT c.id FROM claims c JOIN submissions s ON c.submission_id = s.id WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read verification runs"
  ON verification_runs FOR SELECT
  USING (claim_id IN (SELECT c.id FROM claims c JOIN submissions s ON c.submission_id = s.id WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read review decisions"
  ON review_decisions FOR SELECT
  USING (claim_id IN (SELECT c.id FROM claims c JOIN submissions s ON c.submission_id = s.id WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Public read audit events for DermaGlow"
  ON audit_events FOR SELECT
  USING (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));

-- Authenticated & Service Role Write Policies (Restricting Browser Anon mutation)
CREATE POLICY "Authenticated users can insert submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));

CREATE POLICY "Authenticated users can insert submission versions"
  ON submission_versions FOR INSERT
  TO authenticated
  WITH CHECK (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Authenticated users can insert claims"
  ON claims FOR INSERT
  TO authenticated
  WITH CHECK (submission_id IN (SELECT id FROM submissions WHERE workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Authenticated reviewers can insert review decisions"
  ON review_decisions FOR INSERT
  TO authenticated
  WITH CHECK (claim_id IN (SELECT c.id FROM claims c JOIN submissions s ON c.submission_id = s.id WHERE s.workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow')));

CREATE POLICY "Authenticated users can insert audit events"
  ON audit_events FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE slug = 'dermaglow'));
