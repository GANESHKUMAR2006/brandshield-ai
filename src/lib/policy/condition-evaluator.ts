/**
 * BrandShield AI — Phase 3: Deterministic Policy Condition Evaluator
 *
 * Evaluates individual rule conditions and nested condition groups against claim context
 * without external API or LLM dependencies. Guarantees deterministic, reproducible,
 * and auditable compliance outputs with clear matched and failed telemetry.
 */

import {
  PolicyCondition,
  PolicyConditionGroup,
  RuleConditionOperator,
} from "@/types";

export interface ConditionEvaluationContext {
  claimText: string;
  claimType: string;
  productId?: string | null;
  channel?: string | null;
  extractedEntities?: Record<string, unknown>;
  evidenceTypes: string[];
  submissionContent?: string;
  discountPercentage?: number;
  discountValue?: number;
  priceDeviation?: number;
  evidenceCount?: number;
  [key: string]: unknown;
}

export interface ConditionEvaluationResult {
  condition: PolicyCondition | PolicyConditionGroup;
  isMatched: boolean;
  matchedDetail?: string;
  failedDetail?: string;
  fieldName?: string;
  operator?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
}

export class ConditionEvaluator {
  /**
   * Resolves a field value from context, supporting snake_case, camelCase,
   * and nested dotted notation (e.g., "extracted_entities.discount").
   */
  public static resolveFieldValue(
    field: string,
    context: ConditionEvaluationContext
  ): unknown {
    if (!field) return undefined;
    const cleanField = field.trim();

    // 1. Nested dotted path
    if (cleanField.includes(".")) {
      const parts = cleanField.split(".");
      let current: unknown = context;
      for (const part of parts) {
        if (current === undefined || current === null || typeof current !== "object") {
          return undefined;
        }
        const record = current as Record<string, unknown>;
        current = record[part];
      }
      return current;
    }

    const norm = cleanField.toLowerCase().replace(/_/g, "");

    switch (norm) {
      case "claimtext":
        return context.claimText;
      case "claimtype":
        return context.claimType;
      case "productid":
        return context.productId;
      case "channel":
        return context.channel;
      case "evidencetypes":
        return context.evidenceTypes || [];
      case "evidencecount":
        return typeof context.evidenceCount === "number"
          ? context.evidenceCount
          : (context.evidenceTypes || []).length;
      case "submissioncontent":
        return context.submissionContent;
      case "discountpercentage":
      case "discountvalue": {
        if (context.discountPercentage !== undefined) return context.discountPercentage;
        if (context.discountValue !== undefined) return context.discountValue;
        if (context.extractedEntities?.discount_value !== undefined) {
          return Number(context.extractedEntities.discount_value);
        }
        const discMatch = (context.claimText || "").match(/(\d+(?:\.\d+)?)\s*%/);
        return discMatch ? parseFloat(discMatch[1]) : undefined;
      }
      case "pricedeviation":
        return context.priceDeviation !== undefined
          ? context.priceDeviation
          : context.extractedEntities?.price_deviation !== undefined
          ? Number(context.extractedEntities.price_deviation)
          : undefined;
      case "disclaimer":
        return context.submissionContent || context.claimText;
      case "extractedentities":
        return context.extractedEntities;
      default:
        return (
          context[cleanField] ??
          (context.extractedEntities as Record<string, unknown> | undefined)?.[cleanField]
        );
    }
  }

