/**
 * BrandShield AI — LLM Provider Interface
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Defines the contract that all LLM provider implementations (OpenAI, Anthropic, Mock)
 * must implement to maintain decoupling from business logic.
 */

export interface ExtractionPromptContext {
  content: string;
  submissionTitle?: string;
  channel?: string;
  knownProducts?: Array<{ id: string; name: string; sku: string }>;
  promptVersion?: string;
}

export interface RawClaimOutput {
  claim_text: string;
  claim_type: string;
  text_start: number;
  text_end: number;
  product_hint?: string | null;
  entities?: Record<string, unknown>;
  extraction_confidence: number;
}

export interface RawExtractionResult {
  rawClaims: RawClaimOutput[];
  provider: string;
  modelIdentifier: string;
  promptVersion: string;
  rawTextResponse?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  readonly providerName: string;
  readonly modelIdentifier: string;
  extractClaims(context: ExtractionPromptContext): Promise<RawExtractionResult>;
}
