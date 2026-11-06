/**
 * BrandShield AI — Retrieval Scoring & Stance Helper
 * Phase 7: Evidence Intelligence and RAG
 *
 * Keeps relevance scoring separate from factual verification confidence.
 */

import { EvidenceStance } from "../types";

export class RetrievalScorer {
  private static STOP_WORDS = new Set([
    "a", "an", "the", "in", "on", "at", "for", "to", "of", "with", "by",
    "and", "or", "is", "are", "was", "were", "be", "been", "our", "your",
    "this", "that", "these", "those", "can", "will", "all", "more", "most"
  ]);

  /**
   * Computes cosine similarity between two unit vectors.
   */
  public static computeCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    // Clamped to [0, 1] for similarity
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }

  /**
   * Computes normalized keyword match score (0.0 to 1.0) using token overlap and phrase presence.
   */
  public static computeKeywordScore(query: string, content: string): number {
    const qLower = query.toLowerCase();
    const cLower = content.toLowerCase();

    // Exact verbatim substring match gives highest keyword score
    if (cLower.includes(qLower)) {
      return 1.0;
    }

    const queryTokens = qLower
      .split(/[^a-z0-9%.-]+/)
      .filter((t) => t.length > 2 && !this.STOP_WORDS.has(t));

    if (queryTokens.length === 0) return 0.2;

    let matchedCount = 0;
    for (const token of queryTokens) {
      if (cLower.includes(token)) {
        matchedCount++;
      }
    }

    return Number((matchedCount / queryTokens.length).toFixed(4));
  }

  /**
   * Combines vector similarity and keyword score into a normalized hybrid relevance score.
   */
  public static computeHybridRelevance(vectorSim: number, keywordScore: number): number {
    // 70% semantic vector similarity, 30% lexical keyword score
    const combined = vectorSim * 0.7 + keywordScore * 0.3;
    return Number(Math.max(0, Math.min(1, combined)).toFixed(4));
  }

  /**
   * Heuristic preliminary stance tagging for reviewer convenience.
   * NOTE: The deterministic verification engine remains the ultimate authoritative truth arbiter.
   */
  public static evaluateStance(claimText: string, excerpt: string): EvidenceStance {
    const cLower = claimText.toLowerCase();
    const eLower = excerpt.toLowerCase();

    // Check for explicit contradiction patterns
    if (
      (cLower.includes("100%") && (eLower.includes("not 100%") || eLower.includes("up to 85%"))) ||
      (cLower.includes("permanent") && eLower.includes("temporary")) ||
      (cLower.includes("eradicates") && eLower.includes("reduces appearance")) ||
      (cLower.includes("cure") && eLower.includes("does not cure")) ||
      eLower.includes("contraindicated") ||
      eLower.includes("prohibited")
    ) {
      return "contradicting";
    }

    // Check for supportive patterns
    if (
      eLower.includes("clinically proven") ||
      eLower.includes("statistically significant") ||
      eLower.includes("demonstrated efficacy") ||
      eLower.includes("validated formulation") ||
      eLower.includes("approved claim")
    ) {
      return "supporting";
    }

    return "contextual";
  }
}

