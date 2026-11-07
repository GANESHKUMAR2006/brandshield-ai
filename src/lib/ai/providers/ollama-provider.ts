/**
 * BrandShield AI — Ollama Local LLM Provider
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 * Phase 10D: Deterministic Claim Offset Correction
 *
 * Connects to local Ollama instance (http://localhost:11434) for offline, zero-cloud-cost claim extraction.
 * Communicates with Ollama's native API (/api/chat) with reasoning disabled (`think: false`)
 * to prevent grammar-sampler deadlocks on thinking models (such as qwen3:4b) while deterministically
 * calculating UTF-16 character offsets via ClaimOffsetCalculator.
 */

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

export interface OllamaProviderOptions {
  baseURL?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export class OllamaProvider implements LLMProvider {
  public readonly providerName = "ollama";
  public readonly modelIdentifier: string;
  public readonly baseURL: string;
  private readonly timeout: number;

  constructor(options?: OllamaProviderOptions) {
    const rawBaseURL = options?.baseURL || process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
    this.baseURL = rawBaseURL.replace(/\/+$/, "");
    this.modelIdentifier = options?.model || process.env.OLLAMA_MODEL || "qwen3:4b";
    this.timeout = options?.timeout || 90000; // 90 seconds default for local CPU/GPU execution
  }

  public async extractClaims(
    context: ExtractionPromptContext
  ): Promise<RawExtractionResult> {
    const systemPrompt = EXTRACTION_SYSTEM_PROMPT;
    const userPrompt = buildExtractionUserPrompt(context);

    // Resolve base host (strip trailing /v1 if present for native /api/chat)
    const baseHost = this.baseURL.endsWith("/v1")
      ? this.baseURL.slice(0, -3)
      : this.baseURL;
    const endpoint = `${baseHost}/api/chat`;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BrandShield-AI/1.0",
        },
        body: JSON.stringify({
          model: this.modelIdentifier,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          format: "json",
          think: false, // Critical for Qwen3: disables thinking tokens to avoid JSON grammar conflicts
          stream: false,
          options: {
            temperature: 0.0, // Zero temperature for reproducible extraction
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("Connection error") ||
        message.includes("ECONNREFUSED") ||
        message.includes("fetch failed") ||
        message.includes("ENOTFOUND") ||
        message.includes("timeout") ||
        message.includes("aborted")
      ) {
        throw new Error(
          `Ollama server unreachable at ${this.baseURL}. Ensure the Ollama service is running (e.g. run "ollama serve" in a terminal or launch Ollama).`
        );
      }
      throw new Error(`Ollama claim extraction failed: ${message}`);
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          `Ollama model "${this.modelIdentifier}" not found. Run "ollama pull ${this.modelIdentifier}" to download it locally.`
        );
      }
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Ollama API returned HTTP ${res.status}: ${errText || res.statusText}`
      );
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    let responseText = data.message?.content || "{}";

    // Resilience: Strip markdown code block wrapping if model outputs ```json ... ```
    const jsonCodeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonCodeBlockMatch) {
      responseText = jsonCodeBlockMatch[1].trim();
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      const firstBrace = responseText.indexOf("{");
      const lastBrace = responseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = responseText.slice(firstBrace, lastBrace + 1);
        parsed = JSON.parse(slice);
      } else {
        throw new Error(
          `Failed to parse Ollama JSON response: ${parseErr instanceof Error ? parseErr.message : "Malformed JSON"}`
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

    // Include resolved claims with verified offsets
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

    // Include unresolved claims with negative offsets so downstream ClaimValidator
    // flags them for manual review rather than silently dropping or inventing spans
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
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens:
          (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }
}
