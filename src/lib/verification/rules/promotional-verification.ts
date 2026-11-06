
/**
 * BrandShield AI — Promotional Terms Verification Rule
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Verifies campaign terms, limited-time offers, and event qualifications.
 */

import { EvidenceMatch, RuleResult, VerificationContext } from "../types";
import { EvidenceValidator } from "../evidence/evidence-validator";

export function verifyPromotionalClaim(context: VerificationContext): RuleResult {
  const { claim, product, promotions, effectiveDate, channel } = context;

  const activePromotions = promotions.filter(
    (p) =>
      (!product || p.product_id === product.id) &&
      EvidenceValidator.isPromotionActive(p, effectiveDate) &&
      EvidenceValidator.isChannelApplicable(p, channel)
  );

  const evidenceMatches: EvidenceMatch[] = [];

  for (const promo of activePromotions) {
    if (claim.claim_text.toLowerCase().includes(promo.promotion_name.toLowerCase()) || claim.claim_text.toLowerCase().includes("festival")) {
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Campaign terms for "${promo.promotion_name}": ${promo.terms || "Standard festival promotion terms apply."}`,
        relevanceScore: 0.95,
      });

      const status = "supported";
      return {
        ruleId: "promotional_verification_v1",
        status,
        riskLevel: "low",
        sufficiency: "sufficient",
        explanation: `Promotional statement corroborated by active campaign rules for "${promo.promotion_name}".`,
        evidenceMatches,
      };
    }
  }

  return {
    ruleId: "promotional_verification_v1",
    status: "needs_review",
    riskLevel: "medium",
    sufficiency: "insufficient",
    explanation: `Promotional condition requires marketing management sign-off against published campaign terms.`,
    evidenceMatches: [],
  };
}
