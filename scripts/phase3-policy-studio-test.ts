/**
 * BrandShield AI — Phase 3 Test Suite
 * Interactive Compliance Policy Studio & Custom Rule Engine
 *
 * Verifies all 25 specific test requirements from Phase 3 specification:
 * 1. Policy creation
 * 2. Policy JSON validation
 * 3. Invalid operator rejection
 * 4. Invalid field rejection
 * 5. AND condition evaluation
 * 6. OR condition evaluation
 * 7. NOT condition evaluation
 * 8. Nested conditions
 * 9. Missing field behavior
 * 10. Data type validation
 * 11. Severity handling
 * 12. Reviewer routing
 * 13. Draft editing
 * 14. Publishing
 * 15. Immutable published versions
 * 16. Version rollback
 * 17. Archiving
 * 18. Simulation read-only guarantee
 * 19. Existing six policy compatibility
 * 20. Existing publication gate compatibility
 * 21. Creator cannot manage policies
 * 22. Reviewer cannot publish policies
 * 23. Cross-workspace policy isolation
 * 24. Audit trail creation
 * 25. Historical verification integrity
 */

import {
  Policy,
  PolicyCategory,
  PolicyCondition,
  PolicyConditionGroup,
  PolicyRule,
  PolicyVersion,
  ReviewerRole,
} from "../src/types";
import { ConditionEvaluator } from "../src/lib/policy/condition-evaluator";
import { RuleEvaluator } from "../src/lib/policy/rule-evaluator";
import { PolicyEngine } from "../src/lib/policy/policy-engine";
import { PolicyService } from "../src/lib/policy/policy-service";
import { PolicySchemaValidator } from "../src/lib/policy/policy-schema-validator";
import {
  DEFAULT_POLICIES,
  DEFAULT_POLICY_RULES,
  DERMAGLOW_WORKSPACE_ID,
  RETINOL_SERUM_PRODUCT_ID,
} from "../src/lib/policy/default-policies";
import { ReviewWorkflowService } from "../src/lib/review/review-service";
import { ServerSessionIdentity } from "../src/lib/auth/server-session";
import { AuditService } from "../src/lib/audit/audit-service";

// Session Fixtures
const ADMIN_SESSION: ServerSessionIdentity = {
  userId: "admin-001",
  userName: "Compliance Director",
  userEmail: "admin@dermaglow.com",
  role: "admin",
  workspaceId: DERMAGLOW_WORKSPACE_ID,
  workspaceSlug: "dermaglow",
  isAuthenticated: true,
  isDemoFallback: false,
};

const COMPLIANCE_SESSION: ServerSessionIdentity = {
  userId: "rev-001",
  userName: "Emma Vance",
  userEmail: "reviewer@dermaglow.com",
  role: "compliance_reviewer",
  workspaceId: DERMAGLOW_WORKSPACE_ID,
  workspaceSlug: "dermaglow",
  isAuthenticated: true,
  isDemoFallback: false,
};

const CREATOR_SESSION: ServerSessionIdentity = {
  userId: "creator-001",
  userName: "Alex Agency",
  userEmail: "alex@agency.com",
  role: "creator",
  workspaceId: DERMAGLOW_WORKSPACE_ID,
  workspaceSlug: "dermaglow",
  isAuthenticated: true,
  isDemoFallback: false,
};

const VIEWER_SESSION: ServerSessionIdentity = {
  userId: "view-001",
  userName: "Guest Auditor",
  userEmail: "viewer@dermaglow.com",
  role: "viewer",
  workspaceId: DERMAGLOW_WORKSPACE_ID,
  workspaceSlug: "dermaglow",
  isAuthenticated: true,
  isDemoFallback: false,
};

