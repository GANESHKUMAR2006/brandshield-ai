/**
 * BrandShield AI — Phase 3: Policy Rule Evaluator with Nested Logic & Telemetry
 *
 * Evaluates PolicyRule configurations supporting:
 * - Nested AND / OR / NOT condition groups
 * - Detailed telemetry: matchedConditions and failedConditions
 * - Safe data type evaluation and missing field resilience
 * - Explainable TriggeredRule compilation
 */

import {
  LogicalOperator,
  PolicyCondition,
  PolicyConditionGroup,
  PolicyRule,
  TriggeredRule,
} from "@/types";
import {
  ConditionEvaluator,
  ConditionEvaluationContext,
  ConditionEvaluationResult,
} from "./condition-evaluator";

export interface RuleEvaluationResult {
  isTriggered: boolean;
  rule: PolicyRule;
  triggeredRule?: TriggeredRule;
  matchedConditions: string[];
  failedConditions: string[];
}

interface GroupEvaluationInternalResult {
  isMatched: boolean;
  matchedDetails: string[];
  failedDetails: string[];
}

export class RuleEvaluator {
  /**
   * Deterministically evaluates a policy rule against claim context.
   */
  public static evaluateRule(
    rule: PolicyRule,
    context: ConditionEvaluationContext,
    policyMeta: {
      policyId: string;
      policyCode: string;
      versionNumber: number;
    }
  ): RuleEvaluationResult {
    if (!rule.conditions || rule.conditions.length === 0) {
      return {
        isTriggered: false,
        rule,
        matchedConditions: [],
        failedConditions: ["Rule defines zero conditions"],
      };
    }

    // Default logic: rule.logic || "AND"
    const rootLogic = (rule.logic as LogicalOperator) || "AND";

    // Evaluate root condition group
    const evalRes = this.evaluateGroup(
      { logic: rootLogic, conditions: rule.conditions },
      context
    );

    const isTriggered = evalRes.isMatched;

    if (!isTriggered) {
      return {
        isTriggered: false,
        rule,
        matchedConditions: evalRes.matchedDetails,
        failedConditions: evalRes.failedDetails,
      };
    }

    // Format explanation with matched details
    let explanation = rule.explanationTemplate || `Rule '${rule.name}' was triggered.`;
    if (explanation.includes("{{phrase}}")) {
      const phraseDetail = evalRes.matchedDetails.find((p) => p.includes('"'));
      const extracted = phraseDetail ? phraseDetail.split('"')[1] : "detected wording";
      explanation = explanation.replace("{{phrase}}", extracted);
    }

    const triggeredRule: TriggeredRule = {
      ruleId: rule.id,
      ruleName: rule.name,
      policyId: policyMeta.policyId,
      policyCode: policyMeta.policyCode,
      policyVersionNumber: policyMeta.versionNumber,
      category: rule.category,
      severity: rule.severity,
      action: rule.action,
      matchedConditions: evalRes.matchedDetails,
      failedConditions: evalRes.failedDetails,
      requiredEvidenceTypes: rule.requiredEvidenceTypes || [],
      mandatoryReviewerRole: rule.mandatoryReviewerRole,
      explanation,
      suggestedCorrection: rule.suggestedCorrection,
    };

    return {
      isTriggered: true,
      rule,
      triggeredRule,
      matchedConditions: evalRes.matchedDetails,
      failedConditions: evalRes.failedDetails,
    };
  }

  /**
   * Recursively evaluates a condition group using AND, OR, or NOT boolean logic.
   */
  public static evaluateGroup(
    group: { logic: LogicalOperator; conditions: (PolicyCondition | PolicyConditionGroup)[] },
    context: ConditionEvaluationContext
  ): GroupEvaluationInternalResult {
    const matchedDetails: string[] = [];
    const failedDetails: string[] = [];
    const childOutcomes: boolean[] = [];

    const normLogic = (group.logic || "AND").toUpperCase() as LogicalOperator;

    for (const item of group.conditions) {
      // Check if item is a nested group (has 'conditions' array)
      if ("conditions" in item && Array.isArray((item as PolicyConditionGroup).conditions)) {
        const nestedGroup = item as PolicyConditionGroup;
        const subRes = this.evaluateGroup(nestedGroup, context);
        childOutcomes.push(subRes.isMatched);
        matchedDetails.push(...subRes.matchedDetails);
        failedDetails.push(...subRes.failedDetails);
      } else {
        // Leaf condition
        const leafCond = item as PolicyCondition;
        const leafRes = ConditionEvaluator.evaluateCondition(leafCond, context);
        childOutcomes.push(leafRes.isMatched);
        if (leafRes.isMatched && leafRes.matchedDetail) {
          matchedDetails.push(leafRes.matchedDetail);
        } else if (!leafRes.isMatched && leafRes.failedDetail) {
          failedDetails.push(leafRes.failedDetail);
        }
      }
    }

    let isMatched = false;

    switch (normLogic) {
      case "AND":
      case "ALL":
        isMatched = childOutcomes.length > 0 && childOutcomes.every(Boolean);
        break;

      case "OR":
      case "ANY":
        isMatched = childOutcomes.some(Boolean);
        break;

      case "NOT":
        // NOT condition: inverts result of the sub-conditions.
        // If child condition matched, then NOT condition evaluates to FALSE.
        // If NO child conditions matched, NOT evaluates to TRUE.
        isMatched = !childOutcomes.some(Boolean);
        break;

      default:
        isMatched = childOutcomes.every(Boolean);
    }

    return {
      isMatched,
      matchedDetails,
      failedDetails,
    };
  }
}
