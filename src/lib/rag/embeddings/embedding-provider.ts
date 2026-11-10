/**
 * BrandShield AI — Embedding Provider Interface & Factory
 * Phase 7: Evidence Intelligence and RAG
 */

export const PGVECTOR_EMBEDDING_DIMENSION = 1536;

export class EmbeddingDimensionMismatchError extends Error {
  constructor(actual: number, expected: number = PGVECTOR_EMBEDDING_DIMENSION) {
    super(
      `Embedding dimension mismatch: generated vector has ${actual} dimensions, but pgvector schema requires ${expected}.`
    );
    this.name = "EmbeddingDimensionMismatchError";
  }
}

export class EmbeddingProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "EmbeddingProviderError";
  }
}

export interface EmbeddingProvider {
  readonly providerName: string;
  readonly modelIdentifier: string;
  readonly dimension: number;

  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

import { OpenAIEmbeddingProvider } from "./openai-embedding";
import { MockEmbeddingProvider } from "./mock-embedding";

/**
 * Resolves configured embedding provider based on environment configuration.
 * Strictly avoids generating mock embeddings in production.
 */
export function getConfiguredEmbeddingProvider(): EmbeddingProvider {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  const explicitProvider = (process.env.EMBEDDING_PROVIDER || "").trim().toLowerCase();

  // Explicit mock provider for automated tests or local development
  if (explicitProvider === "mock" || process.env.NODE_ENV === "test") {
    if (isProduction && explicitProvider === "mock") {
      throw new EmbeddingProviderError(
        "Configuration error: Mock embedding provider is strictly prohibited in production."
      );
    }
    return new MockEmbeddingProvider();
  }

  // Real OpenAI embedding provider
  if (explicitProvider === "openai" || (!explicitProvider && process.env.OPENAI_API_KEY)) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-placeholder")) {
      if (isProduction) {
        throw new EmbeddingProviderError(
          "OpenAI provider selected in production, but valid OPENAI_API_KEY is missing. " +
            "Please configure OPENAI_API_KEY in Render environment variables."
        );
      }
      // In dev mode when API key is missing, warn or require explicit mock setting
      throw new EmbeddingProviderError(
        "OPENAI_API_KEY is not configured or contains a placeholder. " +
          "Configure a valid key in .env.local or set EMBEDDING_PROVIDER=mock for offline development."
      );
    }
    return new OpenAIEmbeddingProvider();
  }

  if (isProduction) {
    throw new EmbeddingProviderError(
      "Production embedding provider is not configured. OPENAI_API_KEY environment variable is required on Render for semantic evidence retrieval and vector indexing."
    );
  }

  throw new EmbeddingProviderError(
    "No valid embedding provider configured. Please set EMBEDDING_PROVIDER=openai and OPENAI_API_KEY, " +
      "or EMBEDDING_PROVIDER=mock for offline development/testing."
  );
}

/**
 * Returns diagnostic metadata regarding current embedding configuration.
 * Safe to inspect without throwing unhandled exceptions.
 */
export function getEmbeddingProviderStatus(): {
  isConfigured: boolean;
  provider: string;
  model: string;
  dimension: number;
  isProduction: boolean;
  error?: string;
} {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production";

  try {
    const provider = getConfiguredEmbeddingProvider();
    return {
      isConfigured: true,
      provider: provider.providerName,
      model: provider.modelIdentifier,
      dimension: provider.dimension,
      isProduction,
    };
  } catch (err: unknown) {
    return {
      isConfigured: false,
      provider: (process.env.EMBEDDING_PROVIDER || "unconfigured").trim().toLowerCase(),
      model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      dimension: PGVECTOR_EMBEDDING_DIMENSION,
      isProduction,
      error: err instanceof Error ? err.message : "Provider configuration failed",
    };
  }
}
