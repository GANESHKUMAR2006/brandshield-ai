/**
 * BrandShield AI — Deterministic Claim Offset Calculator & Normalizer
 * Phase 10D: Deterministic Claim Offset Correction
 *
 * Removes dependence on AI-generated character positions by deterministically
 * calculating and validating all UTF-16 character offsets against the original
 * source content.
 *
 * Enforces the core invariant:
 *   content.slice(text_start, text_end) === claim_text
 *
 * Invariants & Capabilities:
 * 1. Exact JavaScript UTF-16 string indexing (String.prototype.indexOf, String.prototype.slice).
 * 2. Full Unicode fidelity: seamlessly handles Indian Rupee (₹ U+20B9), currencies,
 *    and Supplementary Multilingual Plane (SMP) emojis with surrogate pairs (e.g. 🧴, ✨, 🌟).
 * 3. Never splits surrogate pairs: validates that indices align with UTF-16 code units.
 * 4. Disambiguation safety: flags repeated claim occurrences as "ambiguous" unless an exact
 *    1-to-1 sequential match count exists. Never arbitrarily assigns spans.
 * 5. Read-only safety: never modifies source content and never invents synthetic spans.
 * 6. Explicit flags: marks missing, ambiguous, or invalid claims with requiresManualReview = true.
 */

export type OffsetResolutionStatus =
  | "exact_match"       // Single unambiguous occurrence found and verified
  | "sequential_match"  // Exactly K occurrences matched K claims in document reading order
  | "ambiguous"         // Multiple occurrences exist in content without 1:1 attribution
  | "missing"           // Substring not found anywhere in source content
  | "empty_text"        // Claim text is empty or whitespace only
  | "invalid_input";    // Input content or parameters are invalid

export interface TextSpan {
  start: number;
  end: number;
}

export interface SingleOffsetResult {
  claim_text: string;
  status: OffsetResolutionStatus;
  isValid: boolean;
  text_start: number | null;
  text_end: number | null;
  occurrences: TextSpan[];
  occurrenceCount: number;
  reason?: string;
  requiresManualReview: boolean;
}

export interface BatchResolutionResult<T> {
  resolvedClaims: Array<T & { text_start: number; text_end: number; resolution_status: OffsetResolutionStatus }>;
  unresolvedClaims: Array<{
    claim: T;
    status: OffsetResolutionStatus;
    reason: string;
    occurrences: TextSpan[];
    requiresManualReview: true;
  }>;
  allResults: SingleOffsetResult[];
}

export class ClaimOffsetCalculator {
  /**
   * Searches for all exact verbatim occurrences of a substring within content.
   * Uses native String.prototype.indexOf, operating strictly on UTF-16 code units.
   */
  public static findExactOccurrences(content: string, substring: string): TextSpan[] {
    if (!content || !substring || substring.length === 0) {
      return [];
    }

    const occurrences: TextSpan[] = [];
    let searchIndex = 0;

    while (searchIndex < content.length) {
      const found = content.indexOf(substring, searchIndex);
      if (found === -1) break;

      const span: TextSpan = {
        start: found,
        end: found + substring.length,
      };

      // Invariant verification: content.slice(start, end) === substring
      if (content.slice(span.start, span.end) === substring) {
        occurrences.push(span);
      }

      // Advance by 1 to detect overlapping or contiguous occurrences
      searchIndex = found + 1;
    }

    return occurrences;
  }

  /**
   * Verifies that given offsets do not split a UTF-16 surrogate pair.
   * High surrogates: 0xD800 - 0xDBFF
   * Low surrogates:  0xDC00 - 0xDFFF
   */
  public static isSurrogateSafe(content: string, index: number): boolean {
    if (index <= 0 || index >= content.length) return true;
    const prevCode = content.charCodeAt(index - 1);
    const currCode = content.charCodeAt(index);
    const isPrevHigh = prevCode >= 0xd800 && prevCode <= 0xdbff;
    const isCurrLow = currCode >= 0xdc00 && currCode <= 0xdfff;
    // If index splits high and low surrogate, it is not safe
    return !(isPrevHigh && isCurrLow);
  }

