/**
 * BrandShield AI — Product Attribute & Formulation Verification Rule
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Verifies active concentration, ingredient specification, and formulation claims
 * against approved product facts.
 */

import { EvidenceMatch, RuleResult, VerificationContext } from "../types";
import { EvidenceValidator } from "../evidence/evidence-validator";
import { RiskCalculator } from "../risk/risk-calculator";

export function verifyProductAttributeClaim(context: VerificationContext): RuleResult {
  const { claim, product, approvedFacts, effectiveDate } = context;

  if (!product) {
    return {
      ruleId: "product_attribute_v1",
      status: "needs_review",
      riskLevel: "medium",
      sufficiency: "insufficient",
      explanation: "Attribute assertion cannot be verified because no specific product catalog entry is associated.",
      evidenceMatches: [],
    };
  }

  // 1. Check for concentration / ingredient claim
  const textLower = claim.claim_text.toLowerCase();
  const entities = claim.extracted_entities || {};

  // Extract advertised concentration
  let claimedConcentration: number | null = null;
  if (typeof entities.concentration === "number") {
    claimedConcentration = entities.concentration;
  } else if (typeof entities.concentration === "string") {
    claimedConcentration = parseFloat(entities.concentration.replace(/%/g, ""));
  } else {
    const match = claim.claim_text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (match) {
      claimedConcentration = parseFloat(match[1]);
    }
  }

  const isVitaminC =
    textLower.includes("vitamin c") ||
    textLower.includes("l-ascorbic") ||
    textLower.includes("ascorbic");

  // Retrieve relevant approved facts for this product
  const concentrationFact = approvedFacts.find(
    (f) =>
      f.product_id === product.id &&
      (f.fact_key === "vitamin_c_concentration" || f.fact_type === "ingredient_specification")
  );

  const evidenceMatches: EvidenceMatch[] = [];

  if (concentrationFact && isVitaminC) {
    // Check temporal validity
    if (!EvidenceValidator.isFactValid(concentrationFact, effectiveDate)) {
      evidenceMatches.push({
        approvedFactId: concentrationFact.id,
        evidenceType: "approved_fact",
        evidenceExcerpt: `Historical fact: ${JSON.stringify(concentrationFact.fact_value)}. Expired on ${concentrationFact.valid_until}.`,
        relevanceScore: 0.8,
      });

      const status = "outdated";
      return {
        ruleId: "product_attribute_v1",
        status,
        riskLevel: RiskCalculator.calculateRisk({ status, claimType: "product_attribute", claimText: claim.claim_text }),
        sufficiency: "outdated",
        explanation: `Supporting specification for Vitamin C concentration has expired or been superseded.`,
        evidenceMatches,
      };
    }

    // Ground-truth concentration
    const factVal = concentrationFact.fact_value as Record<string, unknown>;
    let approvedConcentration: number | null = null;

    if (typeof factVal.concentration === "string") {
      approvedConcentration = parseFloat(factVal.concentration.replace(/%/g, ""));
    } else if (typeof factVal.concentration === "number") {
      approvedConcentration = factVal.concentration;
    }

    evidenceMatches.push({
      approvedFactId: concentrationFact.id,
      evidenceType: "approved_fact",
      evidenceExcerpt: `Approved fact (${concentrationFact.fact_key}): ${product.name} contains precisely ${factVal.concentration} ${factVal.form || ""} ${factVal.ingredient || ""}.`,
      relevanceScore: 1.0,
    });

    if (claimedConcentration !== null && approvedConcentration !== null) {
      // Direct exact match
      if (Math.abs(claimedConcentration - approvedConcentration) < 0.001) {
        const status = "supported";
        return {
          ruleId: "product_attribute_v1",
          status,
          riskLevel: RiskCalculator.calculateRisk({ status, claimType: "product_attribute", claimText: claim.claim_text }),
          sufficiency: "sufficient",
          explanation: `Advertised concentration of ${claimedConcentration}% Vitamin C matches approved product specification (${approvedConcentration}%).`,
          evidenceMatches,
        };
      }

      // Direct contradiction (e.g. claiming 25% when approved specification is 10%)
      const status = "contradicted";
      return {
        ruleId: "product_attribute_v1",
        status,
        riskLevel: RiskCalculator.calculateRisk({ status, claimType: "product_attribute", claimText: claim.claim_text }),
        sufficiency: "sufficient",
        explanation: `Direct formulation contradiction: Approved specification for ${product.name} is ${approvedConcentration}% ${factVal.ingredient || "Vitamin C"}. Advertised claim of ${claimedConcentration}% is unsubstantiated and exaggerated.`,
        suggestedCorrection: `Formulated with ${approvedConcentration}% stabilised Vitamin C`,
        evidenceMatches,
      };
    }
  }

  // 2. Check general dermatological safety / attribute facts
  const safetyFact = approvedFacts.find((f) => f.fact_key === "dermatological_safety");
  if (safetyFact && (textLower.includes("dermatologist") || textLower.includes("sensitive"))) {
    const sVal = safetyFact.fact_value as Record<string, unknown>;
    evidenceMatches.push({
      approvedFactId: safetyFact.id,
      evidenceType: "approved_fact",
      evidenceExcerpt: `Dermatological safety fact: Dermatologist tested = ${sVal.dermatologist_tested}. Notes: ${sVal.notes || ""}`,
      relevanceScore: 0.95,
    });

    const status = "supported";
    return {
      ruleId: "product_attribute_v1",
      status,
      riskLevel: RiskCalculator.calculateRisk({ status, claimType: "product_attribute", claimText: claim.claim_text }),
      sufficiency: "sufficient",
      explanation: `Attribute assertion corroborated by approved dermatological safety documentation.`,
      evidenceMatches,
    };
  }

  // 3. Fallback when no structured ground-truth exists for the claimed attribute:
  // "Absence of evidence alone is not sufficient to establish contradiction." -> UNVERIFIED
  return {
    ruleId: "product_attribute_v1",
    status: "unverified",
    riskLevel: "medium",
    sufficiency: "insufficient",
    explanation: `No approved product specification fact exists in the catalogue for "${claim.claim_text}". Awaiting laboratory dossier registration.`,
    evidenceMatches: [],
  };
}
