/**
 * BrandShield AI — Synthetic Dataset Generator & Assembly Engine
 * Phase 10A: Training Dataset Builder
 *
 * Synthesizes multi-claim, single-claim, zero-claim (hard negative),
 * ambiguous, and high-risk marketing records with exact UTF-16 offsets.
 * Also generates deliberately flawed examples to verify rejection gates.
 */

import {
  ClaimType,
  CLAIM_TYPES,
  RawExtractedClaim,
} from "../../src/lib/ai/extraction/extraction-schema";
import {
  DatasetExample,
  MarketingChannel,
  ProvenanceMetadata,
  ExampleMetadata,
  RiskCategory,
} from "./types";
import { DeterministicPRNG } from "./prng";
import { CatalogProduct, PartitionCatalog } from "./catalog";
import {
  ATOMIC_CLAIM_TEMPLATES,
  HARD_NEGATIVE_TEXTS,
  CHANNEL_CONFIGS,
} from "./templates";
import { DatasetValidator } from "./validator";
import { QualityReviewer } from "./reviewer";

export interface GenerationRunResult {
  approvedExamples: DatasetExample[];
  rejectedExamples: DatasetExample[];
}

export class DatasetGenerator {
  /**
   * Generates a partition of approved examples targeting targetApprovedCount.
   */
  public static generatePartition(
    catalog: PartitionCatalog,
    targetApprovedCount: number,
    prng: DeterministicPRNG,
    startExampleIndex: number
  ): GenerationRunResult {
    const approved: DatasetExample[] = [];
    const rejected: DatasetExample[] = [];
    const seenContentHashes = new Set<string>();

    let currentIndex = startExampleIndex;
    let attempts = 0;
    const maxAttempts = targetApprovedCount * 4;

    while (approved.length < targetApprovedCount && attempts < maxAttempts) {
      attempts++;

      // Distribute claim counts:
      // ~12% zero claims (hard negative)
      // ~33% single claim
      // ~55% multi-claim (2, 3, 4, 5 claims)
      const roll = prng.next();
      let claimCount = 1;
      if (roll < 0.12) {
        claimCount = 0;
      } else if (roll < 0.45) {
        claimCount = 1;
      } else if (roll < 0.75) {
        claimCount = 2;
      } else if (roll < 0.90) {
        claimCount = 3;
      } else if (roll < 0.97) {
        claimCount = 4;
      } else {
        claimCount = 5;
      }

      const product = prng.pick(catalog.products);
      const campaign = prng.pick(catalog.campaigns);
      const channel = prng.pick([
        "instagram",
        "email",
        "packaging",
        "landing_page",
        "amazon_pdp",
        "google_ads",
      ] as const);

      const exampleId = `ex_10a_${String(currentIndex).padStart(5, "0")}`;

      let candidate: Omit<DatasetExample, "human_review">;

      if (claimCount === 0) {
        candidate = this.buildHardNegativeCandidate(
          exampleId,
          campaign,
          product,
          channel,
          prng
        );
      } else {
        candidate = this.buildMultiClaimCandidate(
          exampleId,
          campaign,
          product,
          channel,
          claimCount,
          prng
        );
      }

      // Check content duplication
      if (seenContentHashes.has(candidate.content)) {
        continue;
      }
      seenContentHashes.add(candidate.content);

      // Validate
      const valReport = DatasetValidator.validateCandidate(
        candidate.content,
        candidate.claims
      );

      // Review
      const reviewResult = QualityReviewer.reviewCandidate(
        candidate,
        valReport.errors
      );

      const fullRecord: DatasetExample = {
        ...candidate,
        human_review: reviewResult.audit,
      };

      if (reviewResult.approved && valReport.isValid) {
        approved.push(fullRecord);
        currentIndex++;
      } else {
        rejected.push(fullRecord);
      }
    }

    if (approved.length < targetApprovedCount) {
      console.warn(
        `Warning: Reached ${approved.length}/${targetApprovedCount} approved examples for partition ${catalog.partition}`
      );
    }

    return { approvedExamples: approved, rejectedExamples: rejected };
  }