  /**
   * Deterministically calculates UTF-16 character offsets for a single claim text.
   */
  public static calculateSingleOffset(
    content: string,
    claimText: string,
    options?: { occurrenceIndex?: number }
  ): SingleOffsetResult {
    // 1. Validate claimText parameter
    if (claimText === undefined || claimText === null || typeof claimText !== "string") {
      return {
        claim_text: "",
        status: "invalid_input",
        isValid: false,
        text_start: null,
        text_end: null,
        occurrences: [],
        occurrenceCount: 0,
        reason: "Claim text must be a valid non-null string",
        requiresManualReview: true,
      };
    }

    // 2. Validate empty or whitespace-only claimText
    if (claimText.trim().length === 0) {
      return {
        claim_text: claimText,
        status: "empty_text",
        isValid: false,
        text_start: null,
        text_end: null,
        occurrences: [],
        occurrenceCount: 0,
        reason: "Claim text cannot be empty or whitespace only",
        requiresManualReview: true,
      };
    }

    // 3. Validate content parameter
    if (typeof content !== "string" || content.length === 0) {
      return {
        claim_text: claimText,
        status: "invalid_input",
        isValid: false,
        text_start: null,
        text_end: null,
        occurrences: [],
        occurrenceCount: 0,
        reason: "Source content cannot be empty",
        requiresManualReview: true,
      };
    }

    // 4. Find all exact occurrences
    const occurrences = this.findExactOccurrences(content, claimText);

    // Case A: Missing claim text (never in content)
    if (occurrences.length === 0) {
      return {
        claim_text: claimText,
        status: "missing",
        isValid: false,
        text_start: null,
        text_end: null,
        occurrences: [],
        occurrenceCount: 0,
        reason: `Claim text "${claimText}" was not found in source content. Possible AI hallucination or modified phrasing.`,
        requiresManualReview: true,
      };
    }

    // Case B: Explicit occurrenceIndex requested
    if (options?.occurrenceIndex !== undefined) {
      const idx = options.occurrenceIndex;
      if (idx >= 0 && idx < occurrences.length) {
        const target = occurrences[idx];
        const slice = content.slice(target.start, target.end);
        if (slice === claimText && this.isSurrogateSafe(content, target.start) && this.isSurrogateSafe(content, target.end)) {
          return {
            claim_text: claimText,
            status: "exact_match",
            isValid: true,
            text_start: target.start,
            text_end: target.end,
            occurrences,
            occurrenceCount: occurrences.length,
            requiresManualReview: false,
          };
        }
      }
      return {
        claim_text: claimText,
        status: "ambiguous",
        isValid: false,
        text_start: null,
        text_end: null,
        occurrences,
        occurrenceCount: occurrences.length,
        reason: `Requested occurrence index ${idx} out of range (found ${occurrences.length} occurrences).`,
        requiresManualReview: true,
      };
    }

    // Case C: Single unambiguous exact match
    if (occurrences.length === 1) {
      const target = occurrences[0];
      const slice = content.slice(target.start, target.end);

      if (slice !== claimText) {
        return {
          claim_text: claimText,
          status: "invalid_input",
          isValid: false,
          text_start: null,
          text_end: null,
          occurrences,
          occurrenceCount: occurrences.length,
          reason: `Invariant violation: slice "${slice}" does not match claim text "${claimText}".`,
          requiresManualReview: true,
        };
      }

      if (!this.isSurrogateSafe(content, target.start) || !this.isSurrogateSafe(content, target.end)) {
        return {
          claim_text: claimText,
          status: "invalid_input",
          isValid: false,
          text_start: null,
          text_end: null,
          occurrences,
          occurrenceCount: occurrences.length,
          reason: "Span boundaries bisect a UTF-16 surrogate pair.",
          requiresManualReview: true,
        };
      }

      return {
        claim_text: claimText,
        status: "exact_match",
        isValid: true,
        text_start: target.start,
        text_end: target.end,
        occurrences,
        occurrenceCount: 1,
        requiresManualReview: false,
      };
    }

    // Case D: Multiple occurrences exist and no index specified -> AMBIGUOUS
    const spanList = occurrences.map((o) => `[${o.start}, ${o.end}]`).join(", ");
    return {
      claim_text: claimText,
      status: "ambiguous",
      isValid: false,
      text_start: null,
      text_end: null,
      occurrences,
      occurrenceCount: occurrences.length,
      reason: `Ambiguous match: claim text "${claimText}" occurs ${occurrences.length} times in content at indices ${spanList}. Cannot arbitrarily assign span without manual review.`,
      requiresManualReview: true,
    };
  }

