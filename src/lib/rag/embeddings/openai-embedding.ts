/**
 * BrandShield AI — OpenAI Embedding Provider
 * Phase 7: Evidence Intelligence and RAG
 */

import OpenAI from "openai";
import {
  EmbeddingProvider,
  PGVECTOR_EMBEDDING_DIMENSION,
  EmbeddingDimensionMismatchError,
  EmbeddingProviderError,
} from "./embedding-provider";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  public readonly providerName = "openai";
  public readonly modelIdentifier = "text-embedding-3-small";
  public readonly dimension = PGVECTOR_EMBEDDING_DIMENSION;

  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new EmbeddingProviderError("OPENAI_API_KEY is required to initialize OpenAIEmbeddingProvider.");
    }
    this.client = new OpenAI({ apiKey: key });
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const [vector] = await this.generateBatchEmbeddings([text]);
    return vector;
  }

  public async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const response = await this.client.embeddings.create({
        model: this.modelIdentifier,
        input: texts,
        dimensions: this.dimension,
      });

      const vectors: number[][] = [];
      for (const item of response.data) {
        const vec = item.embedding;
        if (vec.length !== this.dimension) {
          throw new EmbeddingDimensionMismatchError(vec.length, this.dimension);
        }
        vectors.push(vec);
      }

      return vectors;
    } catch (err: unknown) {
      if (err instanceof EmbeddingDimensionMismatchError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "OpenAI embedding generation failed";
      const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status?: unknown }).status) : undefined;
      throw new EmbeddingProviderError(
        `OpenAI embedding API error: ${message}`,
        status
      );
    }
  }
}

