/**
 * BrandShield AI — Phase 9: Master Deterministic Policy Engine
 *
 * Coordinates policy resolution, product-specific overrides, version validity selection,
 * multi-rule evaluation, risk scoring, evidence requirements, and reviewer assignments.
 */

import {
  Policy,
  PolicyEvaluationResult,
  PolicyRule,
  PolicyVersion,
  ReviewerRole,
  RuleSeverity,
  TriggeredRule,
  PolicyComplianceStatus,
} from "@/types";
import { ConditionEvaluationContext } from "./condition-evaluator";
import { RuleEvaluator } from "./rule-evaluator";

const SEVERITY_WEIGHTS: Record<RuleSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const ROLE_HIERARCHY: Record<ReviewerRole, number> = {
  viewer: 0,
  compliance_reviewer: 1,
  legal_reviewer: 2,
  admin: 3,
};

export class PolicyEngine {
  /**
   * Resolves the effective active version of a policy for a given effective date.
   */
  public static resolveEffectiveVersion(
    policy: Policy,
    effectiveDate: Date = new Date()
  ): PolicyVersion | null {
    // If active_version object is preloaded
    if (policy.active_version) {
      const v = policy.active_version;
      const validFrom = new Date(v.valid_from).getTime();
      const validUntil = v.valid_until ? new Date(v.valid_until).getTime() : Infinity;
      const targetTime = effectiveDate.getTime();
      if (validFrom <= targetTime && targetTime <= validUntil) {
        return v;
      }
    }

    // If versions array is provided, find matching version
    if (policy.versions && policy.versions.length > 0) {
      const targetTime = effectiveDate.getTime();
      const validVersions = policy.versions
        .filter((v) => {
          if (v.status !== "active" && v.status !== "superseded") return false;
          const from = new Date(v.valid_from).getTime();
          const until = v.valid_until ? new Date(v.valid_until).getTime() : Infinity;
          return from <= targetTime && targetTime <= until;
        })
        .sort((a, b) => b.version_number - a.version_number);

      if (validVersions.length > 0) {
        return validVersions[0];
      }
    }

    return null;
  }

  /**
   * Filters policies applicable to a claim based on workspace and product specificity.
   * Resolves product-specific policies to either supplement or override workspace-wide policies.
   */
  public static resolveApplicablePolicies(
    policies: Policy[],
    targetProductId?: string | null
  ): Policy[] {
    const workspacePolicies: Policy[] = [];
    const productPolicies: Policy[] = [];

    for (const policy of policies) {
      if (policy.status === "archived") continue;

      if (!policy.product_id) {
        workspacePolicies.push(policy);
      } else if (targetProductId && policy.product_id === targetProductId) {
        productPolicies.push(policy);
      }
    }

    // Product-specific policies augment workspace policies
    return [...workspacePolicies, ...productPolicies];
  }

  /**
   * Pure deterministic evaluation of an extracted claim against a list of policies.
   */
  public static evaluateClaim(
    claimId: string,
    claimContext: ConditionEvaluationContext,
    policies: Policy[],
    effectiveDate: Date = new Date()
  ): PolicyEvaluationResult {
    const applicablePolicies = this.resolveApplicablePolicies(policies, claimContext.productId);

    const triggeredRules: TriggeredRule[] = [];
    const effectiveVersionsInfo: {
      policyId: string;
      versionId: string;
      versionNumber: number;
      policyCode: string;
    }[] = [];

    const requiredEvidenceSet = new Set<string>();
    const mandatoryRolesSet = new Set<ReviewerRole>();

    for (const policy of applicablePolicies) {
      const effectiveVersion = this.resolveEffectiveVersion(policy, effectiveDate);
      if (!effectiveVersion) continue;

      effectiveVersionsInfo.push({
        policyId: policy.id,
        versionId: effectiveVersion.id,
        versionNumber: effectiveVersion.version_number,
        policyCode: policy.code,
      });

      const rules: PolicyRule[] = effectiveVersion.rules || [];

      for (const rule of rules) {
        const evalRes = RuleEvaluator.evaluateRule(rule, claimContext, {
          policyId: policy.id,
          policyCode: policy.code,
          versionNumber: effectiveVersion.version_number,
        });

        if (evalRes.isTriggered && evalRes.triggeredRule) {
          triggeredRules.push(evalRes.triggeredRule);

          for (const ev of evalRes.triggeredRule.requiredEvidenceTypes) {
            requiredEvidenceSet.add(ev);
          }
          if (evalRes.triggeredRule.mandatoryReviewerRole) {
            mandatoryRolesSet.add(evalRes.triggeredRule.mandatoryReviewerRole);
          }
        }
      }
    }

    // 1. Determine compliance status
    let complianceStatus: PolicyComplianceStatus = "compliant";
    const hasViolation = triggeredRules.some(
      (r) => r.action === "flag_violation" || r.severity === "critical"
    );
    const requiresReview = triggeredRules.some(
      (r) =>
        r.action === "require_human_review" ||
        r.action === "require_evidence" ||
        r.severity === "high" ||
        r.severity === "medium"
    );

    if (hasViolation) {
      complianceStatus = "non_compliant";
    } else if (requiresReview) {
      complianceStatus = "review_required";
    }

    // 2. Determine max severity
    let maxSeverity: RuleSeverity | null = null;
    let highestWeight = 0;
    for (const rule of triggeredRules) {
      const weight = SEVERITY_WEIGHTS[rule.severity] || 0;
      if (weight > highestWeight) {
        highestWeight = weight;
        maxSeverity = rule.severity;
      }
    }

    // 3. Resolve mandatory reviewer roles in order of hierarchy
    const sortedRoles = Array.from(mandatoryRolesSet).sort(
      (a, b) => (ROLE_HIERARCHY[b] || 0) - (ROLE_HIERARCHY[a] || 0)
    );

    // 4. Build summary
    let summary = "Claim complies with all active workspace policies.";
    if (complianceStatus === "non_compliant") {
      summary = `Non-compliant: Triggered ${triggeredRules.length} policy rule(s), including ${triggeredRules[0].ruleName}.`;
    } else if (complianceStatus === "review_required") {
      summary = `Review Required: Triggered ${triggeredRules.length} policy rule(s) requiring human sign-off.`;
    }

    return {
      claimId,
      complianceStatus,
      maxSeverity,
      triggeredRules,
      requiredEvidenceTypes: Array.from(requiredEvidenceSet),
      mandatoryReviewerRoles: sortedRoles,
      effectivePolicyVersions: effectiveVersionsInfo,
      summary,
    };
  }
}
