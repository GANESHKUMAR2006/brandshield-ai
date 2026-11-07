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
import { HuggingFaceProvider } from "./huggingface-provider";
import { OllamaProvider } from "./ollama-provider";

export function getConfiguredProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "").trim().toLowerCase();

  // Explicit mock provider for automated testing and offline development
  if (provider === "mock") {
    return new MockLLMProvider();
  }

  // Ollama local provider
  if (provider === "ollama") {
    return new OllamaProvider();
  }

  // Hugging Face provider (OpenAI-compatible router endpoint)
  if (provider === "huggingface" || (!provider && process.env.HF_TOKEN && !process.env.OPENAI_API_KEY)) {
    const token = process.env.HF_TOKEN;
    if (!token || token.startsWith("hf_placeholder") || token.includes("placeholder")) {
      throw new Error(
        "Hugging Face provider selected, but HF_TOKEN is missing or contains placeholder. " +
          "Configure a valid token in .env.local or set LLM_PROVIDER=mock for automated testing."
      );
    }
    return new HuggingFaceProvider();
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
    "No valid LLM provider configured. Please set LLM_PROVIDER=ollama (or huggingface, openai, mock) in .env.local."
  );
}
