-- ============================================================================
-- BRANDSHIELD AI — PHASE 9: CORRECTED POLICY SEED SCRIPT (6 POLICIES)
-- File: supabase/seed_policies.sql
-- Description: Idempotent transactional seed for 6 workspace-wide policies.
-- Invariants:
--   - Uses gen_random_uuid() for fresh collision-free policy and version IDs.
--   - Does NOT create unapproved products.
--   - Does NOT seed product-specific Retinol policy with NULL product_id.
--   - Strictly workspace-scoped (slug = 'dermaglow').
--   - Preserves human-managed policy edits and versions (ON CONFLICT DO NOTHING).
--   - UPDATE restricted strictly to the 6 seeded policy codes.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- 1. Strictly resolve DermaGlow workspace by slug; abort if missing
  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = 'dermaglow';
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Aborting policy seed: Workspace with slug "dermaglow" does not exist.';
  END IF;

  -- 2. INSERT 6 WORKSPACE POLICIES (active_version_id initially NULL to respect FK constraints)
  
  -- Policy 1: Medical Treatment & Therapeutic Claim Prohibition
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Medical Treatment & Therapeutic Claim Prohibition',
    'POL-DERMA-001',
    'Prohibits OTC cosmetic collaterals from claiming medical disease cure, prevention, or treatment.',
    'prohibited_claims',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- Policy 2: Absolute Language & Instant Guarantee Policy
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Absolute Language & Instant Guarantee Policy',
    'POL-DERMA-002',
    'Restricts unqualified absolute assertions, instant cure promises, and 100% satisfaction guarantees.',
    'guarantee_restrictions',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- Policy 3: Clinical Trial & Quantitative Efficacy Substantiation
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Clinical Trial & Quantitative Efficacy Substantiation',
    'POL-DERMA-003',
    'Requires verified clinical study dossier evidence for all quantitative percentage claims.',
    'clinical_requirements',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- Policy 4: Comparative Advertising & Market Superiority Standards
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Comparative Advertising & Market Superiority Standards',
    'POL-DERMA-004',
    'Enforces legal reviewer authorization and comparative trial evidence for competitor-referencing claims.',
    'comparative_advertising',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- Policy 5: Promotional Pricing & Deep Discount Disclosure
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Promotional Pricing & Deep Discount Disclosure',
    'POL-DERMA-005',
    'Requires compliance review and calendar schedule verification for deep discount claims exceeding 50%.',
    'price_discount_rules',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- Policy 6: Mandatory Clinical Disclaimer Policy
  INSERT INTO policies (
    id, workspace_id, product_id, name, code, description, category, status, active_version_id, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_workspace_id,
    NULL,
    'Mandatory Clinical Disclaimer Policy',
    'POL-DERMA-006',
    'Requires all clinical and efficacy collaterals to include ''*Results may vary'' disclaimer.',
    'required_disclaimers',
    'active',
    NULL,
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  ) ON CONFLICT (workspace_id, code) DO NOTHING;

  -- 3. INSERT POLICY VERSIONS (Version 1, status = 'active', using gen_random_uuid())

  -- Version for POL-DERMA-001
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Initial activated baseline standard for therapeutic disease claims.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-PROHIBITED-001","name":"Medical Treatment & Cure Prohibition","description":"Cosmetic products cannot claim to cure, treat, or prevent medical diseases (eczema, psoriasis, dermatitis, rosacea, skin cancer).","category":"prohibited_claims","severity":"critical","logic":"ANY","action":"flag_violation","conditions":[{"field":"claim_text","operator":"contains_phrase","value":["cure eczema","cures eczema","cure for eczema","treats psoriasis","prevent skin cancer","eliminates dermatitis","heals rosacea"]},{"field":"claim_text","operator":"matches_regex","value":"\\b(cure|cures|curing|heal|heals)\\s+(?:for\\s+)?(eczema|psoriasis|dermatitis|melanoma)\\b"}],"mandatoryReviewerRole":"legal_reviewer","suggestedCorrection":"Replace medical treatment claim with cosmetic benefit: ''soothes dry, irritated skin'' or ''calms appearance of redness''.","explanationTemplate":"Claim asserts therapeutic or medical cure for {{phrase}}, which violates cosmetic regulatory standards."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-001' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- Version for POL-DERMA-002
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Baseline absolute language control.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-GUARANTEE-001","name":"Absolute Guarantee & Permanent Eradication Ban","description":"Unqualified absolute language such as ''100% guaranteed'', ''permanent elimination'', ''miracle cure'', or ''overnight erasure'' is restricted.","category":"guarantee_restrictions","severity":"high","logic":"ANY","action":"require_human_review","conditions":[{"field":"claim_text","operator":"contains_phrase","value":["100% guaranteed","miracle cure","permanent elimination","permanently erase","guaranteed overnight","instant erasure","guaranteed","100%","miracle","overnight"]}],"mandatoryReviewerRole":"compliance_reviewer","suggestedCorrection":"Qualify absolute promise: ''Visibly reduces the appearance of lines with continued daily use.''","explanationTemplate":"Absolute promise ''{{phrase}}'' is unsupportable without qualified clinical trial endpoints and disclaimer."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-002' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- Version for POL-DERMA-003
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Clinical evidence attachment mandate.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-CLINICAL-001","name":"Quantitative Percentage Efficacy Evidence Requirement","description":"Efficacy assertions citing specific percentages or clinical metrics require a verified clinical dossier source evidence.","category":"clinical_requirements","severity":"high","logic":"ALL","action":"require_evidence","conditions":[{"field":"claim_type","operator":"claim_type_is","value":"efficacy"},{"field":"evidence_types","operator":"lacks_evidence_type","value":"clinical_dossier"}],"requiredEvidenceTypes":["clinical_dossier"],"mandatoryReviewerRole":"compliance_reviewer","suggestedCorrection":"Attach approved Clinical Study Dossier validating exact percentage efficacy.","explanationTemplate":"Quantitative efficacy claim requires verified clinical study dossier evidence matching the asserted percentage."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-003' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- Version for POL-DERMA-004
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Comparative advertising standard.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-COMP-001","name":"Head-to-Head Comparative Advertising Legal Gate","description":"Comparative claims referencing competitors, market leadership (#1), or absolute superiority require head-to-head evidence and legal signoff.","category":"comparative_advertising","severity":"high","logic":"ANY","action":"require_human_review","conditions":[{"field":"claim_type","operator":"claim_type_is","value":"comparative"},{"field":"claim_text","operator":"contains_phrase","value":["better than","superior to leading","#1 dermatologist brand","beats competitor","outperforms ordinary"]}],"requiredEvidenceTypes":["clinical_dossier"],"mandatoryReviewerRole":"legal_reviewer","suggestedCorrection":"Provide verified independent double-blind comparative study or rephrase without competitor reference.","explanationTemplate":"Comparative claim referencing ''{{phrase}}'' triggers mandatory legal review and comparative trial substantiation."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-004' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- Version for POL-DERMA-005
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Promotional disclosure standard.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-DISCOUNT-001","name":"Deep Discount & Price Disclosure Rule","description":"Discount claims exceeding 50% or promotional pricing without schedule disclosure require promotional validation.","category":"price_discount_rules","severity":"medium","logic":"ALL","action":"require_human_review","conditions":[{"field":"claim_type","operator":"claim_type_is","value":"discount"},{"field":"claim_text","operator":"discount_exceeds","value":50}],"mandatoryReviewerRole":"compliance_reviewer","suggestedCorrection":"Verify active promotional rule schedule and ensure base reference price is cited.","explanationTemplate":"Deep discount claim exceeds standard 50% threshold and requires verified promotional calendar schedule."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-005' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- Version for POL-DERMA-006
  INSERT INTO policy_versions (
    id, policy_id, version_number, status, description, valid_from, valid_until, rules, metadata, created_by, created_at, activated_at
  )
  SELECT
    gen_random_uuid(),
    p.id,
    1,
    'active',
    'Mandatory disclaimer standard.',
    '2026-11-01 00:00:00+00',
    NULL,
    '[{"id":"RULE-DISCLAIMER-001","name":"Mandatory Clinical Results Disclaimer","description":"Marketing collaterals containing clinical efficacy claims must carry a visible disclaimer indicating individual results may vary.","category":"required_disclaimers","severity":"medium","logic":"ALL","action":"flag_violation","conditions":[{"field":"claim_type","operator":"claim_type_is","value":"efficacy"},{"field":"disclaimer","operator":"lacks_disclaimer","value":"results may vary"}],"mandatoryReviewerRole":"compliance_reviewer","suggestedCorrection":"Append required disclaimer to submission: ''*Results may vary based on skin type and regular usage.''","explanationTemplate":"Clinical efficacy claims must include the mandatory disclaimer ''*Results may vary''."}]'::jsonb,
    '{}'::jsonb,
    'system_admin',
    '2026-11-01 00:00:00+00',
    '2026-11-01 00:00:00+00'
  FROM policies p WHERE p.code = 'POL-DERMA-006' AND p.workspace_id = v_workspace_id
  ON CONFLICT (policy_id, version_number) DO NOTHING;

  -- 4. LINK ACTIVE VERSION ID (Strictly restricted to the 6 seed policy codes)
  UPDATE policies p
  SET active_version_id = pv.id,
      updated_at = now()
  FROM policy_versions pv
  WHERE p.id = pv.policy_id
    AND pv.version_number = 1
    AND p.workspace_id = v_workspace_id
    AND p.active_version_id IS NULL
    AND p.code IN (
      'POL-DERMA-001',
      'POL-DERMA-002',
      'POL-DERMA-003',
      'POL-DERMA-004',
      'POL-DERMA-005',
      'POL-DERMA-006'
    );

END $$;

COMMIT;
