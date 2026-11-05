/**
 * BrandShield AI — Promotion-Aware Price Verification Rule
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Verifies advertised price claims against approved catalogue reference MRP
 * and active time-bound, channel-filtered promotional price rules.
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

export function verifyPriceClaim(context: VerificationContext): RuleResult {
  const { claim, product, promotions, approvedFacts, effectiveDate, channel } = context;
  const targetChannel = channel || context.submission?.channel || "";

  // 1. Identify product association
  if (!product) {
    return {
      ruleId: "price_verification_v1",
      status: "needs_review",
      riskLevel: "medium",
      sufficiency: "insufficient",
      explanation: "Price claim cannot be verified because no specific catalogue product was reliably associated with the assertion.",
      evidenceMatches: [],
    };
  }

  // 2. Extract advertised price
  let advertisedPrice: number | null = null;
  if (claim.extracted_entities && typeof claim.extracted_entities.price === "number") {
    advertisedPrice = claim.extracted_entities.price;
  } else {
    // Regex fallback from claim text
    const match = claim.claim_text.match(/(?:₹|\$|€|INR\s*)(\d{1,3}(?:,\d{3})*|\d+)/i);
    if (match) {
      advertisedPrice = parseFloat(match[1].replace(/,/g, ""));
    }
  }

  if (advertisedPrice === null || isNaN(advertisedPrice)) {
    return {
      ruleId: "price_verification_v1",
      status: "needs_review",
      riskLevel: "medium",
      sufficiency: "insufficient",
      explanation: `Could not parse a deterministic numerical price from claim text: "${claim.claim_text}".`,
      evidenceMatches: [],
    };
  }

  // 3. Retrieve catalogue reference price
  const cataloguePriceFact = approvedFacts.find((f) => f.fact_key === "reference_price");
  let referencePrice = product.reference_price;
  let factId: string | null = null;

  if (cataloguePriceFact && EvidenceValidator.isFactValid(cataloguePriceFact, effectiveDate)) {
    factId = cataloguePriceFact.id;
    const mrp = (cataloguePriceFact.fact_value as Record<string, unknown>).mrp;
    if (typeof mrp === "number") {
      referencePrice = mrp;
    }
  }

  // 4. Retrieve applicable promotions
  const activePromotions = promotions.filter(
    (p) =>
      p.product_id === product.id &&
      EvidenceValidator.isPromotionActive(p, effectiveDate) &&
      EvidenceValidator.isChannelApplicable(p, targetChannel)
  );

  const evidenceMatches: EvidenceMatch[] = [];

  // Case A: Advertised price matches active promotion
  for (const promo of activePromotions) {
    let expectedPrice = promo.resulting_price;

    if (!expectedPrice) {
      if (promo.discount_type === "fixed") {
        expectedPrice = referencePrice - promo.discount_value;
      } else if (promo.discount_type === "percentage") {
        expectedPrice = referencePrice * (1 - promo.discount_value / 100);
      }
    }

    if (EvidenceValidator.arePricesEqual(advertisedPrice, expectedPrice)) {
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Active promotion "${promo.promotion_name}": Discount ${promo.discount_type} of ₹${promo.discount_value}. Resulting price ₹${expectedPrice.toFixed(2)} on channel "${targetChannel}". Valid ${formatDateOnly(promo.start_date)} to ${formatDateOnly(promo.end_date)}.`,
        relevanceScore: 0.99,
      });

      if (factId) {
        evidenceMatches.push({
          approvedFactId: factId,
          evidenceType: "catalog_price",
          evidenceExcerpt: `Catalogue MRP: ₹${referencePrice.toFixed(2)} (${product.sku}).`,
          relevanceScore: 0.95,
        });
      }

      const status = "supported";
      return {
        ruleId: "price_verification_v1",
        status,
        riskLevel: RiskCalculator.calculateRisk({ status, claimType: "price", claimText: claim.claim_text }),
        sufficiency: "sufficient",
        explanation: `Advertised price of ₹${advertisedPrice.toLocaleString()} matches active promotion "${promo.promotion_name}" (Regular MRP ₹${referencePrice.toLocaleString()}).`,
        evidenceMatches,
      };
    }
  }

  // Case B: Advertised price matches catalogue reference price
  if (EvidenceValidator.arePricesEqual(advertisedPrice, referencePrice)) {
    if (factId) {
      evidenceMatches.push({
        approvedFactId: factId,
        evidenceType: "catalog_price",
        evidenceExcerpt: `Catalogue MRP: ₹${referencePrice.toFixed(2)} (${product.name}, SKU: ${product.sku}). Approved and valid.`,
        relevanceScore: 1.0,
      });
    }

    const status = "supported";
    return {
      ruleId: "price_verification_v1",
      status,
      riskLevel: RiskCalculator.calculateRisk({ status, claimType: "price", claimText: claim.claim_text }),
      sufficiency: "sufficient",
      explanation: `Advertised price of ₹${advertisedPrice.toLocaleString()} directly matches approved catalogue reference price for ${product.name}.`,
      evidenceMatches,
    };
  }

  // Case C: Check if price matches an EXPIRED promotion (Outdated)
  const expiredPromotions = promotions.filter((p) => {
    if (p.product_id !== product.id) return false;
    const end = new Date(p.end_date).getTime();
    return effectiveDate.getTime() > end;
  });

  for (const promo of expiredPromotions) {
    if (EvidenceValidator.arePricesEqual(advertisedPrice, promo.resulting_price)) {
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Expired promotion "${promo.promotion_name}": Valid through ${formatDateOnly(promo.end_date)}, which ended prior to submission date ${formatDateOnly(effectiveDate)}.`,
        relevanceScore: 0.85,
      });

      const status = "outdated";
      return {
        ruleId: "price_verification_v1",
        status,
        riskLevel: RiskCalculator.calculateRisk({ status, claimType: "price", claimText: claim.claim_text }),
        sufficiency: "outdated",
        explanation: `Advertised price of ₹${advertisedPrice.toLocaleString()} corresponds to promotion "${promo.promotion_name}", but the offer expired on ${formatDateOnly(promo.end_date)}.`,
        suggestedCorrection: activePromotions.length > 0
          ? `Festival launch price of ₹${activePromotions[0].resulting_price.toLocaleString()} (Regular MRP ₹${referencePrice.toLocaleString()})`
          : `Regular MRP ₹${referencePrice.toLocaleString()}`,
        evidenceMatches,
      };
    }
  }

  // Case D: Check if price is valid on another channel but NOT the submission's channel
  const wrongChannelPromotions = promotions.filter(
    (p) =>
      p.product_id === product.id &&
      EvidenceValidator.isPromotionActive(p, effectiveDate) &&
      !EvidenceValidator.isChannelApplicable(p, targetChannel)
  );

  for (const promo of wrongChannelPromotions) {
    if (EvidenceValidator.arePricesEqual(advertisedPrice, promo.resulting_price)) {
      const status = "contradicted";
      evidenceMatches.push({
        promotionId: promo.id,
        evidenceType: "promotional_rule",
        evidenceExcerpt: `Promotion "${promo.promotion_name}" is strictly restricted to channels: ${JSON.stringify(promo.applicable_channels)}. Not valid on "${targetChannel}".`,
        relevanceScore: 0.9,
      });
      return {
        ruleId: "price_verification_v1",
        status,
        riskLevel: "high",
        sufficiency: "sufficient",
        explanation: `Advertised price of ₹${advertisedPrice.toLocaleString()} is not authorized for channel "${targetChannel}". Promotion "${promo.promotion_name}" is restricted to ${JSON.stringify(promo.applicable_channels)}.`,
        suggestedCorrection: `Regular MRP ₹${referencePrice.toLocaleString()}`,
        evidenceMatches,
      };
    }
  }

  // Case E: Direct contradiction (price unsupported by catalogue or any active promotion)
  if (factId) {
    evidenceMatches.push({
      approvedFactId: factId,
      evidenceType: "catalog_price",
      evidenceExcerpt: `Catalogue MRP: ₹${referencePrice.toFixed(2)} (${product.name}, SKU: ${product.sku}).`,
      relevanceScore: 1.0,
    });
  }

  const suggested = activePromotions.length > 0
    ? `Festival launch price of ₹${activePromotions[0].resulting_price.toLocaleString()} (Regular MRP ₹${referencePrice.toLocaleString()})`
    : `Regular MRP ₹${referencePrice.toLocaleString()}`;

  const status = "contradicted";
  return {
    ruleId: "price_verification_v1",
    status,
    riskLevel: RiskCalculator.calculateRisk({ status, claimType: "price", claimText: claim.claim_text }),
    sufficiency: "sufficient",
    explanation: `Advertised price of ₹${advertisedPrice.toLocaleString()} contradicts approved catalogue pricing (MRP ₹${referencePrice.toLocaleString()})${
      activePromotions.length > 0
        ? ` and active promotional pricing (₹${activePromotions[0].resulting_price.toLocaleString()})`
        : ""
    }. ₹${advertisedPrice.toLocaleString()} is an unsubstantiated price point.`,
    suggestedCorrection: suggested,
    evidenceMatches,
  };
}
