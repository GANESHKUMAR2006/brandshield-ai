/**
 * BrandShield AI — Claim Validator & Substring Offset Verifier
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 * Phase 10D: Deterministic Claim Offset Correction
 *
 * Implements strict Zod validation, JavaScript UTF-16 offset verification,
 * substring equality guarantees, deterministic offset correction, and overlapping span resolution.
 */

import {
  ModelClaimOutput,
  ModelClaimOutputSchema,
  ModelExtractionResponseSchema,
  RawExtractedClaim,
  RawExtractedClaimSchema,
} from "../extraction/extraction-schema";
import {
  ClaimOffsetCalculator,
  OffsetResolutionStatus,
  TextSpan,
} from "../extraction/claim-offset-calculator";

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
    resolution_status?: OffsetResolutionStatus;
    occurrences?: TextSpan[];
  }>;
  validationErrors: string[];
}

export interface ValidationOptions {
  /**
   * When true (default), deterministically calculates and verifies UTF-16 character offsets
   * against the original content instead of relying on model-generated character arithmetic.
   * Disambiguates repeated claims and flags ambiguous or missing matches for manual review.
   */
  autoCorrectOffsets?: boolean;
}

export class ClaimValidator {
  // Direct access to deterministic offset calculation utilities
  public static readonly calculateDeterministicOffset = ClaimOffsetCalculator.calculateSingleOffset.bind(ClaimOffsetCalculator);
  public static readonly resolveClaimOffsets = ClaimOffsetCalculator.resolveBatch.bind(ClaimOffsetCalculator);

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
   * 2. Deterministic offset resolution (calculating & verifying UTF-16 string indices)
   * 3. Substring & offset verification against original content
   * 4. Overlap and duplicate resolution
   */
  public static validateExtraction(
    rawInput: unknown,
    originalContent: string,
    options?: ValidationOptions
  ): ValidationReport {
    const report: ValidationReport = {
      success: true,
      validatedClaims: [],
      rejectedClaims: [],
      validationErrors: [],
    };

    const autoCorrect = options?.autoCorrectOffsets !== false;

    // 1. Parse Input with Zod Schemas
    const rawCandidates: ModelClaimOutput[] = [];

    let claimsArray: unknown[] | null = null;
    if (Array.isArray(rawInput)) {
      claimsArray = rawInput;
    } else if (rawInput && typeof rawInput === "object" && "claims" in rawInput && Array.isArray((rawInput as Record<string, unknown>).claims)) {
      claimsArray = (rawInput as { claims: unknown[] }).claims;
    }

    if (claimsArray !== null) {
      for (let i = 0; i < claimsArray.length; i++) {
        const itemResult = ModelClaimOutputSchema.safeParse(claimsArray[i]);
        if (itemResult.success) {
          rawCandidates.push(itemResult.data);
        } else {
          report.rejectedClaims.push({
            claim: claimsArray[i],
            reason: `Zod validation error at index ${i}: ${itemResult.error.issues.map((iss) => iss.message).join(", ")}`,
          });
          report.validationErrors.push(`Index ${i}: Invalid schema: ${itemResult.error.issues.map((iss) => iss.message).join(", ")}`);
        }
      }
    } else {
      const modelEnvelopeResult = ModelExtractionResponseSchema.safeParse(rawInput);
      report.success = false;
      report.validationErrors.push(
        `Payload does not conform to ExtractionResponseSchema: ${modelEnvelopeResult.error?.issues.map((iss) => iss.message).join(", ") || "Expected array or { claims: [...] } envelope."}`
      );
      return report;
    }

    // If no auto-correction requested (strict legacy check)
    if (!autoCorrect) {
      const parsedClaims: RawExtractedClaim[] = [];
      for (let i = 0; i < rawCandidates.length; i++) {
        const strictCheck = RawExtractedClaimSchema.safeParse(rawCandidates[i]);
        if (strictCheck.success) {
          parsedClaims.push(strictCheck.data);
        } else {
          report.rejectedClaims.push({
            claim: rawCandidates[i],
            reason: `Legacy offset validation failure at index ${i}: missing or invalid text_start/text_end.`,
          });
          report.validationErrors.push(`Index ${i}: Missing valid offsets in legacy mode`);
        }
      }

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
          report.validationErrors.push(`Claim "${claim.claim_text}": ${spanCheck.reason}`);
        }
      }

      report.validatedClaims = this.resolveOverlappingSpans(verifiedClaims);
      if (report.rejectedClaims.length > 0 && report.validatedClaims.length === 0 && parsedClaims.length > 0) {
        report.success = false;
      }
      return report;
    }

    // 2. Deterministic Offset Resolution
    const batchResult = ClaimOffsetCalculator.resolveBatch(rawCandidates, originalContent);

    // Record any unresolvable claims (missing text, ambiguous occurrences, empty text)
    for (const unresolved of batchResult.unresolvedClaims) {
      report.rejectedClaims.push({
        claim: unresolved.claim,
        reason: unresolved.reason,
        resolution_status: unresolved.status,
        occurrences: unresolved.occurrences,
      });
      report.validationErrors.push(
        `Claim "${unresolved.claim.claim_text}": ${unresolved.reason}`
      );
    }

    // 3. Strict verification of resolved claims against RawExtractedClaimSchema & verifySpan
    const verifiedClaims: RawExtractedClaim[] = [];

    for (const claim of batchResult.resolvedClaims) {
      const claimToValidate = {
        ...claim,
        entities: claim.entities || {},
        extraction_confidence: typeof claim.extraction_confidence === "number" ? claim.extraction_confidence : 0.95,
      };
      const strictParse = RawExtractedClaimSchema.safeParse(claimToValidate);
      if (!strictParse.success) {
        report.rejectedClaims.push({
          claim,
          reason: `Resolved claim failed strict RawExtractedClaimSchema: ${strictParse.error.issues.map((iss) => iss.message).join(", ")}`,
        });
        report.validationErrors.push(`Claim "${claim.claim_text}": Invalid schema after resolution`);
        continue;
      }

      const spanCheck = this.verifySpan(strictParse.data, originalContent);
      if (spanCheck.isValid) {
        verifiedClaims.push(strictParse.data);
      } else {
        report.rejectedClaims.push({
          claim: strictParse.data,
          reason: spanCheck.reason || "Span invariant verification failed",
        });
        report.validationErrors.push(`Claim "${claim.claim_text}": ${spanCheck.reason}`);
      }
    }

    // 4. Overlap and duplicate resolution
    report.validatedClaims = this.resolveOverlappingSpans(verifiedClaims);

    // 5. Final report success derivation
    if (report.rejectedClaims.length > 0 && report.validatedClaims.length === 0 && rawCandidates.length > 0) {
      report.success = false;
    }

    return report;
  }
}
