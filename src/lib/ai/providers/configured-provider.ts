/**
 * BrandShield AI — Configured LLM Provider Factory
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Resolves the active LLM provider based on environment configuration.
 * Never silently substitutes mock results in production.
 */

import { LLMProvider } from "./provider-interface";
import { MockLLMProvider } from "./mock-provider";
import { OpenAIProvider } from "./openai-provider";

export function getConfiguredProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "").trim().toLowerCase();

  // Explicit mock provider for automated testing and offline development
  if (provider === "mock") {
    return new MockLLMProvider();
  }

  // OpenAI provider
  if (provider === "openai" || (!provider && process.env.OPENAI_API_KEY)) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-placeholder")) {
      throw new Error(
        "OpenAI provider selected, but OPENAI_API_KEY is missing or contains placeholder. " +
          "Configure a valid key or set LLM_PROVIDER=mock for automated testing."
      );
    }
    return new OpenAIProvider();
  }

  // If in automated testing environment without explicit provider
  if (process.env.NODE_ENV === "test") {
    return new MockLLMProvider();
  }

  // Clear configuration error if unconfigured
  throw new Error(
    "No valid LLM provider configured. Please set LLM_PROVIDER=openai and OPENAI_API_KEY in .env.local, " +
      "or set LLM_PROVIDER=mock for deterministic test runs."
  );
}
