-- ============================================================================
-- BRANDSHIELD AI — PHASE 2 MIGRATION: ADVANCED EVIDENCE CITATIONS & OCR
-- Version: 20261111000000_round3_phase2_citations.sql
--
-- Enhances claim_evidence, document_versions, and document_chunks with
-- exact character offsets, bounding boxes, OCR provenance, and page caches.
-- Non-destructive additive migration preserving all existing data.
-- ============================================================================

DO $$
BEGIN
  -- 1. Enhance claim_evidence with character offsets and visual coordinates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'char_start'
  ) THEN
    ALTER TABLE claim_evidence ADD COLUMN char_start INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'char_end'
  ) THEN
    ALTER TABLE claim_evidence ADD COLUMN char_end INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'bounding_box'
  ) THEN
    ALTER TABLE claim_evidence ADD COLUMN bounding_box JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'extraction_method'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN extraction_method TEXT DEFAULT 'digital_text'
      CHECK (extraction_method IN ('digital_text', 'ocr', 'hybrid_table', 'structured_fact'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_evidence' AND column_name = 'extraction_confidence'
  ) THEN
    ALTER TABLE claim_evidence
      ADD COLUMN extraction_confidence NUMERIC(4,3) DEFAULT 1.000
      CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1);
  END IF;

  -- 2. Enhance document_versions with extracted page cache for fast citation rendering
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'extracted_pages'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN extracted_pages JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_versions' AND column_name = 'extraction_metadata'
  ) THEN
    ALTER TABLE document_versions ADD COLUMN extraction_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- 3. Enhance document_chunks with structured table representations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'table_data'
  ) THEN
    ALTER TABLE document_chunks ADD COLUMN table_data JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'extraction_method'
  ) THEN
    ALTER TABLE document_chunks
      ADD COLUMN extraction_method TEXT DEFAULT 'digital_text';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_chunks' AND column_name = 'extraction_confidence'
  ) THEN
    ALTER TABLE document_chunks
      ADD COLUMN extraction_confidence NUMERIC(4,3) DEFAULT 1.000;
  END IF;
END $$;

-- 4. Helpful Performance Indexes
CREATE INDEX IF NOT EXISTS idx_claim_evidence_page ON claim_evidence(page_number);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_doc_ver ON claim_evidence(document_version_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_page ON document_chunks(((metadata->>'pageNumber')::int));
