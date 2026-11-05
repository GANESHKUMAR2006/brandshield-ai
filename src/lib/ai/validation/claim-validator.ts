/**
 * BrandShield AI — Claim Validator & Substring Offset Verifier
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Implements strict Zod validation, JavaScript UTF-16 offset verification,
 * substring equality guarantees, and overlapping span resolution.
 */

import {
  ExtractionResponseSchema,
  RawExtractedClaim,
  RawExtractedClaimSchema,
} from "../extraction/extraction-schema";

export interface SpanValidationResult {
  isValid: boolean;
  reason?: string;
  actualSlice?: string;
}

export interface ValidationReport {
  success: boolean;
  validatedClaims: RawExtractedClaim[];
  rejectedClaims: Array<{
    claim: unknown;
    reason: string;
  }>;
  validationErrors: string[];
}

export class ClaimValidator {
  /**
   * Verifies that the claim's text_start and text_end indices
   * strictly correspond to the verbatim claim_text in originalContent.
   *
   * Convention: JavaScript UTF-16 zero-based character indices.
   * Invariant: originalContent.slice(text_start, text_end) === claim_text
   */
  public static verifySpan(
    claim: RawExtractedClaim,
    originalContent: string
  ): SpanValidationResult {
    // 1. Boundary bounds checks
    if (claim.text_start < 0) {
      return {
        isValid: false,
        reason: `text_start (${claim.text_start}) cannot be negative`,
      };
    }
    if (claim.text_end > originalContent.length) {
      return {
        isValid: false,
        reason: `text_end (${claim.text_end}) exceeds original content length (${originalContent.length})`,
      };
    }
    if (claim.text_start >= claim.text_end) {
      return {
        isValid: false,
        reason: `text_start (${claim.text_start}) must be strictly less than text_end (${claim.text_end})`,
      };
    }

    // 2. Exact substring slice equality
    const actualSlice = originalContent.slice(claim.text_start, claim.text_end);
    if (actualSlice !== claim.claim_text) {
      const existsInText = originalContent.includes(claim.claim_text);
      return {
        isValid: false,
        actualSlice,
        reason: existsInText
          ? `Offset mismatch: content.slice(${claim.text_start}, ${claim.text_end}) is "${actualSlice}", but claim_text is "${claim.claim_text}"`
          : `Fabrication detected: claim_text "${claim.claim_text}" does not exist anywhere in original content`,
      };
    }

    return { isValid: true, actualSlice };
  }

  /**
   * Resolves duplicate and overlapping spans.
   *
   * Rules:
   * 1. Exact identical spans: retain the claim with higher extraction_confidence.
   * 2. Identical claim_text and claim_type: deduplicate, keeping highest confidence.
   * 3. Distinct claims with overlapping or adjacent text: preserve both if their claim_type
   *    or asserted entity differs (e.g. product attribute vs price in same sentence).
   */
  public static resolveOverlappingSpans(
    claims: RawExtractedClaim[]
  ): RawExtractedClaim[] {
    if (claims.length <= 1) return claims;

    const kept: RawExtractedClaim[] = [];

    // Sort by text_start ascending, then by confidence descending
    const sorted = [...claims].sort((a, b) => {
      if (a.text_start !== b.text_start) return a.text_start - b.text_start;
      if (a.text_end !== b.text_end) return a.text_end - b.text_end;
      return b.extraction_confidence - a.extraction_confidence;
    });

    for (const candidate of sorted) {
      // Check against already kept claims
      const duplicateIndex = kept.findIndex(
        (existing) =>
          // Case 1: Identical span
          (existing.text_start === candidate.text_start &&
            existing.text_end === candidate.text_end) ||
          // Case 2: Identical text and type
          (existing.claim_text === candidate.claim_text &&
            existing.claim_type === candidate.claim_type)
      );

      if (duplicateIndex >= 0) {
        // Keep the one with higher confidence
        if (candidate.extraction_confidence > kept[duplicateIndex].extraction_confidence) {
          kept[duplicateIndex] = candidate;
        }
      } else {
        kept.push(candidate);
      }
    }

    // Return sorted in original text order
    return kept.sort((a, b) => a.text_start - b.text_start);
  }

  /**
   * Full validation pipeline:
   * 1. Zod schema validation
   * 2. Substring & offset verification against original content
   * 3. Overlap and duplicate resolution
   */
  public static validateExtraction(
    rawInput: unknown,
    originalContent: string
  ): ValidationReport {
    const report: ValidationReport = {
      success: true,
      validatedClaims: [],
      rejectedClaims: [],
      validationErrors: [],
    };

    // 1. Zod Schema Validation
    let parsedClaims: RawExtractedClaim[] = [];

    // Support both { claims: [...] } envelope and direct array
    const envelopeResult = ExtractionResponseSchema.safeParse(rawInput);
    if (envelopeResult.success) {
      parsedClaims = envelopeResult.data.claims;
    } else {
      // Try array directly
      if (Array.isArray(rawInput)) {
        for (let i = 0; i < rawInput.length; i++) {
          const itemResult = RawExtractedClaimSchema.safeParse(rawInput[i]);
          if (itemResult.success) {
            parsedClaims.push(itemResult.data);
          } else {
            report.rejectedClaims.push({
              claim: rawInput[i],
              reason: `Zod validation error at index ${i}: ${itemResult.error.issues.map((iss) => iss.message).join(", ")}`,
            });
            report.validationErrors.push(`Index ${i}: Invalid schema`);
          }
        }
      } else {
        report.success = false;
        report.validationErrors.push(
          `Payload does not conform to ExtractionResponseSchema: ${envelopeResult.error.issues.map((iss) => iss.message).join(", ")}`
        );
        return report;
      }
    }

    // 2. Substring and Offset Verification
    const verifiedClaims: RawExtractedClaim[] = [];

    for (const claim of parsedClaims) {
      const spanCheck = this.verifySpan(claim, originalContent);
      if (spanCheck.isValid) {
        verifiedClaims.push(claim);
      } else {
        report.rejectedClaims.push({
          claim,
          reason: spanCheck.reason || "Invalid span offset or substring mismatch",
        });
        report.validationErrors.push(
          `Claim "${claim.claim_text}": ${spanCheck.reason}`
        );
      }
    }

    // 3. Overlap and duplicate resolution
    report.validatedClaims = this.resolveOverlappingSpans(verifiedClaims);

    // If there were items rejected, report status reflects it but validated claims remain usable
    if (report.rejectedClaims.length > 0 && report.validatedClaims.length === 0 && parsedClaims.length > 0) {
      report.success = false;
    }

    return report;
  }
}
