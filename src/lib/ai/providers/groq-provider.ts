/**
 * BrandShield AI — Groq LLM Provider
 * Phase 16C: Ultra-Low Latency Groq AI Integration
 *
 * Implements structured marketing claim extraction using the official OpenAI SDK
 * pointed to Groq's high-speed inference endpoint (https://api.groq.com/openai/v1).
 *
 * Supports fast open-weights models (e.g., openai/gpt-oss-20b) with deterministic
 * extraction, structured JSON output, and Phase 10D UTF-16 offset resolution.
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

export interface GroqProviderOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class GroqProvider implements LLMProvider {
  public readonly providerName = "groq";
  public readonly modelIdentifier: string;
  public readonly baseURL: string;
  private client: OpenAI;

  constructor(options?: GroqProviderOptions) {
    const key = options?.apiKey !== undefined ? options.apiKey : process.env.GROQ_API_KEY;
    if (!key || !key.trim()) {
      throw new Error(
        "GroqProvider requires a valid GROQ_API_KEY in environment variables or constructor options."
      );
    }

    if (key.startsWith("gsk_placeholder") || key.includes("placeholder")) {
      throw new Error(
        "GroqProvider: GROQ_API_KEY contains a placeholder value. Please set a valid Groq API key in .env.local."
      );
    }

    this.baseURL = options?.baseURL || process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
    this.modelIdentifier = options?.model || process.env.GROQ_MODEL || "openai/gpt-oss-20b";

    this.client = new OpenAI({
      apiKey: key,
      baseURL: this.baseURL,
      timeout: options?.timeout || 30000, // 30-second timeout for Groq LPUs
      maxRetries: options?.maxRetries !== undefined ? options.maxRetries : 0, // Disabled unnecessary retries to protect free-tier rate limits
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
      let completion;
      try {
        completion = await this.client.chat.completions.create({
          model: this.modelIdentifier,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.0, // Zero temperature for reproducible deterministic extraction
          response_format: { type: "json_object" },
        });
      } catch (jsonFormatErr: unknown) {
        const errorMsg = jsonFormatErr instanceof Error ? jsonFormatErr.message : String(jsonFormatErr);
        if (errorMsg.includes("Failed to validate JSON")) {
          // Groq server-side json_object filter failed; retry with standard completion and parse manually
          completion = await this.client.chat.completions.create({
            model: this.modelIdentifier,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.0,
          });
        } else {
          throw jsonFormatErr;
        }
      }

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
            `Failed to parse Groq model JSON output: ${parseErr instanceof Error ? parseErr.message : "Malformed JSON"}`
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
          throw new Error("Groq authentication failed: Invalid or expired GROQ_API_KEY.");
        }
        if (err.status === 404) {
          throw new Error(
            `Groq model "${this.modelIdentifier}" not found or not available.`
          );
        }
        if (err.status === 429) {
          throw new Error(
            "Groq rate limit exceeded. Please wait a moment before retrying."
          );
        }
      }

      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Groq claim extraction failed: ${message}`);
    }
  }
}

