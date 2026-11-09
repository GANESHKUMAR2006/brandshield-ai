/**
 * BrandShield AI — Phase 3: Policy JSON Schema Validator & Security Guardrails
 *
 * Enforces strict allowlists, data type validation, nesting depth limits, and JSON
 * size limits. Guarantees that user-configured policy rules NEVER execute arbitrary
 * code (JS, Python, SQL) or compromise engine determinism.
 */

import {
  PolicyCategory,
  PolicyCondition,
  PolicyConditionGroup,
  PolicyRule,
  PolicyRuleAction,
  RuleConditionOperator,
  RuleSeverity,
  LogicalOperator,
} from "@/types";

export const ALLOWED_FIELDS = new Set([
  "claim_text",
  "claim_type",
  "product_id",
  "channel",
  "extracted_entities",
  "evidence_types",
  "disclaimer",
  "discount_percentage",
  "discount_value",
  "price_deviation",
  "evidence_count",
  "submission_content",
]);

export const ALLOWED_OPERATORS = new Set<RuleConditionOperator>([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "exists",
  "does_not_exist",
  "in",
  "not_in",
  "contains_phrase",
  "matches_regex",
  "in_list",
  "not_in_list",
  "lacks_evidence_type",
  "lacks_disclaimer",
  "claim_type_is",
  "price_deviation_exceeds",
  "discount_exceeds",
]);

export const ALLOWED_LOGICAL_OPERATORS = new Set<LogicalOperator>([
  "AND",
  "OR",
  "NOT",
  "ALL",
  "ANY",
]);

export const ALLOWED_CATEGORIES = new Set<PolicyCategory>([
  "prohibited_claims",
  "restricted_efficacy",
  "clinical_requirements",
  "guarantee_restrictions",
  "comparative_advertising",
  "price_discount_rules",
  "promotion_validity",
  "required_disclaimers",
  "mandatory_human_review",
  "product_restrictions",
]);

export const ALLOWED_SEVERITIES = new Set<RuleSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

export const ALLOWED_ACTIONS = new Set<PolicyRuleAction>([
  "flag_violation",
  "require_evidence",
  "require_human_review",
  "block_publication",
  "display_warning",
]);

export const ALLOWED_REVIEWER_ROLES = new Set([
  "admin",
  "compliance_reviewer",
  "legal_reviewer",
]);

export const MAX_POLICY_JSON_BYTES = 100 * 1024; // 100 KB
export const MAX_RULES_PER_POLICY = 50;
export const MAX_CONDITIONS_PER_RULE = 25;
export const MAX_NESTING_DEPTH = 5;

