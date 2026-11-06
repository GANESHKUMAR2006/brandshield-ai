/**
 * BrandShield AI — Strict Dataset Validation Engine
 * Phase 10A: Standalone Dataset Builder
 *
 * Enforces Zod schema compliance, JavaScript UTF-16 exact character slicing,
 * entity-to-claim alignment, and strict failure on offset drift or fabrication.
 *
 * CRITICAL RULE: Never silently repair ambiguous offsets.
 */

import {
  CLAIM_TYPES,
  ClaimType,
  RawExtractedClaim,
  RawExtractedClaimSchema,
} from "../../src/lib/ai/extraction/extraction-schema";
import { ClaimValidator } from "../../src/lib/ai/validation/claim-validator";

export interface CandidateValidationResult {
  isValid: boolean;
  errors: string[];
  validatedClaims: RawExtractedClaim[];
}

export class DatasetValidator {
  /**
   * Validates an entire example candidate: its raw content and its associated claims.
   */
  public static validateCandidate(
    content: string,
    rawClaims: unknown[]
  ): CandidateValidationResult {
    const errors: string[] = [];

    // 1. Content check
    if (typeof content !== "string" || content.trim().length === 0) {
      return {
        isValid: false,
        errors: ["Marketing content cannot be empty"],
        validatedClaims: [],
      };
    }

    // 2. Zero-claim validation (hard negatives or pure lifestyle rhetoric)
    if (!rawClaims || rawClaims.length === 0) {
      return {
        isValid: true,
        errors: [],
        validatedClaims: [],
      };
    }

    const parsedClaims: RawExtractedClaim[] = [];

    // 3. Schema & Offset Validation for each claim
    for (let i = 0; i < rawClaims.length; i++) {
      const candidateClaim = rawClaims[i];

      // A. Schema parse
      const parseResult = RawExtractedClaimSchema.safeParse(candidateClaim);
      if (!parseResult.success) {
        errors.push(
          `Claim [${i}] schema validation failed: ${parseResult.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
        continue;
      }

      const claim = parseResult.data;

      // B. Claim Type check
      if (!CLAIM_TYPES.includes(claim.claim_type as ClaimType)) {
        errors.push(`Claim [${i}] has unrecognized claim_type "${claim.claim_type}"`);
        continue;
      }

      // C. UTF-16 Boundary and Invariant Check
      // Convention: JavaScript UTF-16 zero-based character indices.
      // Invariant: content.slice(claim.text_start, claim.text_end) === claim.claim_text
      const spanResult = ClaimValidator.verifySpan(claim, content);
      if (!spanResult.isValid) {
        errors.push(`Claim [${i}] span verification failed: ${spanResult.reason}`);
        continue;
      }

      // D. Entity Verification against claim_text
      const entityErrors = this.validateEntitiesAgainstClaimText(claim);
      if (entityErrors.length > 0) {
        errors.push(
          `Claim [${i}] ("${claim.claim_text}") entity mismatch: ${entityErrors.join(", ")}`
        );
        continue;
      }

      parsedClaims.push(claim);
    }

    // If any claim failed validation, reject the entire example (strict rejection policy)
    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        validatedClaims: [],
      };
    }

    // 4. Overlap & Duplicate check
    const resolvedClaims = ClaimValidator.resolveOverlappingSpans(parsedClaims);
    if (resolvedClaims.length !== parsedClaims.length) {
      // If there were unresolvable conflicting duplicate spans
      errors.push(
        `Duplicate or conflicting overlapping spans detected (${parsedClaims.length} candidates reduced to ${resolvedClaims.length})`
      );
      return {
        isValid: false,
        errors,
        validatedClaims: [],
      };
    }

    return {
      isValid: true,
      errors: [],
      validatedClaims: resolvedClaims,
    };
  }

  /**
   * Verifies that extracted entity values actually exist in verbatim claim_text.
   */
  private static validateEntitiesAgainstClaimText(
    claim: RawExtractedClaim
  ): string[] {
    const errs: string[] = [];
    const text = claim.claim_text.toLowerCase();
    const entities = claim.entities || {};

    // Price verification
    if (entities.price !== undefined && entities.price !== null) {
      const priceStr = String(entities.price);
      const formattedWithCommas = Number(entities.price).toLocaleString("en-IN");
      if (!text.includes(priceStr) && !text.includes(formattedWithCommas)) {
        errs.push(`price ${entities.price} not found in claim text`);
      }
    }

    // Discount percentage
    if (
      entities.discount_percentage !== undefined &&
      entities.discount_percentage !== null
    ) {
      const discStr = String(entities.discount_percentage);
      if (!text.includes(discStr)) {
        errs.push(`discount_percentage ${entities.discount_percentage} not found in claim text`);
      }
    }

    // Discount amount
    if (
      entities.discount_amount !== undefined &&
      entities.discount_amount !== null
    ) {
      const discAmtStr = String(entities.discount_amount);
      const formatted = Number(entities.discount_amount).toLocaleString("en-IN");
      if (!text.includes(discAmtStr) && !text.includes(formatted)) {
        errs.push(`discount_amount ${entities.discount_amount} not found in claim text`);
      }
    }

    // Concentration
    if (entities.concentration !== undefined && entities.concentration !== null) {
      const concStr = String(entities.concentration).toLowerCase().replace("%", "");
      if (!text.includes(concStr)) {
        errs.push(`concentration ${entities.concentration} not found in claim text`);
      }
    }

    // Ingredient
    if (entities.ingredient && typeof entities.ingredient === "string") {
      const ingrLower = entities.ingredient.toLowerCase();
      // Allow minor ingredient variations (e.g. "vitamin c" vs "c")
      const words = ingrLower.split(/\s+/).filter((w) => w.length > 2);
      const hasWord = words.length > 0 && words.some((w) => text.includes(w));
      if (!text.includes(ingrLower) && !hasWord) {
        errs.push(`ingredient "${entities.ingredient}" not found in claim text`);
      }
    }

    // Timeline
    if (entities.timeline && typeof entities.timeline === "string") {
      const timelineLower = entities.timeline.toLowerCase();
      const words = timelineLower.split(/\s+/).filter((w) => w.length > 2);
      const hasWord = words.length > 0 && words.some((w) => text.includes(w));
      if (!text.includes(timelineLower) && !hasWord) {
        errs.push(`timeline "${entities.timeline}" not found in claim text`);
      }
    }

    return errs;
  }
}