  /**
   * Deterministically resolves and calculates offsets for a batch of extracted claims.
   *
   * Logic:
   * - Groups claims by exact verbatim claim_text.
   * - If a claim occurs exactly once in content: assigns exact_match.
   * - If K claims share the same text and the text occurs exactly K times:
   *   assigns sequential 1-to-1 matching in reading order (sequential_match).
   * - If occurrences > claims or claims > occurrences:
   *   flags as ambiguous / requires manual review. Never guesses or invents spans.
   */
  public static resolveBatch<T extends { claim_text: string }>(
    claims: T[],
    content: string
  ): BatchResolutionResult<T> {
    const resolvedClaims: Array<
      T & { text_start: number; text_end: number; resolution_status: OffsetResolutionStatus }
    > = [];
    const unresolvedClaims: Array<{
      claim: T;
      status: OffsetResolutionStatus;
      reason: string;
      occurrences: TextSpan[];
      requiresManualReview: true;
    }> = [];
    const allResults: SingleOffsetResult[] = [];

    if (!claims || claims.length === 0) {
      return { resolvedClaims, unresolvedClaims, allResults };
    }

    if (typeof content !== "string" || content.length === 0) {
      for (const claim of claims) {
        unresolvedClaims.push({
          claim,
          status: "invalid_input",
          reason: "Source content cannot be empty",
          occurrences: [],
          requiresManualReview: true,
        });
      }
      return { resolvedClaims, unresolvedClaims, allResults };
    }

    // Group claims by exact verbatim claim_text
    const groups = new Map<string, T[]>();
    for (const claim of claims) {
      const text = claim.claim_text;
      const list = groups.get(text) || [];
      list.push(claim);
      groups.set(text, list);
    }

    for (const [claimText, groupClaims] of groups.entries()) {
      // 1. Empty / Whitespace check
      if (!claimText || claimText.trim().length === 0) {
        for (const claim of groupClaims) {
          const res: SingleOffsetResult = {
            claim_text: claimText,
            status: "empty_text",
            isValid: false,
            text_start: null,
            text_end: null,
            occurrences: [],
            occurrenceCount: 0,
            reason: "Claim text cannot be empty or whitespace only",
            requiresManualReview: true,
          };
          allResults.push(res);
          unresolvedClaims.push({
            claim,
            status: "empty_text",
            reason: res.reason!,
            occurrences: [],
            requiresManualReview: true,
          });
        }
        continue;
      }

      // 2. Find exact occurrences in content
      const occurrences = this.findExactOccurrences(content, claimText);
      const claimCount = groupClaims.length;
      const occurrenceCount = occurrences.length;

      // 3. Case: Missing
      if (occurrenceCount === 0) {
        const reason = `Claim text "${claimText}" was not found in source content.`;
        for (const claim of groupClaims) {
          const res: SingleOffsetResult = {
            claim_text: claimText,
            status: "missing",
            isValid: false,
            text_start: null,
            text_end: null,
            occurrences: [],
            occurrenceCount: 0,
            reason,
            requiresManualReview: true,
          };
          allResults.push(res);
          unresolvedClaims.push({
            claim,
            status: "missing",
            reason,
            occurrences: [],
            requiresManualReview: true,
          });
        }
        continue;
      }

      // 4. Case: Single claim & Single occurrence (Exact Match)
      if (claimCount === 1 && occurrenceCount === 1) {
        const target = occurrences[0];
        // Verify invariant
        if (content.slice(target.start, target.end) === claimText) {
          const res: SingleOffsetResult = {
            claim_text: claimText,
            status: "exact_match",
            isValid: true,
            text_start: target.start,
            text_end: target.end,
            occurrences,
            occurrenceCount: 1,
            requiresManualReview: false,
          };
          allResults.push(res);
          resolvedClaims.push({
            ...groupClaims[0],
            text_start: target.start,
            text_end: target.end,
            resolution_status: "exact_match",
          });
        } else {
          const reason = `Invariant verification failed for "${claimText}" at [${target.start}, ${target.end}]`;
          unresolvedClaims.push({
            claim: groupClaims[0],
            status: "invalid_input",
            reason,
            occurrences,
            requiresManualReview: true,
          });
        }
        continue;
      }

      // 5. Case: Exactly K claims and K occurrences (Sequential 1-to-1 Match in reading order)
      if (claimCount === occurrenceCount && claimCount > 1) {
        for (let i = 0; i < claimCount; i++) {
          const target = occurrences[i];
          if (content.slice(target.start, target.end) === claimText) {
            const res: SingleOffsetResult = {
              claim_text: claimText,
              status: "sequential_match",
              isValid: true,
              text_start: target.start,
              text_end: target.end,
              occurrences,
              occurrenceCount,
              requiresManualReview: false,
            };
            allResults.push(res);
            resolvedClaims.push({
              ...groupClaims[i],
              text_start: target.start,
              text_end: target.end,
              resolution_status: "sequential_match",
            });
          } else {
            const reason = `Invariant verification failed for sequential claim "${claimText}" at [${target.start}, ${target.end}]`;
            unresolvedClaims.push({
              claim: groupClaims[i],
              status: "invalid_input",
              reason,
              occurrences,
              requiresManualReview: true,
            });
          }
        }
        continue;
      }

      // 6. Case: Ambiguous Count Mismatch (occurrences > claims or claims > occurrences)
      const spanList = occurrences.map((o) => `[${o.start}, ${o.end}]`).join(", ");
      const reason =
        occurrenceCount > claimCount
          ? `Ambiguous match: claim text "${claimText}" occurs ${occurrenceCount} times in content at indices ${spanList}, but only ${claimCount} claim(s) extracted. Cannot arbitrarily assign span without manual review.`
          : `Occurrence mismatch: claim text "${claimText}" occurs ${occurrenceCount} time(s) in content, but ${claimCount} claims were extracted.`;

      for (const claim of groupClaims) {
        const res: SingleOffsetResult = {
          claim_text: claimText,
          status: "ambiguous",
          isValid: false,
          text_start: null,
          text_end: null,
          occurrences,
          occurrenceCount,
          reason,
          requiresManualReview: true,
        };
        allResults.push(res);
        unresolvedClaims.push({
          claim,
          status: "ambiguous",
          reason,
          occurrences,
          requiresManualReview: true,
        });
      }
    }

    // Sort resolved claims by start offset ascending (document reading order)
    resolvedClaims.sort((a, b) => a.text_start - b.text_start);

    return {
      resolvedClaims,
      unresolvedClaims,
      allResults,
    };
  }

  /**
   * Directly tests the fundamental invariant:
   *   content.slice(start, end) === claim_text
   */
  public static verifySpanInvariant(
    content: string,
    start: number,
    end: number,
    claimText: string
  ): boolean {
    if (typeof content !== "string" || typeof claimText !== "string") return false;
    if (start < 0 || end > content.length || start >= end) return false;
    return content.slice(start, end) === claimText;
  }
}
