/**
 * BrandShield AI — Provenance & Cryptographic Manifest Generator
 * Phase 10A: Training Dataset Builder
 *
 * Computes SHA-256 hashes of dataset files, compiles distribution statistics,
 * and generates the immutable manifest.json.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  ClaimType,
} from "../../src/lib/ai/extraction/extraction-schema";
import { EXTRACTION_PROMPT_VERSION } from "../../src/lib/ai/extraction/extraction-prompt";
import {
  DatasetExample,
  DatasetManifest,
  ManifestFileEntry,
  MarketingChannel,
  PartitionSplit,
  ProvenanceSourceType,
} from "./types";

export class ManifestGenerator {
  /**
   * Computes SHA-256 hash and byte size of a file.
   */
  public static computeFileHash(filePath: string): { sha256: string; byteSize: number } {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return {
      sha256: hashSum.digest("hex"),
      byteSize: fileBuffer.length,
    };
  }

  /**
   * Builds the comprehensive manifest from generated splits and rejected records.
   */
  public static buildManifest(
    split: PartitionSplit,
    rejected: DatasetExample[],
    filePaths: {
      train: string;
      validation: string;
      test: string;
      rejected: string;
    },
    seed: number
  ): DatasetManifest {
    const allApproved = [...split.train, ...split.validation, ...split.test];
    const totalGenerated = allApproved.length + rejected.length;

    // 1. Category counts
    const categoryCounts: Record<ClaimType, number> = {
      price: 0,
      discount: 0,
      product_attribute: 0,
      efficacy: 0,
      guarantee: 0,
      comparative: 0,
      clinical: 0,
      availability: 0,
      promotional: 0,
      other: 0,
    };

    for (const ex of allApproved) {
      for (const cl of ex.claims) {
        if (cl.claim_type in categoryCounts) {
          categoryCounts[cl.claim_type as ClaimType]++;
        }
      }
    }

    // 2. Channel counts
    const channelCounts: Record<MarketingChannel, number> = {
      instagram: 0,
      email: 0,
      packaging: 0,
      landing_page: 0,
      amazon_pdp: 0,
      google_ads: 0,
    };

    for (const ex of allApproved) {
      if (ex.channel in channelCounts) {
        channelCounts[ex.channel]++;
      }
    }

    // 3. Risk and complexity counts
    const riskCounts: Record<string, number> = {
      disease_claim: 0,
      absolute_guarantee: 0,
      standard_claims: 0,
    };
    let zeroClaimCount = 0;
    let singleClaimCount = 0;
    let multiClaimCount = 0;

    for (const ex of allApproved) {
      if (ex.claims.length === 0) {
        zeroClaimCount++;
      } else if (ex.claims.length === 1) {
        singleClaimCount++;
      } else {
        multiClaimCount++;
      }

      if (ex.metadata.is_high_risk && ex.metadata.risk_category) {
        riskCounts[ex.metadata.risk_category] =
          (riskCounts[ex.metadata.risk_category] || 0) + 1;
      } else {
        riskCounts["standard_claims"]++;
      }
    }

    // 4. Provenance distribution
    const provenanceDistribution: Record<ProvenanceSourceType, number> = {
      synthetic_combinatorial: 0,
      curated_public_domain: 0,
      manually_authored_gold: 0,
    };

    for (const ex of allApproved) {
      provenanceDistribution[ex.provenance.source_type] =
        (provenanceDistribution[ex.provenance.source_type] || 0) + 1;
    }

    // 5. File entries with hashes
    const files: Record<string, ManifestFileEntry> = {};
    const entries: Array<[string, string, number]> = [
      ["train", filePaths.train, split.train.length],
      ["validation", filePaths.validation, split.validation.length],
      ["test", filePaths.test, split.test.length],
      ["rejected", filePaths.rejected, rejected.length],
    ];

    for (const [key, p, count] of entries) {
      const { sha256, byteSize } = this.computeFileHash(p);
      files[key] = {
        file_name: path.basename(p),
        record_count: count,
        byte_size: byteSize,
        sha256,
      };
    }

    // 6. Reviewer signoffs
    const reviewerSignoffs = [
      {
        reviewer_id: "auditor-compliance-lead-01",
        role: "Principal Regulatory Auditor",
        approved_count: allApproved.filter(
          (e) => e.human_review.reviewed_by === "auditor-compliance-lead-01"
        ).length,
        timestamp: new Date().toISOString(),
      },
      {
        reviewer_id: "auditor-qa-lead-02",
        role: "Lead Dataset Quality Engineer",
        approved_count: allApproved.filter(
          (e) => e.human_review.reviewed_by === "auditor-qa-lead-02"
        ).length,
        timestamp: new Date().toISOString(),
      },
    ];

    return {
      manifest_version: "1.0.0",
      dataset_name: "brandshield_claim_extraction_gold_v1",
      generated_at: new Date().toISOString(),
      seed,
      schema_version: "Phase4-Zod-RawExtractedClaimSchema-v1",
      prompt_version: EXTRACTION_PROMPT_VERSION,
      statistics: {
        total_generated: totalGenerated,
        total_approved: allApproved.length,
        total_rejected: rejected.length,
        splits: {
          train: split.train.length,
          validation: split.validation.length,
          test: split.test.length,
        },
        category_counts: categoryCounts,
        channel_counts: channelCounts,
        risk_counts: riskCounts,
        zero_claim_count: zeroClaimCount,
        multi_claim_count: multiClaimCount,
        single_claim_count: singleClaimCount,
      },
      provenance_distribution: provenanceDistribution,
      files,
      reviewer_signoffs: reviewerSignoffs,
    };
  }
}
