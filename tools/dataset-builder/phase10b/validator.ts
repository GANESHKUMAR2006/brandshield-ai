/**
 * BrandShield AI — Phase 10B Evaluation Dataset Validator & Integrity Engine
 * Standalone Quality Measurement & Human Review Annotation Engine
 *
 * Enforces:
 * 1. Exact JavaScript UTF-16 substring slicing (content.slice(start, end) === claim_text)
 * 2. Strict rejection of drifted offsets (never silently repairs)
 * 3. Review state integrity: unreviewed records cannot carry reviewer names or timestamps
 * 4. Cross-dataset deduplication against Phase 10A (read-only inspection)
 * 5. Intra-dataset duplicate prevention
 */

import * as fs from "fs";
import * as path from "path";
import { EvaluationExample, EvaluationClaim, HumanReviewStatus } from "./types";
import { CLAIM_TYPES, ClaimType } from "../../../src/lib/ai/extraction/extraction-schema";

export interface EvaluationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalExamples: number;
  totalClaims: number;
  unreviewedCount: number;
  humanReviewedApprovedCount: number;
  humanReviewedModifiedCount: number;
  aiAuditedApprovedCount: number;
  aiAuditedModifiedCount: number;
  needsHumanAdjudicationCount: number;
  rejectedCount: number;
  statusBreakdown: Record<HumanReviewStatus, number>;
}

export interface CrossSplitAuditResult {
  isClean: boolean;
  exactDuplicatesWith10aTrain: number;
  exactDuplicatesWith10aVal: number;
  exactDuplicatesWith10aTest: number;
  intra10bDuplicates: number;
  maxJaccardWithPhase10a: number;
  highestOverlapDetails?: {
    exampleId: string;
    phase10aSplit: string;
    similarity: number;
  };
}

export class Phase10BValidator {
  /**
   * Validates a single evaluation example and all its constituent claims.
   */
  public static validateExample(example: EvaluationExample): string[] {
    const errors: string[] = [];
    const content = example.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      errors.push(`${example.example_id}: Content cannot be empty.`);
      return errors;
    }

    // 1. Review status integrity
    const review = example.human_annotation;
    if (review.review_status === "unreviewed") {
      if (review.reviewer_name !== null) {
        errors.push(`${example.example_id}: Unreviewed record cannot have reviewer_name populated.`);
      }
      if (review.reviewed_at !== null) {
        errors.push(`${example.example_id}: Unreviewed record cannot have reviewed_at populated.`);
      }
    } else {
      if (!review.reviewer_name || review.reviewer_name.trim().length === 0) {
        errors.push(`${example.example_id}: Reviewed record must have an identified reviewer_name.`);
      }
      if (!review.reviewed_at || isNaN(Date.parse(review.reviewed_at))) {
        errors.push(`${example.example_id}: Reviewed record must have a valid ISO reviewed_at timestamp.`);
      }
    }

    // 2. Validate constituent claims
    for (let i = 0; i < example.claims.length; i++) {
      const claim = example.claims[i];
      const claimErrors = this.validateClaim(claim, content, example.example_id, i);
      errors.push(...claimErrors);
    }

