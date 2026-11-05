/**
 * BrandShield AI — Deterministic Mock LLM Provider
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Provides reproducible, deterministic extraction outputs for automated test suites
 * without invoking live external LLM APIs.
 */

import {
  ExtractionPromptContext,
  LLMProvider,
  RawClaimOutput,
  RawExtractionResult,
} from "./provider-interface";
import { EXTRACTION_PROMPT_VERSION } from "../extraction/extraction-prompt";

export class MockLLMProvider implements LLMProvider {
  public readonly providerName = "mock";
  public readonly modelIdentifier = "mock-extraction-engine-v1";

  private simulateFailure = false;
  private failureErrorMessage = "Simulated mock provider API outage";

  constructor(options?: { simulateFailure?: boolean; failureErrorMessage?: string }) {
    if (options?.simulateFailure) {
      this.simulateFailure = true;
    }
    if (options?.failureErrorMessage) {
      this.failureErrorMessage = options.failureErrorMessage;
    }
  }

  public setSimulateFailure(fail: boolean, message?: string) {
    this.simulateFailure = fail;
    if (message) this.failureErrorMessage = message;
  }

  public async extractClaims(
    context: ExtractionPromptContext
  ): Promise<RawExtractionResult> {
    if (this.simulateFailure) {
      throw new Error(this.failureErrorMessage);
    }

    const content = context.content;
    const rawClaims: RawClaimOutput[] = [];

    // Helper to add claim with guaranteed valid slice
    const addVerbatimClaim = (
      exactSubstring: string,
      claimType: string,
      productHint?: string | null,
      entities?: Record<string, unknown>,
      confidence = 0.95
    ) => {
      const start = content.indexOf(exactSubstring);
      if (start >= 0) {
        const end = start + exactSubstring.length;
        rawClaims.push({
          claim_text: exactSubstring,
          claim_type: claimType,
          text_start: start,
          text_end: end,
          product_hint: productHint || null,
          entities: entities || {},
          extraction_confidence: confidence,
        });
      }
    };

    // 1. Benchmark Ad Variant A
    if (content.includes("25% Ultra Vitamin C Serum") || content.includes("price of only ₹999")) {
      addVerbatimClaim(
        "25% Ultra Vitamin C Serum",
        "product_attribute",
        "DermaGlow Vitamin C Serum",
        { ingredient: "Vitamin C", concentration: 25, unit: "%" },
        0.98
      );
      addVerbatimClaim(
        "price of only ₹999",
        "price",
        "DermaGlow Vitamin C Serum",
        { price: 999, currency: "INR" },
        0.97
      );
      addVerbatimClaim(
        "Eliminates 100% of wrinkles overnight",
        "guarantee",
        "DermaGlow Vitamin C Serum",
        { timeline: "overnight", attribute: "wrinkles", reduction: "100%" },
        0.96
      );
      return this.formatResult(rawClaims);
    }

    // 2. Benchmark Ad Variant B
    if (content.includes("10% stabilised Vitamin C") && content.includes("dark spots in 24 hours")) {
      addVerbatimClaim(
        "10% stabilised Vitamin C",
        "product_attribute",
        "DermaGlow Vitamin C Serum",
        { ingredient: "Vitamin C", concentration: 10, unit: "%" },
        0.99
      );
      addVerbatimClaim(
        "Guaranteed 100% eradication of all dark spots in 24 hours",
        "guarantee",
        "DermaGlow Vitamin C Serum",
        { timeline: "24 hours", target: "dark spots", promise: "100% eradication" },
        0.95
      );
      return this.formatResult(rawClaims);
    }

    // 3. Benchmark Ad Variant C
    if (content.includes("Formulated with 10% stabilised Vitamin C") && content.includes("Festival launch price")) {
      addVerbatimClaim(
        "Formulated with 10% stabilised Vitamin C",
        "product_attribute",
        "DermaGlow Vitamin C Serum",
        { ingredient: "Vitamin C", concentration: 10, unit: "%" },
        0.99
      );
      addVerbatimClaim(
        "improves skin radiance after 4 weeks",
        "efficacy",
        "DermaGlow Vitamin C Serum",
        { outcome: "skin radiance", timeline: "4 weeks" },
        0.96
      );
      addVerbatimClaim(
        "Festival launch price of ₹1,999",
        "discount",
        "DermaGlow Vitamin C Serum",
        { price: 1999, currency: "INR", event: "Festival launch" },
        0.98
      );
      addVerbatimClaim(
        "Regular MRP ₹2,499",
        "price",
        "DermaGlow Vitamin C Serum",
        { price: 2499, currency: "INR", type: "MRP" },
        0.99
      );
      return this.formatResult(rawClaims);
    }

    // 4. Test Case: Multiple Products Mentions
    if (content.includes("Vitamin C Serum for ₹1,999") && content.includes("HydraDefense Night Cream for ₹1,499")) {
      addVerbatimClaim(
        "Vitamin C Serum for ₹1,999",
        "price",
        "DermaGlow Vitamin C Serum",
        { price: 1999, currency: "INR" },
        0.96
      );
      addVerbatimClaim(
        "HydraDefense Night Cream for ₹1,499",
        "price",
        "HydraDefense Night Cream",
        { price: 1499, currency: "INR" },
        0.96
      );
      return this.formatResult(rawClaims);
    }

    // 5. General Pattern Extraction for arbitrary marketing texts
    // Check for "No-claim" lifestyle text:
    const isPureLifestyle =
      content.includes("Welcome to our lifestyle") ||
      content.includes("Pure serenity awaits") ||
      content.includes("Embrace elegance and tranquility");
    if (isPureLifestyle) {
      return this.formatResult([]);
    }

    // A. Ingredient / Concentration pattern (e.g. "Contains 10% Vitamin C", "5% Niacinamide")
    const concMatches = [
      ...content.matchAll(
        /(?:Contains |features |Formulated with )?(\d+(?:\.\d+)?%\s+[A-Za-z0-9\s-]+?(?:Serum|Cream|Vitamin [A-Za-z0-9]+|L-Ascorbic Acid|Niacinamide|Hyaluronic Acid))/gi
      ),
    ];
    for (const match of concMatches) {
      if (match.index !== undefined && match[0]) {
        addVerbatimClaim(
          match[0],
          "product_attribute",
          context.submissionTitle || null,
          { raw_match: match[0] },
          0.94
        );
      }
    }

    // B. Comparative pattern (e.g. "2x faster radiance than standard vitamin C formulations")
    const compMatches = [
      ...content.matchAll(/([0-9]+x\s+faster\s+[A-Za-z0-9\s-]+?(?:than|compared to)\s+[A-Za-z0-9\s-]+)/gi),
    ];
    for (const match of compMatches) {
      if (match.index !== undefined && match[0]) {
        addVerbatimClaim(
          match[0],
          "comparative",
          null,
          { comparison: match[0] },
          0.92
        );
      }
    }

    // C. Clinical pattern (e.g. "clinically proven in 50 patients", "double-blind clinical trial")
    const clinMatches = [
      ...content.matchAll(/(clinically\s+proven\s+in\s+\d+\s+patients|double-blind\s+clinical\s+trial)/gi),
    ];
    for (const match of clinMatches) {
      if (match.index !== undefined && match[0]) {
        addVerbatimClaim(
          match[0],
          "clinical",
          null,
          { statement: match[0] },
          0.95
        );
      }
    }

    // D. Efficacy pattern (e.g. "improves skin barrier hydration after 8 weeks")
    const effMatches = [
      ...content.matchAll(/(improves\s+skin\s+barrier\s+hydration\s+after\s+\d+\s+weeks|reduces\s+wrinkles\s+by\s+\d+%\s+in\s+\d+\s+days)/gi),
    ];
    for (const match of effMatches) {
      if (match.index !== undefined && match[0]) {
        addVerbatimClaim(
          match[0],
          "efficacy",
          null,
          { outcome: match[0] },
          0.94
        );
      }
    }

    // E. Guarantee pattern (e.g. "100% money-back guarantee", "Eliminates all wrinkles")
    const guarMatches = [
      ...content.matchAll(/(100%\s+money-back\s+guarantee|Guaranteed\s+[A-Za-z0-9\s-]+|Eliminates\s+100%\s+of\s+[A-Za-z0-9\s-]+)/gi),
    ];
    for (const match of guarMatches) {
      if (match.index !== undefined && match[0]) {
        addVerbatimClaim(
          match[0],
          "guarantee",
          null,
          { promise: match[0] },
          0.93
        );
      }
    }

    // F. Price / Promotion pattern (e.g. "price of only ₹999", "₹1,999", "₹2,499")
    const priceMatches = [
      ...content.matchAll(/(?:price of (?:only )?|Regular MRP |launch price of |only )?(₹|\$|€)(\d{1,3}(?:,\d{3})*|\d+)/gi),
    ];
    for (const match of priceMatches) {
      if (match.index !== undefined && match[0]) {
        // avoid duplicating if already matched in benchmark
        const text = match[0];
        if (!rawClaims.some((c) => c.claim_text.includes(text))) {
          const num = parseInt(match[2].replace(/,/g, ""), 10);
          addVerbatimClaim(
            text,
            "price",
            null,
            { price: num, currency: match[1] === "₹" ? "INR" : "USD" },
            0.95
          );
        }
      }
    }

    return this.formatResult(rawClaims);
  }

  private formatResult(rawClaims: RawClaimOutput[]): RawExtractionResult {
    return {
      rawClaims,
      provider: this.providerName,
      modelIdentifier: this.modelIdentifier,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      rawTextResponse: JSON.stringify({ claims: rawClaims }),
      usage: {
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      },
    };
  }
}
