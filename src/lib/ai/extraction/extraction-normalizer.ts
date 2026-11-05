/**
 * BrandShield AI — Product Association & Entity Normalizer
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Deterministically associates extracted claims with workspace products using
 * exact SKU, name, and keyword matching. Does not use vector similarity or RAG.
 */

import { RawExtractedClaim } from "./extraction-schema";

export interface NormalizedProductCandidate {
  id: string;
  name: string;
  sku: string;
}

export interface NormalizationResult {
  productId: string | null;
  matchedBy: "sku" | "exact_name" | "fuzzy_token" | "submission_context" | "none";
  confidence: number;
}

export class ExtractionNormalizer {
  /**
   * Deterministically resolves product association for a given claim.
   */
  public static normalizeProduct(
    claim: RawExtractedClaim,
    knownProducts: NormalizedProductCandidate[],
    submissionProductId?: string | null
  ): NormalizationResult {
    if (!knownProducts || knownProducts.length === 0) {
      return { productId: null, matchedBy: "none", confidence: 0 };
    }

    const hint = (claim.product_hint || "").trim().toLowerCase();
    const text = claim.claim_text.toLowerCase();

    // 1. Check for explicit SKU match in hint or claim text
    for (const prod of knownProducts) {
      const skuLower = prod.sku.toLowerCase();
      if (hint === skuLower || text.includes(skuLower)) {
        return {
          productId: prod.id,
          matchedBy: "sku",
          confidence: 1.0,
        };
      }
    }

    // 2. Check for exact full product name match in hint or claim text
    for (const prod of knownProducts) {
      const nameLower = prod.name.toLowerCase();
      if (hint === nameLower || text.includes(nameLower)) {
        return {
          productId: prod.id,
          matchedBy: "exact_name",
          confidence: 0.95,
        };
      }
    }

    // 3. Significant token matching for prominent keywords (e.g. "Vitamin C Serum", "HydraDefense")
    const candidatesWithScore: Array<{ id: string; score: number }> = [];

    for (const prod of knownProducts) {
      const nameTokens = prod.name
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3 && t !== "dermaglow" && t !== "serum" && t !== "cream");

      if (nameTokens.length > 0) {
        let matchedTokens = 0;
        for (const token of nameTokens) {
          if (hint.includes(token) || text.includes(token)) {
            matchedTokens++;
          }
        }
        if (matchedTokens > 0) {
          candidatesWithScore.push({
            id: prod.id,
            score: matchedTokens / nameTokens.length,
          });
        }
      }
    }

    // If a single unambiguous candidate with high score exists
    if (candidatesWithScore.length === 1 && candidatesWithScore[0].score >= 0.5) {
      return {
        productId: candidatesWithScore[0].id,
        matchedBy: "fuzzy_token",
        confidence: 0.85,
      };
    }

    // 4. Fallback to submission's associated product if claim has no other conflicting hint
    if (submissionProductId && !hint) {
      const exists = knownProducts.some((p) => p.id === submissionProductId);
      if (exists) {
        return {
          productId: submissionProductId,
          matchedBy: "submission_context",
          confidence: 0.75,
        };
      }
    }

    // 5. Unambiguous product association cannot be established
    return {
      productId: null,
      matchedBy: "none",
      confidence: 0,
    };
  }
}
