/**
 * BrandShield AI — Mock Embedding Provider
 * Phase 7: Evidence Intelligence and RAG
 *
 * Generates deterministic 1536-dimensional normalized vectors for offline development
 * and automated testing without hitting external APIs.
 */

import crypto from "crypto";
import {
  EmbeddingProvider,
  PGVECTOR_EMBEDDING_DIMENSION,
  EmbeddingDimensionMismatchError,
} from "./embedding-provider";

export class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly providerName = "mock";
  public readonly modelIdentifier = "mock-embedding-1536";
  public readonly dimension = PGVECTOR_EMBEDDING_DIMENSION;

  public async generateEmbedding(text: string): Promise<number[]> {
    return this.createDeterministicVector(text);
  }

  public async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.createDeterministicVector(t));
  }

  /**
   * Generates a deterministic, L2-normalized 1536-dimensional vector based on the input text.
   */
  private createDeterministicVector(text: string): number[] {
    const vector: number[] = new Array(this.dimension);
    const hash = crypto.createHash("sha256").update(text.trim().toLowerCase()).digest();

    // Use hash bytes to seed a pseudo-random sequence
    let seed = hash.readUInt32LE(0);
    let normSq = 0;

    for (let i = 0; i < this.dimension; i++) {
      // 32-bit linear congruential generator
      seed = (seed * 1664525 + 1013904223) >>> 0;
      // Map to (-1.0, 1.0)
      const val = (seed / 4294967295) * 2 - 1;
      vector[i] = val;
      normSq += val * val;
    }

    // L2-normalize vector to unit length so dot product equals cosine similarity
    const norm = Math.sqrt(normSq) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    if (vector.length !== this.dimension) {
      throw new EmbeddingDimensionMismatchError(vector.length, this.dimension);
    }

    return vector;
  }
}

