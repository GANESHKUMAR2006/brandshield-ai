/**
 * BrandShield AI — OpenAI LLM Provider
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Implements structured claim extraction using official OpenAI SDK with JSON schema mode.
 */

import OpenAI from "openai";
import {
  ExtractionPromptContext,
  LLMProvider,
  RawClaimOutput,
  RawExtractionResult,
} from "./provider-interface";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from "../extraction/extraction-prompt";

export class OpenAIProvider implements LLMProvider {
  public readonly providerName = "openai";
  public readonly modelIdentifier: string;
  private client: OpenAI;

  constructor(options?: { apiKey?: string; model?: string }) {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAIProvider requires an OPENAI_API_KEY in the environment or constructor options.");
    }

    this.modelIdentifier = options?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.client = new OpenAI({
      apiKey,
      timeout: 35000, // 35 second timeout
      maxRetries: 2,
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
        temperature: 0.0, // Zero temperature for reproducible extraction
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(responseText);

      const rawClaims: RawClaimOutput[] = Array.isArray(parsed.claims)
        ? parsed.claims
        : Array.isArray(parsed)
        ? parsed
        : [];

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
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAI claim extraction failed: ${message}`);
    }
  }
}
