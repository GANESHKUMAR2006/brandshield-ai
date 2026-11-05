-- ============================================================================
-- BRANDSHIELD AI — PHASE 2: DETERMINISTIC SEED DATA (DERMAGLOW)
-- File: supabase/seed.sql
-- Description: Idempotent seed data for DermaGlow workspace, product catalogue,
--              approved facts, active promotions, clinical dossiers, and 3
--              deterministic benchmark advertisements.
-- ============================================================================

-- 1. WORKSPACE: DERMAGLOW
INSERT INTO workspaces (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'DermaGlow',
  'dermaglow'
)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

-- 2. PRODUCT: DERMAGLOW VITAMIN C SERUM
INSERT INTO products (
  id,
  workspace_id,
  name,
  sku,
  description,
  category,
  reference_price,
  currency,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'DermaGlow Vitamin C Serum',
  'DG-VTC-001',
  'Clinically tested antioxidant facial serum with 10% stabilised L-Ascorbic Acid.',
  'Facial Serums & Antioxidants',
  2499.00,
  'INR',
  'active'
)
ON CONFLICT (sku) DO UPDATE
SET reference_price = EXCLUDED.reference_price,
    status = EXCLUDED.status;

-- 3. SOURCE DOCUMENT: CLINICAL EFFICACY DOSSIER
INSERT INTO source_documents (
  id,
  workspace_id,
  title,
  document_type,
  description,
  approval_status
)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'DG-CT-2025-04: Double-Blind Clinical Efficacy Study of Vitamin C Radiance Complex',
  'clinical_trial',
  '8-week double-blind clinical study substantiating 10% L-Ascorbic Acid antioxidant defense.',
  'approved'
)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title;

-- 4. DOCUMENT VERSION
INSERT INTO document_versions (
  id,
  source_document_id,
  version_number,
  storage_path,
  content_hash,
  approval_date,
  valid_from,
  valid_until,
  approval_status
)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000020',
  1,
  'dossiers/DG-CT-2025-04_v1.pdf',
  'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '2025-04-15 00:00:00+00',
  '2025-04-15 00:00:00+00',
  '2028-04-15 00:00:00+00',
  'approved'
)
ON CONFLICT (source_document_id, version_number) DO UPDATE
SET storage_path = EXCLUDED.storage_path;

-- Link source document current_version_id
UPDATE source_documents
SET current_version_id = '00000000-0000-0000-0000-000000000021'
WHERE id = '00000000-0000-0000-0000-000000000020';

-- 5. DOCUMENT CHUNKS (Indexed excerpts for evidence grounding)
INSERT INTO document_chunks (
  id,
  document_version_id,
  chunk_index,
  content,
  metadata
)
VALUES
(
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000021',
  0,
  'Formulation Specification: DermaGlow Vitamin C Serum contains precisely 10.0% stabilised medical-grade L-Ascorbic Acid buffered to pH 3.5 for optimal epidermal tolerance.',
  '{"section": "Formulation & Composition", "page": 4}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000021',
  1,
  'Clinical Efficacy Findings: Daily topical application demonstrated statistically significant improvement in visible skin radiance after 4 weeks and barrier hydration after 8 weeks.',
  '{"section": "Clinical Protocol & Efficacy", "page": 12}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000024',
  '00000000-0000-0000-0000-000000000021',
  2,
  'Safety and Limitations: Instantaneous elimination of all dark spots within 24 hours was neither observed nor clinically viable. Claims of overnight spot removal are ungrounded.',
  '{"section": "Safety & Adverse Event Analysis", "page": 19}'::jsonb
)
ON CONFLICT (document_version_id, chunk_index) DO UPDATE
SET content = EXCLUDED.content;

-- 6. APPROVED FACTS (Ground-truth catalogue parameters)
INSERT INTO approved_facts (
  id,
  product_id,
  fact_key,
  fact_value,
  fact_type,
  approval_status,
  source_document_id,
  valid_from,
  valid_until
)
VALUES
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000010',
  'vitamin_c_concentration',
  '{"concentration": "10%", "ingredient": "L-Ascorbic Acid", "form": "stabilised"}'::jsonb,
  'ingredient_specification',
  'approved',
  '00000000-0000-0000-0000-000000000020',
  '2025-04-15 00:00:00+00',
  '2028-04-15 00:00:00+00'
),
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000010',
  'reference_price',
  '{"mrp": 2499, "currency": "INR", "unit": "30ml bottle"}'::jsonb,
  'pricing_catalogue',
  'approved',
  NULL,
  '2025-01-01 00:00:00+00',
  NULL
),
(
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000010',
  'product_status',
  '{"status": "active", "availability": "in_stock", "market": "IN"}'::jsonb,
  'lifecycle_status',
  'approved',
  NULL,
  '2025-01-01 00:00:00+00',
  NULL
),
(
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000010',
  'dermatological_safety',
  '{"dermatologist_tested": true, "hypoallergenic": false, "notes": "Tested safe for sensitive cohorts; no 100% zero-risk absolute claims permitted."}'::jsonb,
  'safety_claim',
  'approved',
  '00000000-0000-0000-0000-000000000020',
  '2025-04-15 00:00:00+00',
  '2028-04-15 00:00:00+00'
)
ON CONFLICT (id) DO UPDATE
SET fact_value = EXCLUDED.fact_value;

