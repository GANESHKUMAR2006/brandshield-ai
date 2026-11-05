/**
 * BrandShield AI — Extraction Schema & Types
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Strict Zod validation schemas and closed enums for structured claim extraction.
 */

import { z } from "zod";

/**
 * Closed enum of permissible marketing claim categories.
 */
export const CLAIM_TYPES = [
  "price",
  "discount",
  "product_attribute",
  "efficacy",
  "guarantee",
  "comparative",
  "clinical",
  "availability",
  "promotional",
  "other",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];

/**
 * Structured entity schema extracted from marketing copy.
 */
export const ClaimEntitiesSchema = z
  .object({
    ingredient: z.string().optional(),
    concentration: z.union([z.number(), z.string()]).optional(),
    unit: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    discount_percentage: z.number().optional(),
    discount_amount: z.number().optional(),
    timeline: z.string().optional(),
    comparison_target: z.string().optional(),
    attribute_name: z.string().optional(),
    attribute_value: z.string().optional(),
  })
  .passthrough()
  .default({});

export type ClaimEntities = z.infer<typeof ClaimEntitiesSchema>;

/**
 * Raw extracted claim schema directly produced by the LLM.
 */
export const RawExtractedClaimSchema = z.object({
  claim_text: z
    .string()
    .min(1, "Claim text cannot be empty")
    .describe("Exact verbatim substring from the original marketing text"),
  claim_type: z
    .enum(CLAIM_TYPES)
    .describe("Classification category of the factual assertion"),
  text_start: z
    .number()
    .int("text_start must be an integer")
    .nonnegative("text_start must be >= 0")
    .describe("Zero-based UTF-16 character start index in original text"),
  text_end: z
    .number()
    .int("text_end must be an integer")
    .positive("text_end must be > 0")
    .describe("Zero-based UTF-16 character end index in original text"),
  product_hint: z
    .string()
    .nullable()
    .optional()
    .describe("Name or SKU of the product associated with this claim, if mentioned"),
  entities: ClaimEntitiesSchema.optional().default({}),
  extraction_confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .describe("Model confidence score for this extraction between 0.0 and 1.0"),
});

export type RawExtractedClaim = z.infer<typeof RawExtractedClaimSchema>;

/**
 * Envelope schema for structured output responses.
 */
export const ExtractionResponseSchema = z.object({
  claims: z
    .array(RawExtractedClaimSchema)
    .describe("List of distinct, verifiable marketing assertions"),
});

export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;