  /**
   * Deterministically evaluates a single leaf condition against claim context.
   */
  public static evaluateCondition(
    condition: PolicyCondition,
    context: ConditionEvaluationContext
  ): ConditionEvaluationResult {
    const { field, operator, value } = condition;
    const actual = this.resolveFieldValue(field, context);
    const textLower = (context.claimText || "").toLowerCase();

    switch (operator) {
      // 1. EQUALS
      case "equals": {
        if (actual === undefined || actual === null) {
          return {
            condition,
            isMatched: false,
            fieldName: field,
            operator,
            expectedValue: value,
            actualValue: null,
            failedDetail: `Field "${field}" is missing or null, does not equal "${value}"`,
          };
        }

        const isMatched =
          typeof actual === "number" && !isNaN(Number(value))
            ? Number(actual) === Number(value)
            : String(actual).toLowerCase().trim() === String(value).toLowerCase().trim();

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: value,
          actualValue: actual,
          matchedDetail: isMatched ? `Field "${field}" equals "${value}"` : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" with value "${actual}" does not equal "${value}"`
            : undefined,
        };
      }

      // 2. NOT_EQUALS
      case "not_equals": {
        const isMatched =
          actual === undefined || actual === null
            ? true
            : typeof actual === "number" && !isNaN(Number(value))
            ? Number(actual) !== Number(value)
            : String(actual).toLowerCase().trim() !== String(value).toLowerCase().trim();

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: value,
          actualValue: actual,
          matchedDetail: isMatched ? `Field "${field}" does not equal "${value}"` : undefined,
          failedDetail: !isMatched ? `Field "${field}" equals "${value}"` : undefined,
        };
      }