-- 7. PROMOTION: FESTIVAL GLOW LAUNCH OFFER (Active)
INSERT INTO promotions (
  id,
  product_id,
  promotion_name,
  discount_type,
  discount_value,
  resulting_price,
  currency,
  start_date,
  end_date,
  applicable_channels,
  terms,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000010',
  'Festival Glow Launch Offer',
  'fixed',
  500.00,
  1999.00,
  'INR',
  '2026-11-01 00:00:00+00',
  '2026-12-31 23:59:59+00',
  '["Instagram", "DTC Website", "Meta Ads"]'::jsonb,
  'Special festive introductory price of ₹1,999 valid on direct and verified social channels.',
  'active'
)
ON CONFLICT (id) DO UPDATE
SET resulting_price = EXCLUDED.resulting_price,
    status = EXCLUDED.status;

-- ============================================================================
-- 8. THREE DETERMINISTIC DEMONSTRATION ADVERTISEMENTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADVERTISEMENT 1: INCORRECT ADVERTISEMENT (Contradicted Claims)
-- ----------------------------------------------------------------------------
INSERT INTO submissions (
  id,
  workspace_id,
  title,
  content,
  channel,
  status,
  submitted_by,
  submission_date
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'Ad Variant A — Unsubstantiated Potency Claim (Incorrect)',
  'Experience our new 25% Ultra Vitamin C Serum at an unbeatable price of only ₹999! Eliminates 100% of wrinkles overnight.',
  'Instagram Paid Ad',
  'changes_requested',
  'Performance Marketing Team',
  '2026-11-05 10:00:00+00'
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO submission_versions (
  id,
  submission_id,
  version_number,
  content,
  created_by
)
VALUES (
  '00000000-0000-0000-0000-000000000111',
  '00000000-0000-0000-0000-000000000101',
  1,
  'Experience our new 25% Ultra Vitamin C Serum at an unbeatable price of only ₹999! Eliminates 100% of wrinkles overnight.',
  'Performance Marketing Team'
)
ON CONFLICT (submission_id, version_number) DO NOTHING;

-- Claim 1.1: Incorrect Concentration (25% vs approved 10%)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation,
  suggested_correction
)
VALUES (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000111',
  'Contains 25% Ultra Vitamin C',
  'ingredient',
  '00000000-0000-0000-0000-000000000010',
  '{"ingredient": "Vitamin C", "claimed_concentration": "25%"}'::jsonb,
  0.98,
  'contradicted',
  'sufficient',
  'Direct contradiction: Approved product specification stipulates 10% stabilised L-Ascorbic Acid. 25% is an exaggerated and unsubstantiated formulation claim.',
  'Formulated with 10% stabilised Vitamin C'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- Evidence for Claim 1.1
INSERT INTO claim_evidence (
  id,
  claim_id,
  approved_fact_id,
  evidence_excerpt,
  relevance_score,
  evidence_type
)
VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000011',
  'Approved fact: DermaGlow Vitamin C Serum contains 10% stabilised L-Ascorbic Acid.',
  0.99,
  'approved_fact'
)
ON CONFLICT (id) DO NOTHING;

