/**
 * BrandShield AI — Phase 9: Policy Rule Evaluator
 *
 * Evaluates a single PolicyRule against a claim context using boolean logic (ALL/ANY).
 * Constructs explainable TriggeredRule outputs with exact matched condition telemetry.
 */

import { PolicyRule, TriggeredRule } from "@/types";
import { ConditionEvaluator, ConditionEvaluationContext } from "./condition-evaluator";

export interface RuleEvaluationResult {
  isTriggered: boolean;
  rule: PolicyRule;
  triggeredRule?: TriggeredRule;
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
      return { isTriggered: false, rule };
    }

    const evaluationResults = rule.conditions.map((cond) =>
      ConditionEvaluator.evaluateCondition(cond, context)
    );

    const matchedResults = evaluationResults.filter((r) => r.isMatched);
    const isTriggered =
      rule.logic === "ALL"
        ? matchedResults.length === rule.conditions.length
        : matchedResults.length > 0;

    if (!isTriggered) {
      return { isTriggered: false, rule };
    }

    // Format explanation with matched details
    const matchedPhrases = matchedResults
      .map((r) => r.matchedDetail)
      .filter(Boolean) as string[];

    let explanation = rule.explanationTemplate;
    if (explanation.includes("{{phrase}}")) {
      const phraseDetail = matchedPhrases.find((p) => p.includes('"'));
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
      matchedConditions: matchedPhrases,
      requiredEvidenceTypes: rule.requiredEvidenceTypes || [],
      mandatoryReviewerRole: rule.mandatoryReviewerRole,
      explanation,
      suggestedCorrection: rule.suggestedCorrection,
    };

    return {
      isTriggered: true,
      rule,
      triggeredRule,
    };
  }
}