  /**
   * Generates a batch of deliberately flawed examples to stress-test and prove
   * the automated validation and human-review rejection gates.
   */
  public static generateDeliberatelyFlawedCandidates(
    catalog: PartitionCatalog,
    count: number,
    prng: DeterministicPRNG,
    startExampleIndex: number
  ): DatasetExample[] {
    const flawedList: DatasetExample[] = [];

    const flawTypes = [
      "shifted_offset",
      "truncated_claim_text",
      "hallucinated_claim",
      "mismatched_price_entity",
      "dangling_punctuation",
      "omission_flaw",
      "negative_boundary",
    ];

    for (let i = 0; i < count; i++) {
      const flaw = flawTypes[i % flawTypes.length];
      const product = prng.pick(catalog.products);
      const campaign = prng.pick(catalog.campaigns);
      const channel = prng.pick(["instagram", "email", "packaging"] as const);
      const exampleId = `ex_flaw_${String(startExampleIndex + i).padStart(4, "0")}`;

      const candidate = this.buildMultiClaimCandidate(
        exampleId,
        campaign,
        product,
        channel,
        2,
        prng
      );

      // Inject deliberate flaw
      if (flaw === "shifted_offset" && candidate.claims.length > 0) {
        candidate.claims[0].text_start += 3;
        candidate.claims[0].text_end += 3;
      } else if (flaw === "truncated_claim_text" && candidate.claims.length > 0) {
        candidate.claims[0].claim_text = candidate.claims[0].claim_text.slice(0, -4);
      } else if (flaw === "hallucinated_claim" && candidate.claims.length > 0) {
        candidate.claims[0].claim_text = "contains 99% pure unverified gold extract";
      } else if (flaw === "mismatched_price_entity" && candidate.claims.length > 0) {
        candidate.claims[0].entities = {
          ...candidate.claims[0].entities,
          price: 99999, // Mismatched price
        };
      } else if (flaw === "dangling_punctuation" && candidate.claims.length > 0) {
        candidate.claims[0].claim_text = `, ${candidate.claims[0].claim_text}`;
        candidate.content = `${candidate.content.slice(0, candidate.claims[0].text_start)}, ${candidate.content.slice(candidate.claims[0].text_start)}`;
        candidate.claims[0].text_end += 2;
      } else if (flaw === "omission_flaw") {
        candidate.content = `Special weekend launch! Buy ${product.name} at only ₹1,499 now!`;
        candidate.claims = []; // Deliberate omission of price claim
        candidate.metadata.has_claims = false;
        candidate.metadata.claim_count = 0;
      } else if (flaw === "negative_boundary" && candidate.claims.length > 0) {
        candidate.claims[0].text_start = -2;
      }

      const valReport = DatasetValidator.validateCandidate(
        candidate.content,
        candidate.claims
      );
      const reviewResult = QualityReviewer.reviewCandidate(
        candidate,
        valReport.errors
      );

      flawedList.push({
        ...candidate,
        human_review: reviewResult.audit,
      });
    }

    return flawedList;
  }

