/**
 * BrandShield AI — OpenAI Embedding Provider
 * Phase 7: Evidence Intelligence and RAG
 *
 * Generates 1536-dimensional semantic vectors via OpenAI text-embedding-3-small
 * or an OpenAI-compatible embedding gateway.
 */

import OpenAI from "openai";
import {
  EmbeddingProvider,
  PGVECTOR_EMBEDDING_DIMENSION,
  EmbeddingDimensionMismatchError,
  EmbeddingProviderError,
} from "./embedding-provider";

export interface OpenAIEmbeddingOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  public readonly providerName = "openai";
  public readonly modelIdentifier: string;
  public readonly dimension = PGVECTOR_EMBEDDING_DIMENSION;

  private client: OpenAI;

  constructor(options?: string | OpenAIEmbeddingOptions) {
    const opts: OpenAIEmbeddingOptions =
      typeof options === "string" ? { apiKey: options } : options || {};

    const key = opts.apiKey || process.env.OPENAI_API_KEY;
    if (!key || key.startsWith("sk-placeholder")) {
      throw new EmbeddingProviderError(
        "OPENAI_API_KEY is required to initialize OpenAIEmbeddingProvider."
      );
    }

    this.modelIdentifier =
      opts.model || process.env.EMBEDDING_MODEL || "text-embedding-3-small";

    const baseURL =
      opts.baseURL ||
      process.env.OPENAI_BASE_URL ||
      process.env.EMBEDDING_BASE_URL;

    this.client = new OpenAI({
      apiKey: key,
      ...(baseURL ? { baseURL } : {}),
    });
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
      const rawMessage =
        err instanceof Error ? err.message : "OpenAI embedding generation failed";
      // Sanitize any API keys from the error message to prevent accidental leakage
      const sanitizedMessage = rawMessage.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***");
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : undefined;

      throw new EmbeddingProviderError(
        `OpenAI embedding API error: ${sanitizedMessage}`,
        status
      );
    }
  }
}