const FOREIGN_SESSION: ServerSessionIdentity = {
  userId: "foreign-admin",
  userName: "Foreign Admin",
  userEmail: "admin@foreigncorp.com",
  role: "admin",
  workspaceId: "99999999-9999-9999-9999-999999999999",
  workspaceSlug: "foreign-workspace",
  isAuthenticated: true,
  isDemoFallback: false,
};

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (detail) console.log(`       └─ ${detail}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error(`       └─ ${detail}`);
    failedCount++;
  }
}

async function runPhase3Tests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 3 POLICY STUDIO & RULE ENGINE              ");
  console.log("       Visual Builder, Nested Logic, Version Rollback & Provenance      ");
  console.log("========================================================================\n");

  AuditService.clearInMemoryLedger();
  PolicyService.resetInMemoryStore();

  // --------------------------------------------------------------------------
  // TEST 1: Policy creation
  // --------------------------------------------------------------------------
  let customPolicy: Policy | null = null;
  try {
    customPolicy = await PolicyService.createPolicy(ADMIN_SESSION, {
      name: "Non-Comedogenic & Acne-Prone Claim Restriction",
      code: "POL-DERMA-ACNE-01",
      category: "restricted_efficacy",
      severity: "high",
      description: "Restricts unqualified claims asserting complete acne eradication without dermatologist trials.",
      rules: [
        {
          id: "RULE-ACNE-01",
          name: "Acne Eradication Ban",
          description: "Cosmetic products cannot claim to eliminate or cure acne vulgaris.",
          category: "restricted_efficacy",
          severity: "high",
          logic: "AND",
          action: "flag_violation",
          conditions: [
            { field: "claim_text", operator: "contains", value: "eliminates acne" },
          ],
          mandatoryReviewerRole: "compliance_reviewer",
          explanationTemplate: "Claim asserts eradication of acne vulgaris.",
        },
      ],
    });

    assert(
      customPolicy !== null &&
        customPolicy.code === "POL-DERMA-ACNE-01" &&
        customPolicy.status === "draft" &&
        customPolicy.versions_count === 1,
      "1. Policy creation establishes draft status and Version 1",
      `Policy ID: ${customPolicy.id}, Status: ${customPolicy.status}`
    );
  } catch (err) {
    assert(false, "1. Policy creation establishes draft status and Version 1", (err as Error).message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Policy JSON validation
  // --------------------------------------------------------------------------
  const validSchemaCheck = PolicySchemaValidator.validatePolicy({
    name: "Valid Test Policy",
    code: "POL-TEST-001",
    category: "clinical_requirements",
    severity: "critical",
    rules: [
      {
        id: "RULE-TEST-01",
        name: "Test Rule",
        description: "Valid rule",
        category: "clinical_requirements",
        severity: "critical",
        action: "block_publication",
        logic: "AND",
        conditions: [
          { field: "claim_text", operator: "contains", value: "clinically proven" },
          { field: "evidence_types", operator: "lacks_evidence_type", value: "clinical_dossier" },
        ],
        explanationTemplate: "Requires clinical dossier.",
      },
    ],
  });

  assert(
    validSchemaCheck.isValid && validSchemaCheck.issues.length === 0,
    "2. Policy JSON validation passes compliant schemas with zero issues",
    `Issues count: ${validSchemaCheck.issues.length}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Invalid operator rejection
  // --------------------------------------------------------------------------
  const invalidOpCheck = PolicySchemaValidator.validatePolicy({
    name: "Invalid Op Policy",
    code: "POL-INV-001",
    category: "prohibited_claims",
    rules: [
      {
        id: "RULE-INV-01",
        name: "Arbitrary Code Execution Attempt",
        description: "Tries to execute eval",
        category: "prohibited_claims",
        severity: "critical",
        action: "flag_violation",
        conditions: [
          { field: "claim_text", operator: "eval_script" as any, value: "1 === 1" },
        ],
        explanationTemplate: "Exploit attempt",
      },
    ],
  });

  assert(
    !invalidOpCheck.isValid &&
      invalidOpCheck.issues.some((i) => i.code === "INVALID_OPERATOR"),
    "3. Invalid operator rejection strictly prevents unsupported or unsafe operators",
    `Reported error: ${invalidOpCheck.issues[0]?.message}`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Invalid field rejection
  // --------------------------------------------------------------------------
  const invalidFieldCheck = PolicySchemaValidator.validatePolicy({
    name: "Invalid Field Policy",
    code: "POL-INV-002",
    category: "prohibited_claims",
    rules: [
      {
        id: "RULE-INV-02",
        name: "Unauthorized Field Inspection",
        description: "Inspects private keys",
        category: "prohibited_claims",
        severity: "critical",
        action: "flag_violation",
        conditions: [
          { field: "auth_passwords", operator: "equals", value: "secret" },
        ],
        explanationTemplate: "Unauthorized inspection",
      },
    ],
  });

  assert(
    !invalidFieldCheck.isValid &&
      invalidFieldCheck.issues.some((i) => i.code === "INVALID_FIELD"),
    "4. Invalid field rejection prevents inspecting un-allowlisted or sensitive fields",
    `Reported error: ${invalidFieldCheck.issues[0]?.message}`
  );

  // --------------------------------------------------------------------------
  // TEST 5: AND condition evaluation
  // --------------------------------------------------------------------------
  const andRule: PolicyRule = {
    id: "RULE-AND-01",
    name: "Percentage Efficacy without Evidence",
    description: "Requires efficacy claim AND lack of dossier",
    category: "clinical_requirements",
    severity: "high",
    logic: "AND",
    action: "flag_violation",
    conditions: [
      { field: "claim_type", operator: "equals", value: "efficacy" },
      { field: "evidence_types", operator: "lacks_evidence_type", value: "clinical_dossier" },
    ],
    explanationTemplate: "Unsubstantiated percentage efficacy claim.",
  };

  // Case A: Both match -> triggers
  const andResTrigger = RuleEvaluator.evaluateRule(
    andRule,
    { claimText: "Reduces wrinkles by 84%", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  // Case B: Only one matches (dossier is present) -> does NOT trigger
  const andResNoTrigger = RuleEvaluator.evaluateRule(
    andRule,
    { claimText: "Reduces wrinkles by 84%", claimType: "efficacy", evidenceTypes: ["clinical_dossier"] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  assert(
    andResTrigger.isTriggered && !andResNoTrigger.isTriggered,
    "5. AND condition evaluation requires 100% of sub-conditions to match",
    `Triggered with missing evidence: ${andResTrigger.isTriggered}, Blocked with attached evidence: ${!andResNoTrigger.isTriggered}`
  );

  // --------------------------------------------------------------------------
  // TEST 6: OR condition evaluation
  // --------------------------------------------------------------------------
  const orRule: PolicyRule = {
    id: "RULE-OR-01",
    name: "Restricted Keywords Matcher",
    description: "Matches either 'miracle' OR 'cure' OR 'guaranteed'",
    category: "guarantee_restrictions",
    severity: "high",
    logic: "OR",
    action: "flag_violation",
    conditions: [
      { field: "claim_text", operator: "contains", value: "miracle" },
      { field: "claim_text", operator: "contains", value: "cure" },
      { field: "claim_text", operator: "contains", value: "guaranteed" },
    ],
    explanationTemplate: "Detected restricted promise: {{phrase}}.",
  };

  const orResMatch = RuleEvaluator.evaluateRule(
    orRule,
    { claimText: "This active serum is a miracle for dry skin", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  const orResNone = RuleEvaluator.evaluateRule(
    orRule,
    { claimText: "Deeply hydrates the skin barrier", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  assert(
    orResMatch.isTriggered && !orResNone.isTriggered,
    "6. OR condition evaluation triggers if any single condition matches",
    `Single match triggered: ${orResMatch.isTriggered}, Clean copy ignored: ${!orResNone.isTriggered}`
  );

  // --------------------------------------------------------------------------
  // TEST 7: NOT condition evaluation
  // --------------------------------------------------------------------------
  const notRule: PolicyRule = {
    id: "RULE-NOT-01",
    name: "Missing Required Disclaimer Enforcement",
    description: "Triggers if disclaimer is NOT present",
    category: "required_disclaimers",
    severity: "medium",
    logic: "NOT",
    action: "flag_violation",
    conditions: [
      { field: "claim_text", operator: "contains", value: "results may vary" },
    ],
    explanationTemplate: "Missing required disclaimer 'results may vary'.",
  };

  const notResMissing = RuleEvaluator.evaluateRule(
    notRule,
    { claimText: "Provides 24-hour hydration.", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  const notResPresent = RuleEvaluator.evaluateRule(
    notRule,
    { claimText: "Provides 24-hour hydration. *Results may vary.", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  assert(
    notResMissing.isTriggered && !notResPresent.isTriggered,
    "7. NOT condition evaluation cleanly inverts outcome to enforce missing requirements",
    `Missing disclaimer triggered: ${notResMissing.isTriggered}, Present disclaimer conformed: ${!notResPresent.isTriggered}`
  );

  // --------------------------------------------------------------------------
  // TEST 8: Nested conditions (e.g. (A AND (B OR C)))
  // --------------------------------------------------------------------------
  const nestedRule: PolicyRule = {
    id: "RULE-NESTED-01",
    name: "Complex Promotional Clinical Rule",
    description: "Requires efficacy claim AND (missing dossier OR deep discount)",
    category: "clinical_requirements",
    severity: "critical",
    logic: "AND",
    action: "block_publication",
    conditions: [
      { field: "claim_type", operator: "equals", value: "efficacy" },
      {
        logic: "OR",
        conditions: [
          { field: "evidence_types", operator: "lacks_evidence_type", value: "clinical_dossier" },
          { field: "discount_percentage", operator: "greater_than", value: 50 },
        ],
      } as PolicyConditionGroup,
    ],
    explanationTemplate: "Efficacy assertion has unmet dossier or unauthorized discount.",
  };

  const nestedMatch1 = RuleEvaluator.evaluateRule(
    nestedRule,
    { claimText: "Reduces wrinkles by 50%", claimType: "efficacy", evidenceTypes: [] },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  const nestedMatch2 = RuleEvaluator.evaluateRule(
    nestedRule,
    { claimText: "Reduces wrinkles by 50% on 60% off sale", claimType: "efficacy", evidenceTypes: ["clinical_dossier"], discountPercentage: 60 },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  const nestedNoMatch = RuleEvaluator.evaluateRule(
    nestedRule,
    { claimText: "Reduces wrinkles by 50%", claimType: "efficacy", evidenceTypes: ["clinical_dossier"], discountPercentage: 20 },
    { policyId: "p1", policyCode: "P1", versionNumber: 1 }
  );

  assert(
    nestedMatch1.isTriggered && nestedMatch2.isTriggered && !nestedNoMatch.isTriggered,
    "8. Nested condition groups (AND / OR) evaluate with strict algebraic determinism",
    `Case 1: ${nestedMatch1.isTriggered}, Case 2: ${nestedMatch2.isTriggered}, Fully conformed: ${!nestedNoMatch.isTriggered}`
  );

  // --------------------------------------------------------------------------
  // TEST 9: Missing field behavior
  // --------------------------------------------------------------------------
  const missingFieldCond1: PolicyCondition = { field: "product_id", operator: "exists", value: null };
  const missingFieldCond2: PolicyCondition = { field: "product_id", operator: "does_not_exist", value: null };
  const missingFieldCond3: PolicyCondition = { field: "channel", operator: "equals", value: "instagram" };

  const missingRes1 = ConditionEvaluator.evaluateCondition(missingFieldCond1, { claimText: "Text", claimType: "other", evidenceTypes: [] });
  const missingRes2 = ConditionEvaluator.evaluateCondition(missingFieldCond2, { claimText: "Text", claimType: "other", evidenceTypes: [] });
  const missingRes3 = ConditionEvaluator.evaluateCondition(missingFieldCond3, { claimText: "Text", claimType: "other", evidenceTypes: [] });

  assert(
    !missingRes1.isMatched && missingRes2.isMatched && !missingRes3.isMatched,
    "9. Missing field behavior safely resolves without throwing or producing NaN",
    `exists: ${missingRes1.isMatched}, does_not_exist: ${missingRes2.isMatched}, equals: ${missingRes3.isMatched}`
  );

  // --------------------------------------------------------------------------
  // TEST 10: Data type validation
  // --------------------------------------------------------------------------
  const numCond: PolicyCondition = { field: "discount_percentage", operator: "greater_than", value: 40 };
  const numResMatch = ConditionEvaluator.evaluateCondition(numCond, { claimText: "50% off", claimType: "discount", evidenceTypes: [], discountPercentage: 50 });
  const numResFail = ConditionEvaluator.evaluateCondition(numCond, { claimText: "30% off", claimType: "discount", evidenceTypes: [], discountPercentage: 30 });
  const numResMissing = ConditionEvaluator.evaluateCondition(numCond, { claimText: "no discount mentioned", claimType: "discount", evidenceTypes: [] });

  assert(
    numResMatch.isMatched && !numResFail.isMatched && !numResMissing.isMatched,
    "10. Data type validation enforces numeric thresholds and rejects invalid numbers safely",
    `50% > 40%: ${numResMatch.isMatched}, 30% > 40%: ${numResFail.isMatched}, undefined > 40%: ${numResMissing.isMatched}`
  );

  // --------------------------------------------------------------------------
  // TEST 11: Severity handling
  // --------------------------------------------------------------------------
  const evalCrit = PolicyEngine.evaluateClaim(
    "claim-1",
    { claimText: "Cures eczema permanently", claimType: "efficacy", evidenceTypes: [] },
    DEFAULT_POLICIES
  );

  const evalMed = PolicyEngine.evaluateClaim(
    "claim-2",
    { claimText: "60% flash discount", claimType: "discount", evidenceTypes: [], extractedEntities: { discount_value: 60 } },
    DEFAULT_POLICIES
  );

  assert(
    evalCrit.complianceStatus === "non_compliant" &&
      evalCrit.maxSeverity === "critical" &&
      evalMed.complianceStatus === "review_required" &&
      evalMed.maxSeverity === "medium",
    "11. Severity handling deterministically maps critical to non_compliant and medium to review_required",
    `Crit: ${evalCrit.complianceStatus} (${evalCrit.maxSeverity}), Med: ${evalMed.complianceStatus} (${evalMed.maxSeverity})`
  );

  // --------------------------------------------------------------------------
  // TEST 12: Reviewer routing
  // --------------------------------------------------------------------------
  const evalLegal = PolicyEngine.evaluateClaim(
    "claim-3",
    { claimText: "Clinically superior to leading brand competitor", claimType: "comparative", evidenceTypes: [] },
    DEFAULT_POLICIES
  );

  assert(
    evalLegal.mandatoryReviewerRoles.includes("legal_reviewer"),
    "12. Reviewer routing mandates legal_reviewer for comparative advertising claims",
    `Assigned roles: ${evalLegal.mandatoryReviewerRoles.join(", ")}`
  );

  // --------------------------------------------------------------------------
  // TEST 13: Draft editing
  // --------------------------------------------------------------------------
  let updatedDraft: Policy | null = null;
  if (customPolicy) {
    updatedDraft = await PolicyService.updateDraftPolicy(ADMIN_SESSION, customPolicy.id, {
      description: "Updated regulatory description for acne policy.",
    });

    assert(
      updatedDraft.description === "Updated regulatory description for acne policy." &&
        updatedDraft.status === "draft",
      "13. Draft editing updates policy in-place without publishing",
      `Description: "${updatedDraft.description}", Status: ${updatedDraft.status}`
    );
  } else {
    assert(false, "13. Draft editing", "customPolicy not initialized");
  }

  // --------------------------------------------------------------------------
  // TEST 14: Publishing
  // --------------------------------------------------------------------------
  let publishedPolicy: Policy | null = null;
  if (customPolicy && customPolicy.versions && customPolicy.versions[0]) {
    publishedPolicy = await PolicyService.activatePolicyVersion(
      ADMIN_SESSION,
      customPolicy.id,
      customPolicy.versions[0].id
    );

    assert(
      publishedPolicy.status === "active" &&
        publishedPolicy.active_version_number === 1 &&
        publishedPolicy.active_version?.status === "active",
      "14. Publishing transitions draft version to active and marks policy enforced",
      `Policy status: ${publishedPolicy.status}, Active version: v${publishedPolicy.active_version_number}`
    );
  } else {
    assert(false, "14. Publishing", "customPolicy version missing");
  }

  // --------------------------------------------------------------------------
  // TEST 15: Immutable published versions
  // --------------------------------------------------------------------------
  // Attempting to edit a published policy must NOT alter version 1; it creates a new draft version
  let versionEvolved: Policy | null = null;
  if (publishedPolicy) {
    versionEvolved = await PolicyService.updateDraftPolicy(ADMIN_SESSION, publishedPolicy.id, {
      description: "Evolving policy to Version 2",
      rules: [
        {
          id: "RULE-ACNE-02",
          name: "Acne Eradication Ban Extended",
          description: "Updated wording restriction",
          category: "restricted_efficacy",
          severity: "critical",
          logic: "AND",
          action: "block_publication",
          conditions: [{ field: "claim_text", operator: "contains", value: "acne cure" }],
          explanationTemplate: "Acne cure prohibited.",
        },
      ],
    });

    // Version 1 rules remain intact, new draft version 2 is created
    const v1 = versionEvolved.versions?.find((v) => v.version_number === 1);
    const v2 = versionEvolved.versions?.find((v) => v.version_number === 2);

    assert(
      versionEvolved.versions_count === 2 &&
        v1?.status === "active" &&
        v2?.status === "draft",
      "15. Immutable published versions: Editing published policy creates Version 2 draft preserving Version 1",
      `v1 Status: ${v1?.status}, v2 Status: ${v2?.status}, Total versions: ${versionEvolved.versions_count}`
    );
  } else {
    assert(false, "15. Immutable published versions", "publishedPolicy missing");
  }

  // --------------------------------------------------------------------------
  // TEST 16: Version rollback
  // --------------------------------------------------------------------------
  // Activate version 2 first, then rollback to version 1
  let rolledBackPolicy: Policy | null = null;
  if (versionEvolved && versionEvolved.versions) {
    const v2 = versionEvolved.versions.find((v) => v.version_number === 2);
    if (v2) {
      await PolicyService.activatePolicyVersion(ADMIN_SESSION, versionEvolved.id, v2.id);
      rolledBackPolicy = await PolicyService.rollbackPolicyVersion(ADMIN_SESSION, versionEvolved.id, 1);

      assert(
        rolledBackPolicy.active_version_number === 3 &&
          rolledBackPolicy.versions_count === 3 &&
          rolledBackPolicy.active_version?.rules[0]?.id === "RULE-ACNE-01",
        "16. Version rollback creates immutable Version 3 restoring Version 1 rules",
        `New Active Version: v${rolledBackPolicy.active_version_number}, Restored Rule: ${rolledBackPolicy.active_version?.rules[0]?.id}`
      );
    }
  } else {
    assert(false, "16. Version rollback", "versionEvolved missing");
  }

  // --------------------------------------------------------------------------
  // TEST 17: Archiving
  // --------------------------------------------------------------------------
  if (rolledBackPolicy) {
    const archived = await PolicyService.archivePolicy(ADMIN_SESSION, rolledBackPolicy.id);
    const applicableAfterArchive = PolicyEngine.resolveApplicablePolicies([archived]);

    assert(
      archived.status === "archived" && applicableAfterArchive.length === 0,
      "17. Archiving disables policy and safely excludes it from active claim evaluations",
      `Status: ${archived.status}, Applicable policies count: ${applicableAfterArchive.length}`
    );
  } else {
    assert(false, "17. Archiving", "rolledBackPolicy missing");
  }

  // --------------------------------------------------------------------------
  // TEST 18: Simulation read-only guarantee
  // --------------------------------------------------------------------------
  const auditCountBefore = AuditService.getInMemoryEvents().length;
  const simResult = await PolicyService.simulatePolicy(ADMIN_SESSION, {
    sampleClaims: [
      { claim_text: "Cures eczema in 24 hours", claim_type: "efficacy" },
      {
        claim_text: "Deeply hydrates skin barrier. *Results may vary based on skin type.",
        claim_type: "efficacy",
        evidence_types: ["clinical_dossier"],
      },
    ],
  });
  const auditCountAfter = AuditService.getInMemoryEvents().length;

  assert(
    auditCountBefore === auditCountAfter &&
      simResult.evaluatedClaimsCount === 2 &&
      simResult.nonCompliantCount === 1 &&
      simResult.compliantCount === 1,
    "18. Simulation read-only guarantee: 0 audit events emitted, 0 database mutations",
    `Audit count delta: ${auditCountAfter - auditCountBefore}, Non-compliant: ${simResult.nonCompliantCount}, Compliant: ${simResult.compliantCount}`
  );

  // --------------------------------------------------------------------------
  // TEST 19: Existing six policy compatibility
  // --------------------------------------------------------------------------
  const allSixSeedActive = DEFAULT_POLICIES.filter((p) => p.status === "active").length;
  const seedEval1 = PolicyEngine.evaluateClaim(
    "test-med",
    { claimText: "Cures eczema and dermatitis", claimType: "efficacy", evidenceTypes: [] },
    DEFAULT_POLICIES
  );
  const seedEval2 = PolicyEngine.evaluateClaim(
    "test-guar",
    { claimText: "100% guaranteed overnight miracle", claimType: "guarantee", evidenceTypes: [] },
    DEFAULT_POLICIES
  );

  assert(
    allSixSeedActive >= 6 &&
      seedEval1.triggeredRules.some((r) => r.policyCode === "POL-DERMA-001") &&
      seedEval2.triggeredRules.some((r) => r.policyCode === "POL-DERMA-002"),
    "19. Existing six baseline compliance policies continue functioning with 100% fidelity",
    `Seed active count: ${allSixSeedActive}, POL-001 match: ${seedEval1.triggeredRules.length}, POL-002 match: ${seedEval2.triggeredRules.length}`
  );

  // --------------------------------------------------------------------------
  // TEST 20: Existing publication gate compatibility
  // --------------------------------------------------------------------------
  const publicationEligibility = ReviewWorkflowService.evaluatePublicationEligibility(
    [
      {
        id: "cl-1",
        is_active: true,
        verification_status: "verified",
        review_status: "pending", // Unreviewed violation
        policy_compliance_status: "non_compliant",
        mandatory_reviewer_role: "legal_reviewer",
      },
    ]
  );

  assert(
    !publicationEligibility.isEligible &&
      (publicationEligibility.policyViolationsCount || 0) > 0 &&
      publicationEligibility.blockingReasons.some((r) => r.includes("non-compliant") || r.includes("review")),
    "20. Existing publication gate compatibility: Policy violations strictly lock publication",
    `Gate eligible: ${publicationEligibility.isEligible}, Violations: ${publicationEligibility.policyViolationsCount}, Reason: ${publicationEligibility.blockingReasons[0]}`
  );

  // --------------------------------------------------------------------------
  // TEST 21: Creator cannot manage policies
  // --------------------------------------------------------------------------
  let creatorBlocked = false;
  try {
    await PolicyService.createPolicy(CREATOR_SESSION, {
      name: "Creator Illegal Policy",
      code: "POL-CREATOR-01",
      category: "prohibited_claims",
      rules: [],
    });
  } catch (err) {
    creatorBlocked = (err as Error).message.includes("Forbidden");
  }

  assert(
    creatorBlocked,
    "21. Creator cannot manage policies: Unauthorized creation attempts throw Forbidden",
    "Creator role strictly prohibited from policy modifications"
  );

  // --------------------------------------------------------------------------
  // TEST 22: Reviewer cannot publish policies
  // --------------------------------------------------------------------------
  let reviewerBlocked = false;
  try {
    await PolicyService.activatePolicyVersion(
      COMPLIANCE_SESSION,
      DEFAULT_POLICIES[0].id,
      DEFAULT_POLICIES[0].active_version_id || "v1"
    );
  } catch (err) {
    reviewerBlocked = (err as Error).message.includes("Forbidden");
  }

  assert(
    reviewerBlocked,
    "22. Reviewer cannot publish policies: Publishing gated strictly to workspace administrators",
    "Compliance reviewer cannot activate or mutate policies"
  );

  // --------------------------------------------------------------------------
  // TEST 23: Cross-workspace policy isolation
  // --------------------------------------------------------------------------
  const foreignPolicies = await PolicyService.getPolicies(FOREIGN_SESSION);
  const dermaglowFoundInForeign = foreignPolicies.some(
    (p) => p.code === "POL-DERMA-001" && p.workspace_id === DERMAGLOW_WORKSPACE_ID
  );

  assert(
    !dermaglowFoundInForeign,
    "23. Cross-workspace policy isolation: Foreign tenant queries cannot access workspace policies",
    `Foreign policies count: ${foreignPolicies.length}`
  );

  // --------------------------------------------------------------------------
  // TEST 24: Audit trail creation
  // --------------------------------------------------------------------------
  const auditEvents = AuditService.getInMemoryEvents();
  const createdLogged = auditEvents.some((e) => e.action === "policy_created");
  const activatedLogged = auditEvents.some((e) => e.action === "policy_activated");
  const rollbackLogged = auditEvents.some((e) => e.action === "policy_rollback");
  const archivedLogged = auditEvents.some((e) => e.action === "policy_archived");

  assert(
    createdLogged && activatedLogged && rollbackLogged && archivedLogged,
    "24. Audit trail creation records policy_created, activated, rollback, and archived events",
    `Audit events verified: created=${createdLogged}, activated=${activatedLogged}, rollback=${rollbackLogged}, archived=${archivedLogged}`
  );

  // --------------------------------------------------------------------------
  // TEST 25: Historical verification integrity
  // --------------------------------------------------------------------------
  // Verify that evaluating against an explicit effectiveDate in the past resolves historical version 1
  const historicalDate = new Date("2026-11-01T00:00:00Z");
  const historicalResolved = PolicyEngine.resolveEffectiveVersion(
    DEFAULT_POLICIES[0],
    historicalDate
  );

  assert(
    historicalResolved !== null && historicalResolved.version_number === 1,
    "25. Historical verification integrity: Claims retain immutable policy version provenance",
    `Resolved version for 2026-11-01: Version ${historicalResolved?.version_number}`
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n========================================================================");
  console.log(`Phase 3 Policy Studio & Rule Engine Complete: ${passedCount}/25 passed (${failedCount} failed)`);
  console.log("========================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase3Tests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