    return errors;
  }

  /**
   * Validates a single claim against original content.
   */
  public static validateClaim(
    claim: EvaluationClaim,
    content: string,
    exampleId: string,
    index: number
  ): string[] {
    const errs: string[] = [];

    // Bounds check
    if (claim.text_start < 0) {
      errs.push(`${exampleId} [Claim ${index}]: text_start (${claim.text_start}) cannot be negative.`);
    }
    if (claim.text_end > content.length) {
      errs.push(`${exampleId} [Claim ${index}]: text_end (${claim.text_end}) exceeds content length (${content.length}).`);
    }
    if (claim.text_start >= claim.text_end) {
      errs.push(`${exampleId} [Claim ${index}]: text_start must be strictly less than text_end.`);
    }

    // UTF-16 Exact Slicing Invariant
    const actualSlice = content.slice(claim.text_start, claim.text_end);
    if (actualSlice !== claim.claim_text) {
      errs.push(
        `${exampleId} [Claim ${index}]: Offset mismatch! Expected "${claim.claim_text}", but content.slice(${claim.text_start}, ${claim.text_end}) produced "${actualSlice}".`
      );
    }

    // Category check
    if (!CLAIM_TYPES.includes(claim.claim_type as ClaimType)) {
      errs.push(`${exampleId} [Claim ${index}]: Unrecognized claim_type "${claim.claim_type}".`);
    }

    // Entity alignment check
    const textLower = claim.claim_text.toLowerCase();
    const ent = claim.entities || {};
    if (ent.price !== undefined && ent.price !== null) {
      const priceStr = String(ent.price);
      const formatted = Number(ent.price).toLocaleString("en-IN");
      if (!textLower.includes(priceStr) && !textLower.includes(formatted)) {
        errs.push(`${exampleId} [Claim ${index}]: Entity price ${ent.price} not found in claim text "${claim.claim_text}".`);
      }
    }
    if (ent.discount_percentage !== undefined && ent.discount_percentage !== null) {
      if (!textLower.includes(String(ent.discount_percentage))) {
        errs.push(`${exampleId} [Claim ${index}]: Discount percentage ${ent.discount_percentage} not found in claim text.`);
      }
    }
    if (ent.discount_amount !== undefined && ent.discount_amount !== null) {
      const discStr = String(ent.discount_amount);
      const formatted = Number(ent.discount_amount).toLocaleString("en-IN");
      if (!textLower.includes(discStr) && !textLower.includes(formatted)) {
        errs.push(`${exampleId} [Claim ${index}]: Discount amount ${ent.discount_amount} not found in claim text.`);
      }
    }

    return errs;
  }

  /**
   * Validates an entire collection of evaluation examples.
   */
  public static validateCollection(examples: EvaluationExample[]): EvaluationValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let totalClaims = 0;

    const statusBreakdown: Record<HumanReviewStatus, number> = {
      unreviewed: 0,
      reviewed_approved: 0,
      reviewed_modified: 0,
      rejected: 0,
      ai_audited_approved: 0,
      ai_audited_modified: 0,
      needs_human_adjudication: 0,
      human_verified: 0,
      human_modified: 0,
    };

    for (const ex of examples) {
      const errs = this.validateExample(ex);
      allErrors.push(...errs);

      totalClaims += ex.claims.length;

      const st = ex.human_annotation.review_status;
      if (st in statusBreakdown) {
        statusBreakdown[st]++;
      } else {
        allErrors.push(`${ex.example_id}: Unknown review_status "${st}"`);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      totalExamples: examples.length,
      totalClaims,
      unreviewedCount: statusBreakdown.unreviewed,
      humanReviewedApprovedCount: statusBreakdown.reviewed_approved + statusBreakdown.human_verified,
      humanReviewedModifiedCount: statusBreakdown.reviewed_modified + statusBreakdown.human_modified,
      aiAuditedApprovedCount: statusBreakdown.ai_audited_approved,
      aiAuditedModifiedCount: statusBreakdown.ai_audited_modified,
      needsHumanAdjudicationCount: statusBreakdown.needs_human_adjudication,
      rejectedCount: statusBreakdown.rejected,
      statusBreakdown,
    };
  }

  /**
   * Performs read-only cross-split leakage and duplicate audit against Phase 10A outputs.
   */
  public static auditCrossSplitLeakage(
    examples: EvaluationExample[],
    phase10aOutputDir: string
  ): CrossSplitAuditResult {
    const loadPhase10aContent = (fileName: string): string[] => {
      const filePath = path.join(phase10aOutputDir, fileName);
      if (!fs.existsSync(filePath)) return [];
      const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
      return lines.filter(Boolean).map((l) => JSON.parse(l).content);
    };

    const trainContents = new Set(loadPhase10aContent("train.jsonl"));
    const valContents = new Set(loadPhase10aContent("validation.jsonl"));
    const testContents = new Set(loadPhase10aContent("test.jsonl"));

    let exactDuplicatesWith10aTrain = 0;
    let exactDuplicatesWith10aVal = 0;
    let exactDuplicatesWith10aTest = 0;

    // Intra-dataset duplicate check
    const seen10b = new Set<string>();
    let intra10bDuplicates = 0;

    for (const ex of examples) {
      if (seen10b.has(ex.content)) {
        intra10bDuplicates++;
      }
      seen10b.add(ex.content);

      if (trainContents.has(ex.content)) exactDuplicatesWith10aTrain++;
      if (valContents.has(ex.content)) exactDuplicatesWith10aVal++;
      if (testContents.has(ex.content)) exactDuplicatesWith10aTest++;
    }

    // Near-duplicate Jaccard similarity audit
    const getTokens = (str: string): Set<string> =>
      new Set(
        str
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length > 2)
      );

    const jaccard = (setA: Set<string>, setB: Set<string>): number => {
      let intersection = 0;
      for (const item of setA) {
        if (setB.has(item)) intersection++;
      }
      const union = setA.size + setB.size - intersection;
      return union === 0 ? 0 : intersection / union;
    };

    const phase10aSets = [
      ...Array.from(trainContents).map((c) => ({ split: "train", tokens: getTokens(c) })),
      ...Array.from(valContents).map((c) => ({ split: "val", tokens: getTokens(c) })),
      ...Array.from(testContents).map((c) => ({ split: "test", tokens: getTokens(c) })),
    ];

    let maxJaccardWithPhase10a = 0;
    let highestOverlapDetails: CrossSplitAuditResult["highestOverlapDetails"] = undefined;

    for (const ex of examples) {
      const exTokens = getTokens(ex.content);
      for (const item of phase10aSets) {
        const j = jaccard(exTokens, item.tokens);
        if (j > maxJaccardWithPhase10a) {
          maxJaccardWithPhase10a = j;
          highestOverlapDetails = {
            exampleId: ex.example_id,
            phase10aSplit: item.split,
            similarity: Number(j.toFixed(4)),
          };
        }
      }
    }

    const isClean =
      exactDuplicatesWith10aTrain === 0 &&
      exactDuplicatesWith10aVal === 0 &&
      exactDuplicatesWith10aTest === 0 &&
      intra10bDuplicates === 0;

    return {
      isClean,
      exactDuplicatesWith10aTrain,
      exactDuplicatesWith10aVal,
      exactDuplicatesWith10aTest,
      intra10bDuplicates,
      maxJaccardWithPhase10a: Number(maxJaccardWithPhase10a.toFixed(4)),
      highestOverlapDetails,
    };
  }
}