-- Verification Run 1.1
INSERT INTO verification_runs (
  id,
  claim_id,
  engine_version,
  verification_status,
  risk_level,
  explanation,
  evidence_snapshot
)
VALUES (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000201',
  '1.0.0',
  'contradicted',
  'critical',
  'Ingredient claim exceeds registered dossier concentration by 150%. Prohibited regulatory violation under cosmetic labeling standards.',
  '{"matched_fact_key": "vitamin_c_concentration", "approved_value": "10%", "claimed_value": "25%"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Claim 1.2: Incorrect Price (₹999 vs Catalogue ₹2,499 & Promotion ₹1,999)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation,
  suggested_correction
)
VALUES (
  '00000000-0000-0000-0000-000000000202',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000111',
  'Unbeatable price of only ₹999',
  'pricing',
  '00000000-0000-0000-0000-000000000010',
  '{"claimed_price": 999, "currency": "INR"}'::jsonb,
  0.95,
  'contradicted',
  'sufficient',
  'Price contradiction: Catalogue reference price is ₹2,499. Active Festival Launch promotion resulting price is ₹1,999. Neither catalogue nor promotions validate ₹999.',
  'Special festival launch price of ₹1,999 (MRP ₹2,499)'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- ----------------------------------------------------------------------------
-- ADVERTISEMENT 2: PARTIALLY SUPPORTED ADVERTISEMENT
-- ----------------------------------------------------------------------------
INSERT INTO submissions (
  id,
  workspace_id,
  title,
  content,
  channel,
  status,
  submitted_by,
  submission_date
)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'Ad Variant B — Mixed Efficacy Claims (Partially Supported)',
  'DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C. Guaranteed 100% eradication of all dark spots in 24 hours!',
  'Meta Carousel Story',
  'in_review',
  'Growth Marketing Team',
  '2026-11-05 11:30:00+00'
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO submission_versions (
  id,
  submission_id,
  version_number,
  content,
  created_by
)
VALUES (
  '00000000-0000-0000-0000-000000000112',
  '00000000-0000-0000-0000-000000000102',
  1,
  'DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C. Guaranteed 100% eradication of all dark spots in 24 hours!',
  'Growth Marketing Team'
)
ON CONFLICT (submission_id, version_number) DO NOTHING;

-- Claim 2.1: Valid Product Fact (Supported)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation
)
VALUES (
  '00000000-0000-0000-0000-000000000203',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000112',
  'Contains 10% stabilised Vitamin C',
  'ingredient',
  '00000000-0000-0000-0000-000000000010',
  '{"ingredient": "Vitamin C", "concentration": "10%"}'::jsonb,
  0.99,
  'supported',
  'sufficient',
  'Verified against Approved Fact vitamin_c_concentration and Clinical Study DG-CT-2025-04.'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- Claim 2.2: Unsupported Efficacy Guarantee (Needs Review / Contradicted)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation,
  suggested_correction
)
VALUES (
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000112',
  'Guaranteed 100% eradication of all dark spots in 24 hours',
  'efficacy',
  '00000000-0000-0000-0000-000000000010',
  '{"metric": "dark spots", "timeline": "24 hours", "absolute": true}'::jsonb,
  0.92,
  'needs_review',
  'insufficient',
  'Clinical trial DG-CT-2025-04 observed visible radiance improvement over 4 to 8 weeks. No 24-hour total spot eradication was evidenced or reported.',
  'Clinically proven to improve skin radiance and reduce visible dark spot intensity over 4 to 8 weeks.'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- ----------------------------------------------------------------------------
-- ADVERTISEMENT 3: FULLY SUPPORTED ADVERTISEMENT
-- ----------------------------------------------------------------------------
INSERT INTO submissions (
  id,
  workspace_id,
  title,
  content,
  channel,
  status,
  submitted_by,
  submission_date
)
VALUES (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000001',
  'Ad Variant C — Approved Festival Campaign (Fully Supported)',
  'Reveal your radiant skin with DermaGlow Vitamin C Serum, formulated with 10% stabilised Vitamin C. Get yours now at our special festival launch price of ₹1,999 (Regular MRP ₹2,499).',
  'Instagram Post & DTC Landing Page',
  'approved',
  'Dr. Elena Vance (VP Regulatory Affairs)',
  '2026-11-05 12:00:00+00'
)
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status;

INSERT INTO submission_versions (
  id,
  submission_id,
  version_number,
  content,
  created_by
)
VALUES (
  '00000000-0000-0000-0000-000000000113',
  '00000000-0000-0000-0000-000000000103',
  1,
  'Reveal your radiant skin with DermaGlow Vitamin C Serum, formulated with 10% stabilised Vitamin C. Get yours now at our special festival launch price of ₹1,999 (Regular MRP ₹2,499).',
  'Dr. Elena Vance (VP Regulatory Affairs)'
)
ON CONFLICT (submission_id, version_number) DO NOTHING;

-- Claim 3.1: Formulated with 10% stabilised Vitamin C (Supported)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation
)
VALUES (
  '00000000-0000-0000-0000-000000000205',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000113',
  'Formulated with 10% stabilised Vitamin C',
  'ingredient',
  '00000000-0000-0000-0000-000000000010',
  '{"ingredient": "Vitamin C", "concentration": "10%"}'::jsonb,
  0.99,
  'supported',
  'sufficient',
  'Fully substantiated: Approved Fact #00000000-0000-0000-0000-000000000011 and Clinical Study DG-CT-2025-04.'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- Evidence for Claim 3.1
INSERT INTO claim_evidence (
  id,
  claim_id,
  approved_fact_id,
  document_version_id,
  evidence_excerpt,
  relevance_score,
  evidence_type
)
VALUES (
  '00000000-0000-0000-0000-000000000305',
  '00000000-0000-0000-0000-000000000205',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021',
  'DermaGlow Vitamin C Serum contains precisely 10.0% stabilised medical-grade L-Ascorbic Acid buffered to pH 3.5.',
  0.98,
  'clinical_dossier'
)
ON CONFLICT (id) DO NOTHING;

-- Verification Run 3.1
INSERT INTO verification_runs (
  id,
  claim_id,
  engine_version,
  verification_status,
  risk_level,
  explanation,
  evidence_snapshot
)
VALUES (
  '00000000-0000-0000-0000-000000000405',
  '00000000-0000-0000-0000-000000000205',
  '1.0.0',
  'supported',
  'low',
  'Claim perfectly aligns with verified clinical specification and ground-truth dossier.',
  '{"fact": "10% L-Ascorbic Acid", "dossier": "DG-CT-2025-04", "confidence": 0.99}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Claim 3.2: Festival launch price of ₹1,999 (MRP ₹2,499) (Supported via Active Promotion)
INSERT INTO claims (
  id,
  submission_id,
  submission_version_id,
  claim_text,
  claim_type,
  product_id,
  extracted_entities,
  extraction_confidence,
  verification_status,
  evidence_sufficiency,
  explanation
)
VALUES (
  '00000000-0000-0000-0000-000000000206',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000113',
  'Festival launch price of ₹1,999 (Regular MRP ₹2,499)',
  'pricing',
  '00000000-0000-0000-0000-000000000010',
  '{"promotional_price": 1999, "reference_mrp": 2499, "currency": "INR"}'::jsonb,
  0.97,
  'supported',
  'sufficient',
  'Substantiated by active Festival Glow Launch Offer promotion (valid 2026-11-01 to 2026-12-31 on Instagram and DTC channels).'
)
ON CONFLICT (id) DO UPDATE
SET verification_status = EXCLUDED.verification_status;

-- Evidence for Claim 3.2
INSERT INTO claim_evidence (
  id,
  claim_id,
  approved_fact_id,
  evidence_excerpt,
  relevance_score,
  evidence_type
)
VALUES (
  '00000000-0000-0000-0000-000000000306',
  '00000000-0000-0000-0000-000000000206',
  '00000000-0000-0000-0000-000000000012',
  'Promotion: Festival Glow Launch Offer active until 2026-12-31. Resulting price ₹1,999 (Reference MRP ₹2,499).',
  0.96,
  'promotion_rule'
)
ON CONFLICT (id) DO NOTHING;

-- Verification Run 3.2
INSERT INTO verification_runs (
  id,
  claim_id,
  engine_version,
  verification_status,
  risk_level,
  explanation,
  evidence_snapshot
)
VALUES (
  '00000000-0000-0000-0000-000000000406',
  '00000000-0000-0000-0000-000000000206',
  '1.0.0',
  'supported',
  'low',
  'Pricing claim cross-checked against catalogue reference price and active promotional discount window.',
  '{"catalogue_price": 2499, "promotional_price": 1999, "promotion_active": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Reviewer Approval Decision for Ad 3
INSERT INTO review_decisions (
  id,
  claim_id,
  reviewer_id,
  decision,
  comments
)
VALUES (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000205',
  'usr-01-elena',
  'approved',
  'Claim fully validated against Master Dossier DG-CT-2025-04. Sign-off granted for digital and DTC deployment.'
)
ON CONFLICT (id) DO NOTHING;

-- 9. INITIAL AUDIT EVENTS (Append-only governance trail)
INSERT INTO audit_events (
  id,
  workspace_id,
  actor_id,
  entity_type,
  entity_id,
  action,
  before_state,
  after_state
)
VALUES
(
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000001',
  'system',
  'workspace',
  '00000000-0000-0000-0000-000000000001',
  'workspace_initialized',
  NULL,
  '{"name": "DermaGlow", "compliance_tier": "FDA & ISO 22716 Verified"}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000602',
  '00000000-0000-0000-0000-000000000001',
  'usr-01-elena',
  'source_document',
  '00000000-0000-0000-0000-000000000020',
  'dossier_uploaded',
  NULL,
  '{"title": "DG-CT-2025-04", "type": "clinical_trial", "version": 1}'::jsonb
),
(
  '00000000-0000-0000-0000-000000000603',
  '00000000-0000-0000-0000-000000000001',
  'usr-01-elena',
  'submission',
  '00000000-0000-0000-0000-000000000103',
  'submission_approved',
  '{"status": "in_review"}'::jsonb,
  '{"status": "approved", "claims_verified": 2}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
