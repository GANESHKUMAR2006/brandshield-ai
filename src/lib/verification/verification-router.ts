/**
 * BrandShield AI — Verification Router
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Routes extracted claims to their category-specific deterministic verification rules.
 */

import { RuleResult, VerificationContext } from "./types";
import { verifyPriceClaim } from "./rules/price-verification";
import { verifyDiscountClaim } from "./rules/discount-verification";
import { verifyProductAttributeClaim } from "./rules/product-attribute-verification";
import { verifyEfficacyClaim } from "./rules/efficacy-verification";
import { verifyGuaranteeClaim } from "./rules/guarantee-verification";
import { verifyComparativeClaim } from "./rules/comparative-verification";
import { verifyAvailabilityClaim } from "./rules/availability-verification";
import { verifyPromotionalClaim } from "./rules/promotional-verification";

export class VerificationRouter {
  public static routeClaim(context: VerificationContext): RuleResult {
    const claimType = context.claim.claim_type;

    switch (claimType) {
      case "price":
        return verifyPriceClaim(context);

      case "discount":
        return verifyDiscountClaim(context);

      case "product_attribute":
      case "ingredient":
        return verifyProductAttributeClaim(context);

      case "efficacy":
      case "clinical":
        return verifyEfficacyClaim(context);

      case "guarantee":
        return verifyGuaranteeClaim(context);

      case "comparative":
        return verifyComparativeClaim(context);

      case "availability":
        return verifyAvailabilityClaim(context);

      case "promotional":
        return verifyPromotionalClaim(context);

      case "other":
      default: {
        // Check if it appears to be a pricing assertion
        if (context.claim.claim_text.includes("₹") || context.claim.claim_text.includes("price")) {
          return verifyPriceClaim(context);
        }
        // Fallback to product attribute specification
        return verifyProductAttributeClaim(context);
      }
    }
  }
}