const PROHIBITED_PROPERTY_NAMES = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const DANGEROUS_EXPRESSION_REGEX =
  /(?:<script|eval\s*\(|function\s*\(|javascript:|data:text\/javascript|DROP\s+TABLE|DELETE\s+FROM|UNION\s+SELECT|--|\bexec\b|\bspawn\b)/i;

export interface PolicyValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface PolicyValidationResult {
  isValid: boolean;
  issues: PolicyValidationIssue[];
}

export class PolicySchemaValidator {
  /**
   * Performs complete schema validation, security scanning, and structure verification.
   */
  public static validatePolicy(policy: unknown): PolicyValidationResult {
    const issues: PolicyValidationIssue[] = [];

    if (!policy || typeof policy !== "object") {
      return {
        isValid: false,
        issues: [{ path: "$", code: "INVALID_OBJECT", message: "Policy must be a non-null JSON object." }],
      };
    }

    // 1. Size constraint check
    try {
      const jsonString = JSON.stringify(policy);
      if (jsonString.length > MAX_POLICY_JSON_BYTES) {
        issues.push({
          path: "$",
          code: "PAYLOAD_TOO_LARGE",
          message: `Policy JSON payload exceeds maximum allowed size of ${MAX_POLICY_JSON_BYTES / 1024} KB (actual: ${Math.round(jsonString.length / 1024)} KB).`,
        });
      }
    } catch {
      return {
        isValid: false,
        issues: [{ path: "$", code: "SERIALIZATION_ERROR", message: "Policy contains circular references or cannot be serialized." }],
      };
    }

    const p = policy as Record<string, unknown>;

    // 2. Name validation
    if (!p.name || typeof p.name !== "string" || !p.name.trim()) {
      issues.push({ path: "name", code: "REQUIRED_FIELD", message: "Policy name is required and cannot be empty." });
    } else if (p.name.length > 200) {
      issues.push({ path: "name", code: "FIELD_TOO_LONG", message: "Policy name cannot exceed 200 characters." });
    }

    // 3. Code validation
    if (!p.code || typeof p.code !== "string" || !p.code.trim()) {
      issues.push({ path: "code", code: "REQUIRED_FIELD", message: "Policy code is required (e.g., 'POL-DERMA-001')." });
    } else {
      const codeRegex = /^[A-Z0-9_-]{3,50}$/i;
      if (!codeRegex.test(p.code.trim())) {
        issues.push({
          path: "code",
          code: "INVALID_CODE_FORMAT",
          message: "Policy code must be 3-50 alphanumeric characters with dashes or underscores.",
        });
      }
    }

    // 4. Category validation
    if (!p.category || !ALLOWED_CATEGORIES.has(p.category as PolicyCategory)) {
      issues.push({
        path: "category",
        code: "INVALID_CATEGORY",
        message: `Category '${p.category}' is invalid. Allowed: ${Array.from(ALLOWED_CATEGORIES).join(", ")}.`,
      });
    }

    // 5. Severity validation (optional at policy root, but if provided must be valid)
    if (p.severity && !ALLOWED_SEVERITIES.has(p.severity as RuleSeverity)) {
      issues.push({
        path: "severity",
        code: "INVALID_SEVERITY",
        message: `Severity '${p.severity}' is invalid. Allowed: ${Array.from(ALLOWED_SEVERITIES).join(", ")}.`,
      });
    }

    // 6. Rules validation
    if (p.rules !== undefined) {
      if (!Array.isArray(p.rules)) {
        issues.push({ path: "rules", code: "TYPE_MISMATCH", message: "'rules' must be an array." });
      } else {
        if (p.rules.length > MAX_RULES_PER_POLICY) {
          issues.push({
            path: "rules",
            code: "TOO_MANY_RULES",
            message: `Policy exceeds maximum of ${MAX_RULES_PER_POLICY} rules (found ${p.rules.length}).`,
          });
        }

        p.rules.forEach((rule, rIndex) => {
          this.validateRule(rule, `rules[${rIndex}]`, issues);
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validates an individual PolicyRule.
   */
  public static validateRule(
    rule: unknown,
    basePath: string,
    issues: PolicyValidationIssue[]
  ): void {
    if (!rule || typeof rule !== "object") {
      issues.push({ path: basePath, code: "INVALID_RULE", message: "Rule must be a non-null object." });
      return;
    }

    const r = rule as Record<string, unknown>;

    // Prototype pollution prevention
    for (const key of Object.keys(r)) {
      if (PROHIBITED_PROPERTY_NAMES.has(key)) {
        issues.push({
          path: `${basePath}.${key}`,
          code: "SECURITY_VIOLATION",
          message: `Forbidden property '${key}' detected.`,
        });
      }
    }

    // id check
    if (!r.id || typeof r.id !== "string") {
      issues.push({ path: `${basePath}.id`, code: "REQUIRED_FIELD", message: "Rule id is required." });
    }

    // name check
    if (!r.name || typeof r.name !== "string" || !r.name.trim()) {
      issues.push({ path: `${basePath}.name`, code: "REQUIRED_FIELD", message: "Rule name is required." });
    }

    // severity check
    if (!r.severity || !ALLOWED_SEVERITIES.has(r.severity as RuleSeverity)) {
      issues.push({
        path: `${basePath}.severity`,
        code: "INVALID_SEVERITY",
        message: `Severity '${r.severity}' is invalid. Allowed: ${Array.from(ALLOWED_SEVERITIES).join(", ")}.`,
      });
    }

    // action check
    if (!r.action || !ALLOWED_ACTIONS.has(r.action as PolicyRuleAction)) {
      issues.push({
        path: `${basePath}.action`,
        code: "INVALID_ACTION",
        message: `Action '${r.action}' is invalid. Allowed: ${Array.from(ALLOWED_ACTIONS).join(", ")}.`,
      });
    }

    // mandatoryReviewerRole check
    if (r.mandatoryReviewerRole && !ALLOWED_REVIEWER_ROLES.has(r.mandatoryReviewerRole as string)) {
      issues.push({
        path: `${basePath}.mandatoryReviewerRole`,
        code: "INVALID_ROLE",
        message: `Reviewer role '${r.mandatoryReviewerRole}' is invalid.`,
      });
    }

    // logic check
    if (r.logic && !ALLOWED_LOGICAL_OPERATORS.has(r.logic as LogicalOperator)) {
      issues.push({
        path: `${basePath}.logic`,
        code: "INVALID_LOGIC",
        message: `Logic operator '${r.logic}' is invalid. Allowed: ${Array.from(ALLOWED_LOGICAL_OPERATORS).join(", ")}.`,
      });
    }

    // conditions check
    if (!r.conditions || !Array.isArray(r.conditions)) {
      issues.push({
        path: `${basePath}.conditions`,
        code: "REQUIRED_FIELD",
        message: "Rule must include a non-empty 'conditions' array.",
      });
    } else {
      let totalConditions = 0;
      this.validateConditionGroup(
        { logic: (r.logic as LogicalOperator) || "AND", conditions: r.conditions },
        `${basePath}.conditions`,
        1,
        issues,
        () => totalConditions++
      );

      if (totalConditions > MAX_CONDITIONS_PER_RULE) {
        issues.push({
          path: `${basePath}.conditions`,
          code: "TOO_MANY_CONDITIONS",
          message: `Rule exceeds maximum of ${MAX_CONDITIONS_PER_RULE} conditions (found ${totalConditions}).`,
        });
      }
    }
  }

  /**
   * Recursively validates condition groups and leaf conditions with depth bounds.
   */
  private static validateConditionGroup(
    group: { logic?: string; conditions: unknown[] },
    path: string,
    currentDepth: number,
    issues: PolicyValidationIssue[],
    incrementCount: () => void
  ): void {
    if (currentDepth > MAX_NESTING_DEPTH) {
      issues.push({
        path,
        code: "MAX_DEPTH_EXCEEDED",
        message: `Condition nesting exceeds maximum depth of ${MAX_NESTING_DEPTH}.`,
      });
      return;
    }

    if (!Array.isArray(group.conditions) || group.conditions.length === 0) {
      issues.push({
        path,
        code: "EMPTY_GROUP",
        message: "Condition group must contain at least one condition.",
      });
      return;
    }

    group.conditions.forEach((item, idx) => {
      incrementCount();
      const itemPath = `${path}[${idx}]`;

      if (!item || typeof item !== "object") {
        issues.push({ path: itemPath, code: "INVALID_CONDITION", message: "Condition item must be an object." });
        return;
      }

      const cond = item as Record<string, unknown>;

      // Check if it's a nested group
      if ("conditions" in cond && Array.isArray(cond.conditions)) {
        if (cond.logic && !ALLOWED_LOGICAL_OPERATORS.has(cond.logic as LogicalOperator)) {
          issues.push({
            path: `${itemPath}.logic`,
            code: "INVALID_LOGIC",
            message: `Nested group logic '${cond.logic}' is invalid.`,
          });
        }
        this.validateConditionGroup(
          cond as { logic?: string; conditions: unknown[] },
          itemPath,
          currentDepth + 1,
          issues,
          incrementCount
        );
        return;
      }

      // Leaf condition validation
      this.validateLeafCondition(cond, itemPath, issues);
    });
  }

  /**
   * Validates a leaf condition item: field, operator, value types, and safety.
   */
  private static validateLeafCondition(
    cond: Record<string, unknown>,
    path: string,
    issues: PolicyValidationIssue[]
  ): void {
    const field = cond.field;
    const operator = cond.operator;
    const value = cond.value;

    // Field checks
    if (!field || typeof field !== "string") {
      issues.push({ path: `${path}.field`, code: "REQUIRED_FIELD", message: "Condition field is required." });
      return;
    }

    const cleanField = field.trim();

    // Security scanning on field name
    if (PROHIBITED_PROPERTY_NAMES.has(cleanField) || DANGEROUS_EXPRESSION_REGEX.test(cleanField)) {
      issues.push({
        path: `${path}.field`,
        code: "SECURITY_VIOLATION",
        message: `Field '${cleanField}' contains unsafe expressions or prohibited tokens.`,
      });
      return;
    }

    // Check allowlisted fields or safe dotted paths like 'extracted_entities.xxx'
    const isBaseField = ALLOWED_FIELDS.has(cleanField);
    const isDottedEntity = cleanField.startsWith("extracted_entities.") && /^[a-zA-Z0-9_.]+$/.test(cleanField);

    if (!isBaseField && !isDottedEntity) {
      issues.push({
        path: `${path}.field`,
        code: "INVALID_FIELD",
        message: `Field '${cleanField}' is not an authorized claim or evidence field. Allowed: ${Array.from(ALLOWED_FIELDS).join(", ")}.`,
      });
    }

    // Operator checks
    if (!operator || typeof operator !== "string") {
      issues.push({ path: `${path}.operator`, code: "REQUIRED_FIELD", message: "Condition operator is required." });
      return;
    }

    if (!ALLOWED_OPERATORS.has(operator as RuleConditionOperator)) {
      issues.push({
        path: `${path}.operator`,
        code: "INVALID_OPERATOR",
        message: `Operator '${operator}' is not supported. Allowed: ${Array.from(ALLOWED_OPERATORS).join(", ")}.`,
      });
      return;
    }

    // Data type validation based on operator
    switch (operator) {
      case "greater_than":
      case "less_than":
      case "greater_than_or_equal":
      case "less_than_or_equal":
      case "discount_exceeds":
      case "price_deviation_exceeds": {
        if (value === undefined || value === null || (typeof value !== "number" && isNaN(Number(value)))) {
          issues.push({
            path: `${path}.value`,
            code: "TYPE_MISMATCH",
            message: `Operator '${operator}' requires a numeric threshold value.`,
          });
        }
        break;
      }

      case "in":
      case "not_in":
      case "in_list":
      case "not_in_list": {
        if (!Array.isArray(value)) {
          issues.push({
            path: `${path}.value`,
            code: "TYPE_MISMATCH",
            message: `Operator '${operator}' requires an array of values.`,
          });
        }
        break;
      }

      case "matches_regex": {
        if (typeof value !== "string" || !value.trim()) {
          issues.push({
            path: `${path}.value`,
            code: "TYPE_MISMATCH",
            message: "Operator 'matches_regex' requires a non-empty regular expression string.",
          });
        } else {
          try {
            new RegExp(value);
          } catch (e) {
            issues.push({
              path: `${path}.value`,
              code: "INVALID_REGEX",
              message: `Invalid regular expression '${value}': ${(e as Error).message}.`,
            });
          }
        }
        break;
      }

      case "exists":
      case "does_not_exist": {
        // value is optional/ignored for existence checks
        break;
      }

      default: {
        // String / equality operators
        if (value === undefined || value === null) {
          issues.push({
            path: `${path}.value`,
            code: "REQUIRED_VALUE",
            message: `Operator '${operator}' requires a value.`,
          });
        }
      }
    }
  }
}