  /**
   * Constructs a multi-claim candidate with exact UTF-16 substring slices.
   */
  private static buildMultiClaimCandidate(
    exampleId: string,
    campaignId: string,
    product: CatalogProduct,
    channel: MarketingChannel,
    claimCount: number,
    prng: DeterministicPRNG
  ): Omit<DatasetExample, "human_review"> {
    const channelCfg = CHANNEL_CONFIGS[channel];
    const introTemplate = prng.pick(channelCfg.introTemplates);
    const intro = introTemplate(product.name, product.sku);
    const outro = prng.pick(channelCfg.outroTemplates);

    // Pick distinct claim types for diversity
    const availableTypes = prng.shuffle([...CLAIM_TYPES]);
    const selectedTypes = availableTypes.slice(0, claimCount);

    const segments: Array<{
      prefix: string;
      claimText: string;
      entities: Record<string, unknown>;
      claimType: ClaimType;
      confidence: number;
      isHighRisk?: boolean;
      riskCategory?: string;
    }> = [];

    for (let i = 0; i < selectedTypes.length; i++) {
      const type = selectedTypes[i];
      const templatesForType = ATOMIC_CLAIM_TEMPLATES[type];
      const template = prng.pick(templatesForType);
      const generated = template.generateTextAndEntities(product);

      const prefix = i === 0 ? "" : prng.pick(channelCfg.connectors);

      segments.push({
        prefix,
        claimText: generated.claimText,
        entities: generated.entities,
        claimType: type,
        confidence: generated.confidence,
        isHighRisk: generated.isHighRisk,
        riskCategory: generated.riskCategory,
      });
    }

    // Assemble content sequentially and compute exact offsets
    let accumulated = intro;
    const claims: RawExtractedClaim[] = [];
    let isHighRisk = false;
    let primaryRiskCategory: string | undefined;

    for (const seg of segments) {
      accumulated += seg.prefix;
      const start = accumulated.length;
      accumulated += seg.claimText;
      const end = accumulated.length;

      // Invariant check
      if (accumulated.slice(start, end) !== seg.claimText) {
        throw new Error(
          `UTF-16 offset invariant failure during assembly: expected "${seg.claimText}", got "${accumulated.slice(start, end)}"`
        );
      }

      if (seg.isHighRisk) {
        isHighRisk = true;
        primaryRiskCategory = seg.riskCategory;
      }

      claims.push({
        claim_text: seg.claimText,
        claim_type: seg.claimType,
        text_start: start,
        text_end: end,
        product_hint: product.sku,
        entities: seg.entities,
        extraction_confidence: seg.confidence,
      });
    }

    accumulated += outro;
    const finalContent = accumulated;

    // Verify all spans on the final completed content string
    for (const c of claims) {
      if (finalContent.slice(c.text_start, c.text_end) !== c.claim_text) {
        throw new Error(`Offset shifted after outro append in ${exampleId}`);
      }
    }

    const metadata: ExampleMetadata = {
      has_claims: claims.length > 0,
      claim_count: claims.length,
      claim_types: claims.map((c) => c.claim_type as ClaimType),
      is_hard_negative: false,
      is_ambiguous: prng.nextBool(0.08), // ~8% ambiguous phrasing
      is_high_risk: isHighRisk,
      risk_category: primaryRiskCategory as RiskCategory | undefined,
    };

    const provenance: ProvenanceMetadata = {
      source_type: "synthetic_combinatorial",
      author_or_generator: "BrandShield-DatasetBuilder-v1.0.0",
      generation_seed: 20261106,
      created_at: new Date().toISOString(),
    };

    return {
      example_id: exampleId,
      campaign_id: campaignId,
      product_id: product.sku,
      product_name: product.name,
      channel,
      content: finalContent,
      claims,
      metadata,
      provenance,
    };
  }

  /**
   * Constructs a zero-claim hard negative candidate (lifestyle rhetoric).
   */
  private static buildHardNegativeCandidate(
    exampleId: string,
    campaignId: string,
    product: CatalogProduct,
    channel: MarketingChannel,
    prng: DeterministicPRNG
  ): Omit<DatasetExample, "human_review"> {
    const channelCfg = CHANNEL_CONFIGS[channel];
    const introTemplate = prng.pick(channelCfg.introTemplates);
    const intro = introTemplate(product.name, product.sku);
    const lifestyleRhetoric = prng.pick(HARD_NEGATIVE_TEXTS);
    const outro = prng.pick(channelCfg.outroTemplates);

    const finalContent = `${intro}${lifestyleRhetoric}${outro}`;

    const metadata: ExampleMetadata = {
      has_claims: false,
      claim_count: 0,
      claim_types: [],
      is_hard_negative: true,
      is_ambiguous: false,
      is_high_risk: false,
    };

    const provenance: ProvenanceMetadata = {
      source_type: "curated_public_domain",
      author_or_generator: "BrandShield-DatasetBuilder-v1.0.0",
      generation_seed: 20261106,
      created_at: new Date().toISOString(),
    };

    return {
      example_id: exampleId,
      campaign_id: campaignId,
      product_id: product.sku,
      product_name: product.name,
      channel,
      content: finalContent,
      claims: [],
      metadata,
      provenance,
    };
  }
}
