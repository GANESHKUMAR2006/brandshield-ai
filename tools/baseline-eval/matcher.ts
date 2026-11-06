/**
 * BrandShield AI — Claim Matching & Span Alignment Engine
 * Phase 10D: Controlled Baseline Evaluation Harness
 *
 * Implements deterministic matching between ground-truth human annotations
 * and predicted claims:
 * 1. Exact Span Match (start and end match exactly)
 * 2. Relaxed Match (Character-level IoU >= 0.5)
 * 3. Category & Entity alignment checks
 */

import { EvaluationClaim } from "../dataset-builder/phase10b/types";
import { RawExtractedClaim } from "../../src/lib/ai/extraction/extraction-schema";
import { ClaimMatchPair } from "./types";

export class ClaimMatcher {
  /**
   * Computes character-level Intersection over Union (IoU) between two spans.
   */
  public static calculateIoU(
    startA: number,
    endA: number,
    startB: number,
    endB: number
  ): number {
    const intersectionStart = Math.max(startA, startB);
    const intersectionEnd = Math.min(endA, endB);
    const intersection = Math.max(0, intersectionEnd - intersectionStart);

    const unionStart = Math.min(startA, startB);
    const unionEnd = Math.max(endA, endB);
    const union = Math.max(0, unionEnd - unionStart);

    if (union === 0) return 0;
    return intersection / union;
  }

  /**
   * Compares entity key-value dictionaries between ground truth and predicted claims.
   */
  public static evaluateEntities(
    gtEntities: Record<string, unknown> | undefined,
    predEntities: Record<string, unknown> | undefined
  ): { matchScore: number; mismatches: string[] } {
    const gt = gtEntities || {};
    const pred = predEntities || {};

    const allKeys = Array.from(new Set([...Object.keys(gt), ...Object.keys(pred)]));
    if (allKeys.length === 0) {
      return { matchScore: 1.0, mismatches: [] };
    }

    let matchingKeys = 0;
    const mismatches: string[] = [];

    for (const key of allKeys) {
      const gtVal = gt[key];
      const predVal = pred[key];

      if (gtVal === undefined) {
        mismatches.push(`Predicted entity key "${key}" (${JSON.stringify(predVal)}) not in ground truth`);
      } else if (predVal === undefined) {
        mismatches.push(`Ground truth entity key "${key}" (${JSON.stringify(gtVal)}) not predicted`);
      } else {
        // Normalize comparison for numbers, strings, and casing
        const normGt = String(gtVal).trim().toLowerCase();
        const normPred = String(predVal).trim().toLowerCase();

        if (normGt === normPred) {
          matchingKeys++;
        } else {
          mismatches.push(`Value mismatch for "${key}": GT "${normGt}" vs Pred "${normPred}"`);
        }
      }
    }

    return {
      matchScore: matchingKeys / allKeys.length,
      mismatches,
    };
  }

  /**
   * Matches ground-truth claims with model predictions using a deterministic two-pass algorithm.
   */
  public static matchClaims(
    groundTruth: EvaluationClaim[],
    predicted: RawExtractedClaim[]
  ): ClaimMatchPair[] {
    const results: ClaimMatchPair[] = [];

    const unmatchedGt = new Set<number>(groundTruth.map((_, i) => i));
    const unmatchedPred = new Set<number>(predicted.map((_, i) => i));

    // Pass 1: Exact span matches (text_start === text_start && text_end === text_end)
    for (let pIdx = 0; pIdx < predicted.length; pIdx++) {
      const pred = predicted[pIdx];
      for (let gIdx = 0; gIdx < groundTruth.length; gIdx++) {
        if (!unmatchedGt.has(gIdx)) continue;
        const gt = groundTruth[gIdx];

        if (pred.text_start === gt.text_start && pred.text_end === gt.text_end) {
          unmatchedGt.delete(gIdx);
          unmatchedPred.delete(pIdx);

          const entityEval = this.evaluateEntities(
            gt.entities as Record<string, unknown>,
            pred.entities as Record<string, unknown>
          );

          results.push({
            ground_truth: gt,
            predicted: pred,
            match_type: "exact_span",
            iou: 1.0,
            span_exact: true,
            category_exact: gt.claim_type === pred.claim_type,
            entity_match_score: entityEval.matchScore,
            entity_mismatches: entityEval.mismatches,
          });
          break;
        }
      }
    }

    // Pass 2: Greedy relaxed matching based on character IoU >= 0.5
    const candidatePairs: Array<{ gIdx: number; pIdx: number; iou: number }> = [];

    for (const gIdx of unmatchedGt) {
      const gt = groundTruth[gIdx];
      for (const pIdx of unmatchedPred) {
        const pred = predicted[pIdx];
        const iou = this.calculateIoU(gt.text_start, gt.text_end, pred.text_start, pred.text_end);
        if (iou >= 0.5) {
          candidatePairs.push({ gIdx, pIdx, iou });
        }
      }
    }

    // Sort by IoU descending
    candidatePairs.sort((a, b) => b.iou - a.iou);

    for (const pair of candidatePairs) {
      if (unmatchedGt.has(pair.gIdx) && unmatchedPred.has(pair.pIdx)) {
        unmatchedGt.delete(pair.gIdx);
        unmatchedPred.delete(pair.pIdx);

        const gt = groundTruth[pair.gIdx];
        const pred = predicted[pair.pIdx];
        const entityEval = this.evaluateEntities(
          gt.entities as Record<string, unknown>,
          pred.entities as Record<string, unknown>
        );

        results.push({
          ground_truth: gt,
          predicted: pred,
          match_type: "relaxed_overlap",
          iou: pair.iou,
          span_exact: false,
          category_exact: gt.claim_type === pred.claim_type,
          entity_match_score: entityEval.matchScore,
          entity_mismatches: entityEval.mismatches,
        });
      }
    }

    // Pass 3: Unmatched ground-truth claims (False Negatives)
    for (const gIdx of unmatchedGt) {
      results.push({
        ground_truth: groundTruth[gIdx],
        match_type: "unmatched",
        iou: 0,
        span_exact: false,
        category_exact: false,
      });
    }

    // Pass 4: Unmatched predicted claims (False Positives)
    for (const pIdx of unmatchedPred) {
      results.push({
        predicted: predicted[pIdx],
        match_type: "unmatched",
        iou: 0,
        span_exact: false,
        category_exact: false,
      });
    }

    return results;
  }
}
