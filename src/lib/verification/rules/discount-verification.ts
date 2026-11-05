/**
 * BrandShield AI — Discount Claim Verification Rule
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Verifies discount assertions (percentage or amount-off) against approved promotions.
 */

import { EvidenceMatch, RuleResult, VerificationContext } from "../types";
import { EvidenceValidator } from "../evidence/evidence-validator";
import { RiskCalculator } from "../risk/risk-calculator";

function formatDateOnly(d: string | Date | unknown): string {
  if (!d) return "";
  if (typeof d === "string") return d.split("T")[0];
  if (d instanceof Date) return d.toISOString().split("T")[0];
  return String(d).split("T")[0];
}

export function verifyDiscountClaim(context: VerificationContext): RuleResult {
  const { claim, product, promotions, effectiveDate, channel } = context;
  const targetChannel = channel || context.submission?.channel || "";

  if (!product) {
    return {
      ruleId: "discount_verification_v1",
      status: "needs_review",
      riskLevel: "medium",
      sufficiency: "insufficient",
      explanation: "Discount claim cannot be verified without associated product catalogue entry.",
      evidenceMatches: [],
    };
  }

  const activePromotions = promotions.filter(
    (p) =>
      p.product_id === product.id &&
      EvidenceValidator.isPromotionActive(p, effectiveDate) &&
      EvidenceValidator.isChannelApplicable(p, targetChannel)
  );

  const evidenceMatches: EvidenceMatch[] = [];

  // If claim mentions "Festival launch" or matches active promotion
  for (const promo of activePromotions) {
    const textLower = claim.claim_text.toLowerCase();
    const promoLower = promo.promotion_name.toLowerCase();

    const matchesName = textLower.includes("festival") && promoLower.includes("festival");
    const matchesValue =
      claim.extracted_entities &&
      (claim.extracted_entities.price === promo.resulting_price ||
        claim.extracted_entities.discount_amount === promo.discount_value);

    if (matchesName || matchesValue || textLower.includes(String(promo.resulting_price))) {
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Approved promotion "${promo.promotion_name}": ${promo.discount_type} discount of ₹${promo.discount_value}. Resulting price ₹${promo.resulting_price}. Channel: "${targetChannel}".`,
        relevanceScore: 0.98,
      });

      const status = "supported";
      return {
        ruleId: "discount_verification_v1",
        status,
        riskLevel: RiskCalculator.calculateRisk({ status, claimType: "discount", claimText: claim.claim_text }),
        sufficiency: "sufficient",
        explanation: `Discount assertion aligns with approved promotion "${promo.promotion_name}".`,
        evidenceMatches,
      };
    }
  }

  // Check expired promotions
  const expiredPromotions = promotions.filter((p) => {
    if (p.product_id !== product.id) return false;
    return effectiveDate.getTime() > new Date(p.end_date).getTime();
  });

  for (const promo of expiredPromotions) {
    if (claim.claim_text.toLowerCase().includes(promo.promotion_name.toLowerCase())) {
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Expired promotion "${promo.promotion_name}": Concluded on ${formatDateOnly(promo.end_date)}.`,
        relevanceScore: 0.85,
      });

      const status = "outdated";
      return {
        ruleId: "discount_verification_v1",
        status,
        riskLevel: "medium",
        sufficiency: "outdated",
        explanation: `Claim references promotion "${promo.promotion_name}", which expired on ${formatDateOnly(promo.end_date)}.`,
        evidenceMatches,
      };
    }
  }

  return {
    ruleId: "discount_verification_v1",
    status: "unverified",
    riskLevel: "medium",
    sufficiency: "insufficient",
    explanation: "No active promotion matches the asserted discount parameters.",
    evidenceMatches: [],
  };
}