      // 3. CONTAINS
      case "contains": {
        const searchStr = String(value || "").toLowerCase().trim();
        let isMatched = false;

        if (Array.isArray(actual)) {
          isMatched = actual.some(
            (item) => String(item).toLowerCase().trim() === searchStr
          );
        } else if (typeof actual === "string") {
          isMatched = actual.toLowerCase().includes(searchStr);
        } else if (actual !== undefined && actual !== null) {
          isMatched = String(actual).toLowerCase().includes(searchStr);
        }

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: value,
          actualValue: actual,
          matchedDetail: isMatched ? `Field "${field}" contains "${searchStr}"` : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" does not contain expected substring "${searchStr}"`
            : undefined,
        };
      }

      // 4. NOT_CONTAINS
      case "not_contains": {
        const searchStr = String(value || "").toLowerCase().trim();
        let contains = false;

        if (Array.isArray(actual)) {
          contains = actual.some(
            (item) => String(item).toLowerCase().trim() === searchStr
          );
        } else if (typeof actual === "string") {
          contains = actual.toLowerCase().includes(searchStr);
        } else if (actual !== undefined && actual !== null) {
          contains = String(actual).toLowerCase().includes(searchStr);
        }

        const isMatched = !contains;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: value,
          actualValue: actual,
          matchedDetail: isMatched
            ? `Field "${field}" does not contain "${searchStr}"`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" contains prohibited substring "${searchStr}"`
            : undefined,
        };
      }

      // 5. GREATER_THAN (Numeric)
      case "greater_than": {
        const numActual = Number(actual);
        const threshold = Number(value);
        const isValid = !isNaN(numActual) && actual !== undefined && actual !== null;
        const isMatched = isValid && numActual > threshold;

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: isValid ? numActual : null,
          matchedDetail: isMatched
            ? `Field "${field}" (${numActual}) is greater than ${threshold}`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" (${isValid ? numActual : "undefined"}) is not greater than ${threshold}`
            : undefined,
        };
      }

      // 6. LESS_THAN (Numeric)
      case "less_than": {
        const numActual = Number(actual);
        const threshold = Number(value);
        const isValid = !isNaN(numActual) && actual !== undefined && actual !== null;
        const isMatched = isValid && numActual < threshold;

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: isValid ? numActual : null,
          matchedDetail: isMatched
            ? `Field "${field}" (${numActual}) is less than ${threshold}`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" (${isValid ? numActual : "undefined"}) is not less than ${threshold}`
            : undefined,
        };
      }

      // 7. GREATER_THAN_OR_EQUAL
      case "greater_than_or_equal": {
        const numActual = Number(actual);
        const threshold = Number(value);
        const isValid = !isNaN(numActual) && actual !== undefined && actual !== null;
        const isMatched = isValid && numActual >= threshold;

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: isValid ? numActual : null,
          matchedDetail: isMatched
            ? `Field "${field}" (${numActual}) >= ${threshold}`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" (${isValid ? numActual : "undefined"}) is not >= ${threshold}`
            : undefined,
        };
      }

      // 8. LESS_THAN_OR_EQUAL
      case "less_than_or_equal": {
        const numActual = Number(actual);
        const threshold = Number(value);
        const isValid = !isNaN(numActual) && actual !== undefined && actual !== null;
        const isMatched = isValid && numActual <= threshold;

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: isValid ? numActual : null,
          matchedDetail: isMatched
            ? `Field "${field}" (${numActual}) <= ${threshold}`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" (${isValid ? numActual : "undefined"}) is not <= ${threshold}`
            : undefined,
        };
      }

      // 9. EXISTS
      case "exists": {
        const isMatched =
          actual !== undefined &&
          actual !== null &&
          actual !== "" &&
          (!Array.isArray(actual) || actual.length > 0);

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          actualValue: actual,
          matchedDetail: isMatched ? `Field "${field}" exists` : undefined,
          failedDetail: !isMatched ? `Field "${field}" does not exist or is empty` : undefined,
        };
      }

      // 10. DOES_NOT_EXIST
      case "does_not_exist": {
        const isMatched =
          actual === undefined ||
          actual === null ||
          actual === "" ||
          (Array.isArray(actual) && actual.length === 0);

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          actualValue: actual,
          matchedDetail: isMatched ? `Field "${field}" does not exist` : undefined,
          failedDetail: !isMatched ? `Field "${field}" exists with value "${actual}"` : undefined,
        };
      }

      // 11. IN (List Membership)
      case "in":
      case "in_list": {
        const list = Array.isArray(value)
          ? value.map((v) => String(v).toLowerCase().trim())
          : [String(value).toLowerCase().trim()];
        const actualStr = String(actual || "").toLowerCase().trim();
        const isMatched = actual !== undefined && actual !== null && list.includes(actualStr);

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: list,
          actualValue: actual,
          matchedDetail: isMatched
            ? `Field "${field}" ("${actualStr}") is in [${list.join(", ")}]`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" ("${actualStr}") is not in [${list.join(", ")}]`
            : undefined,
        };
      }

      // 12. NOT_IN (List Exclusion)
      case "not_in":
      case "not_in_list": {
        const list = Array.isArray(value)
          ? value.map((v) => String(v).toLowerCase().trim())
          : [String(value).toLowerCase().trim()];
        const actualStr = String(actual || "").toLowerCase().trim();
        const isMatched = actual === undefined || actual === null || !list.includes(actualStr);

        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: list,
          actualValue: actual,
          matchedDetail: isMatched
            ? `Field "${field}" ("${actualStr}") is not in [${list.join(", ")}]`
            : undefined,
          failedDetail: !isMatched
            ? `Field "${field}" ("${actualStr}") is in excluded list [${list.join(", ")}]`
            : undefined,
        };
      }

      // 13. CONTAINS_PHRASE (Legacy Phrase Matcher)
      case "contains_phrase": {
        const phrases = Array.isArray(value) ? value : [String(value)];
        for (const rawPhrase of phrases) {
          const phrase = rawPhrase.toLowerCase().trim();
          if (textLower.includes(phrase)) {
            return {
              condition,
              isMatched: true,
              fieldName: field,
              operator,
              expectedValue: rawPhrase,
              matchedDetail: `Text contains prohibited phrase "${rawPhrase}"`,
            };
          }
        }
        return {
          condition,
          isMatched: false,
          fieldName: field,
          operator,
          expectedValue: phrases,
          failedDetail: `Text does not contain any of phrases [${phrases.join(", ")}]`,
        };
      }

      // 14. MATCHES_REGEX
      case "matches_regex": {
        try {
          const pattern = new RegExp(String(value), "i");
          const targetText =
            field === "claim_text"
              ? context.claimText
              : context.submissionContent || context.claimText || "";
          const match = targetText.match(pattern);
          if (match) {
            return {
              condition,
              isMatched: true,
              fieldName: field,
              operator,
              expectedValue: String(value),
              actualValue: match[0],
              matchedDetail: `Pattern /${value}/ matched "${match[0]}"`,
            };
          }
        } catch (err) {
          console.warn("Invalid regex pattern in policy condition:", value, err);
        }
        return {
          condition,
          isMatched: false,
          fieldName: field,
          operator,
          expectedValue: String(value),
          failedDetail: `Pattern /${value}/ did not match text`,
        };
      }

      // 15. CLAIM_TYPE_IS
      case "claim_type_is": {
        const targetType = String(value).toLowerCase();
        const actualType = (context.claimType || "").toLowerCase();
        const isMatched = actualType === targetType;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: targetType,
          actualValue: actualType,
          matchedDetail: isMatched ? `Claim type is "${actualType}"` : undefined,
          failedDetail: !isMatched
            ? `Claim type "${actualType}" does not match "${targetType}"`
            : undefined,
        };
      }

      // 16. LACKS_EVIDENCE_TYPE
      case "lacks_evidence_type": {
        const requiredType = String(value).toLowerCase();
        const hasType = (context.evidenceTypes || []).some(
          (t) => t.toLowerCase() === requiredType
        );
        const isMatched = !hasType;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: requiredType,
          matchedDetail: isMatched
            ? `Lacks required evidence type "${requiredType}"`
            : undefined,
          failedDetail: !isMatched
            ? `Evidence type "${requiredType}" is present`
            : undefined,
        };
      }

      // 17. LACKS_DISCLAIMER
      case "lacks_disclaimer": {
        const requiredDisclaimer = String(value).toLowerCase();
        const inClaim = textLower.includes(requiredDisclaimer);
        const inSubmission = (context.submissionContent || "").toLowerCase().includes(requiredDisclaimer);
        const isMatched = !inClaim && !inSubmission;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: requiredDisclaimer,
          matchedDetail: isMatched ? `Missing required disclaimer "${value}"` : undefined,
          failedDetail: !isMatched ? `Required disclaimer "${value}" is present` : undefined,
        };
      }

      // 18. DISCOUNT_EXCEEDS
      case "discount_exceeds": {
        const threshold = Number(value);
        let extractedDiscount = 0;
        if (context.extractedEntities?.discount_value !== undefined) {
          extractedDiscount = Number(context.extractedEntities.discount_value);
        } else if (context.discountPercentage !== undefined) {
          extractedDiscount = context.discountPercentage;
        } else {
          const match = textLower.match(/(\d+(?:\.\d+)?)\s*%/);
          if (match) {
            extractedDiscount = parseFloat(match[1]);
          }
        }
        const isMatched = extractedDiscount > threshold;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: extractedDiscount,
          matchedDetail: isMatched
            ? `Discount of ${extractedDiscount}% exceeds threshold of ${threshold}%`
            : undefined,
          failedDetail: !isMatched
            ? `Discount of ${extractedDiscount}% does not exceed threshold of ${threshold}%`
            : undefined,
        };
      }

      // 19. PRICE_DEVIATION_EXCEEDS
      case "price_deviation_exceeds": {
        const threshold = Number(value);
        let deviation = 0;
        if (context.extractedEntities?.price_deviation !== undefined) {
          deviation = Number(context.extractedEntities.price_deviation);
        } else if (context.priceDeviation !== undefined) {
          deviation = context.priceDeviation;
        }
        const isMatched = deviation > threshold;
        return {
          condition,
          isMatched,
          fieldName: field,
          operator,
          expectedValue: threshold,
          actualValue: deviation,
          matchedDetail: isMatched
            ? `Price deviation of ${deviation}% exceeds threshold of ${threshold}%`
            : undefined,
          failedDetail: !isMatched
            ? `Price deviation of ${deviation}% does not exceed threshold of ${threshold}%`
            : undefined,
        };
      }

      default:
        return {
          condition,
          isMatched: false,
          fieldName: field,
          operator,
          failedDetail: `Unsupported operator: ${operator}`,
        };
    }
  }
}
