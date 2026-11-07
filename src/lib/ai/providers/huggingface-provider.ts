/**
 * BrandShield AI — Hugging Face LLM Provider
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Implements structured claim extraction using official OpenAI SDK pointed to
 * Hugging Face's OpenAI-compatible router endpoint (https://router.huggingface.co/v1).
 *
 * Supports open-weights models such as Qwen/Qwen3-32B with deterministic extraction,
 * structured JSON output parsing, and resilient error/rate-limit handling.
 */

import OpenAI from "openai";
import {
  ExtractionPromptContext,
  LLMProvider,
  ModelClaimInput,
  RawClaimOutput,
  RawExtractionResult,
} from "./provider-interface";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "../extraction/extraction-prompt";
import { ClaimOffsetCalculator } from "../extraction/claim-offset-calculator";

export interface HuggingFaceProviderOptions {
  token?: string;
  baseURL?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class HuggingFaceProvider implements LLMProvider {
  public readonly providerName = "huggingface";
  public readonly modelIdentifier: string;
  public readonly baseURL: string;
  private client: OpenAI;

  constructor(options?: HuggingFaceProviderOptions) {
    const token = options?.token !== undefined ? options.token : process.env.HF_TOKEN;
    if (!token || !token.trim()) {
      throw new Error(
        "HuggingFaceProvider requires a valid HF_TOKEN in environment variables or constructor options."
      );
    }

    if (token.startsWith("hf_placeholder") || token.includes("placeholder")) {
      throw new Error(
        "HuggingFaceProvider: HF_TOKEN contains a placeholder value. Please set a valid Hugging Face access token."
      );
    }

    this.baseURL = options?.baseURL || process.env.HF_BASE_URL || "https://router.huggingface.co/v1";
    this.modelIdentifier = options?.model || process.env.HF_MODEL || "Qwen/Qwen3-32B";

    this.client = new OpenAI({
      apiKey: token,
      baseURL: this.baseURL,
      timeout: options?.timeout || 45000, // 45 seconds for open-weights router inference
      maxRetries: options?.maxRetries !== undefined ? options.maxRetries : 2, // Configurable retries
      defaultHeaders: {
        "User-Agent": "BrandShield-AI/1.0",
      },
    });
  }

  public async extractClaims(
    context: ExtractionPromptContext
  ): Promise<RawExtractionResult> {
    const systemPrompt = EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildExtractionUserPrompt(context);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.modelIdentifier,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.0, // Zero temperature for reproducible deterministic extraction
        response_format: { type: "json_object" },
      });

      let responseText = completion.choices[0]?.message?.content || "{}";

      // Resilience: Strip markdown code block wrapping if the model emits ```json ... ```
      const jsonCodeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonCodeBlockMatch) {
        responseText = jsonCodeBlockMatch[1].trim();
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        // Fallback: Attempt to extract substring between first { and last }
        const firstBrace = responseText.indexOf("{");
        const lastBrace = responseText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const slice = responseText.slice(firstBrace, lastBrace + 1);
          parsed = JSON.parse(slice);
        } else {
          throw new Error(
            `Failed to parse model JSON output: ${parseErr instanceof Error ? parseErr.message : "Malformed JSON"}`
          );
        }
      }

      const rawCandidates: ModelClaimInput[] = Array.isArray(parsed.claims)
        ? (parsed.claims as ModelClaimInput[])
        : Array.isArray(parsed)
        ? (parsed as ModelClaimInput[])
        : [];

      // Phase 10D: Deterministically calculate and verify UTF-16 character offsets
      const batchResult = ClaimOffsetCalculator.resolveBatch(rawCandidates, context.content);

      const rawClaims: RawClaimOutput[] = [];
      for (const resolved of batchResult.resolvedClaims) {
        rawClaims.push({
          claim_text: resolved.claim_text,
          claim_type: resolved.claim_type,
          text_start: resolved.text_start,
          text_end: resolved.text_end,
          product_hint: resolved.product_hint || null,
          entities: (resolved.entities as Record<string, unknown>) || {},
          extraction_confidence: resolved.extraction_confidence ?? 0.95,
        });
      }
      for (const unresolved of batchResult.unresolvedClaims) {
        rawClaims.push({
          claim_text: unresolved.claim.claim_text,
          claim_type: unresolved.claim.claim_type,
          text_start: -1,
          text_end: -1,
          product_hint: unresolved.claim.product_hint || null,
          entities: (unresolved.claim.entities as Record<string, unknown>) || {},
          extraction_confidence: unresolved.claim.extraction_confidence ?? 0.5,
        });
      }

      return {
        rawClaims,
        provider: this.providerName,
        modelIdentifier: this.modelIdentifier,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        rawTextResponse: responseText,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (err: unknown) {
      if (err instanceof OpenAI.APIError) {
        if (err.status === 401) {
          throw new Error("Hugging Face authentication failed: Invalid or expired HF_TOKEN.");
        }
        if (err.status === 404) {
          throw new Error(
            `Hugging Face model "${this.modelIdentifier}" not found or not available via router.`
          );
        }
        if (err.status === 429) {
          throw new Error(
            "Hugging Face rate limit exceeded. Please wait a moment before retrying."
          );
        }
      }

      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Hugging Face claim extraction failed: ${message}`);
    }
  }
}
