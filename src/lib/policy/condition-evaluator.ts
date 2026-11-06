/**
 * BrandShield AI — Phase 9: Deterministic Policy Condition Evaluator
 *
 * Evaluates individual rule conditions against a claim context without external
 * API or LLM dependencies. Guarantees deterministic, reproducible compliance outputs.
 */

import { PolicyCondition } from "@/types";

export interface ConditionEvaluationContext {
  claimText: string;
  claimType: string;
  productId?: string | null;
  channel?: string | null;
  extractedEntities?: Record<string, unknown>;
  evidenceTypes: string[];
  submissionContent?: string;
}

export interface ConditionEvaluationResult {
  condition: PolicyCondition;
  isMatched: boolean;
  matchedDetail?: string;
}

export class ConditionEvaluator {
  /**
   * Deterministically evaluates a single condition against claim context.
   */
  public static evaluateCondition(
    condition: PolicyCondition,
    context: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    const { field, operator, value } = condition;
    const textLower = context.claimText.toLowerCase();

    switch (operator) {
      case "contains_phrase": {
        const phrases = Array.isArray(value) ? value : [String(value)];
        for (const rawPhrase of phrases) {
          const phrase = rawPhrase.toLowerCase().trim();
          if (textLower.includes(phrase)) {
            return {
              condition,
              isMatched: true,
              matchedDetail: `Text contains prohibited phrase "${rawPhrase}"`,
            };
          }
        }
        return { condition, isMatched: false };
      }

      case "matches_regex": {
        try {
          const pattern = new RegExp(String(value), "i");
          const targetText = field === "claim_text" ? context.claimText : (context.submissionContent || context.claimText);
          const match = targetText.match(pattern);
          if (match) {
            return {
              condition,
              isMatched: true,
              matchedDetail: `Pattern /${value}/ matched "${match[0]}"`,
            };
          }
        } catch (err) {
          console.warn("Invalid regex pattern in policy condition:", value, err);
        }
        return { condition, isMatched: false };
      }

      case "claim_type_is": {
        const targetType = String(value).toLowerCase();
        const actualType = context.claimType.toLowerCase();
        const isMatched = actualType === targetType;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Claim type is "${actualType}"` : undefined,
        };
      }

      case "equals": {
        const target = String(value).toLowerCase();
        const actual = String(context[field as keyof ConditionEvaluationContext] || "").toLowerCase();
        const isMatched = actual === target;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Field "${field}" equals "${value}"` : undefined,
        };
      }

      case "not_equals": {
        const target = String(value).toLowerCase();
        const actual = String(context[field as keyof ConditionEvaluationContext] || "").toLowerCase();
        const isMatched = actual !== target;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Field "${field}" does not equal "${value}"` : undefined,
        };
      }

      case "in_list": {
        const list = Array.isArray(value) ? value.map((v) => String(v).toLowerCase()) : [String(value).toLowerCase()];
        const actual = String(context[field as keyof ConditionEvaluationContext] || "").toLowerCase();
        const isMatched = list.includes(actual);
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Field "${field}" (${actual}) is in [${list.join(", ")}]` : undefined,
        };
      }

      case "not_in_list": {
        const list = Array.isArray(value) ? value.map((v) => String(v).toLowerCase()) : [String(value).toLowerCase()];
        const actual = String(context[field as keyof ConditionEvaluationContext] || "").toLowerCase();
        const isMatched = !list.includes(actual);
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Field "${field}" (${actual}) is not in [${list.join(", ")}]` : undefined,
        };
      }

      case "lacks_evidence_type": {
        const requiredType = String(value).toLowerCase();
        const hasType = context.evidenceTypes.some((t) => t.toLowerCase() === requiredType);
        // Condition matches when required evidence is MISSING
        const isMatched = !hasType;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Lacks required evidence type "${requiredType}"` : undefined,
        };
      }

      case "lacks_disclaimer": {
        const requiredDisclaimer = String(value).toLowerCase();
        const inClaim = textLower.includes(requiredDisclaimer);
        const inSubmission = (context.submissionContent || "").toLowerCase().includes(requiredDisclaimer);
        // Condition matches when required disclaimer is MISSING from both claim and submission
        const isMatched = !inClaim && !inSubmission;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Missing required disclaimer "${value}"` : undefined,
        };
      }

      case "discount_exceeds": {
        const threshold = Number(value);
        let extractedDiscount = 0;
        // Check extracted entities first
        if (context.extractedEntities?.discount_value) {
          extractedDiscount = Number(context.extractedEntities.discount_value);
        } else {
          // Parse percentage from text e.g. "60% off"
          const match = textLower.match(/(\d+(?:\.\d+)?)\s*%/);
          if (match) {
            extractedDiscount = parseFloat(match[1]);
          }
        }
        const isMatched = extractedDiscount > threshold;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Discount of ${extractedDiscount}% exceeds threshold of ${threshold}%` : undefined,
        };
      }

      case "price_deviation_exceeds": {
        const threshold = Number(value);
        let deviation = 0;
        if (context.extractedEntities?.price_deviation) {
          deviation = Number(context.extractedEntities.price_deviation);
        }
        const isMatched = deviation > threshold;
        return {
          condition,
          isMatched,
          matchedDetail: isMatched ? `Price deviation of ${deviation}% exceeds threshold of ${threshold}%` : undefined,
        };
      }

      default:
        return { condition, isMatched: false };
    }
  }
}

