/**
 * BrandShield AI — Partition Verification & Export Coordinator
 * Phase 10A: Training Dataset Builder
 *
 * Verifies strict disjoint partitioning between Train, Validation, and Test.
 * Guarantees zero campaign, product, or verbatim content leakage.
 */

import * as fs from "fs";
import * as path from "path";
import { DatasetExample, PartitionSplit } from "./types";

export interface PartitionVerificationResult {
  isDisjoint: boolean;
  errors: string[];
  trainCount: number;
  validationCount: number;
  testCount: number;
  totalApproved: number;
}

export class Partitioner {
  /**
   * Strictly verifies that train, validation, and test splits have:
   * 1. No shared campaigns
   * 2. No shared products / SKUs
   * 3. No shared content (zero verbatim marketing text duplication)
   */
  public static verifyDisjointness(split: PartitionSplit): PartitionVerificationResult {
    const errors: string[] = [];

    const trainCampaigns = new Set(split.train.map((e) => e.campaign_id));
    const valCampaigns = new Set(split.validation.map((e) => e.campaign_id));
    const testCampaigns = new Set(split.test.map((e) => e.campaign_id));

    const trainProducts = new Set(split.train.map((e) => e.product_id));
    const valProducts = new Set(split.validation.map((e) => e.product_id));
    const testProducts = new Set(split.test.map((e) => e.product_id));

    const trainContents = new Set(split.train.map((e) => e.content));
    const valContents = new Set(split.validation.map((e) => e.content));
    const testContents = new Set(split.test.map((e) => e.content));

    // Check Campaign overlaps
    for (const c of valCampaigns) {
      if (trainCampaigns.has(c)) {
        errors.push(`Campaign leakage: "${c}" appears in both Train and Validation`);
      }
    }
    for (const c of testCampaigns) {
      if (trainCampaigns.has(c)) {
        errors.push(`Campaign leakage: "${c}" appears in both Train and Test`);
      }
      if (valCampaigns.has(c)) {
        errors.push(`Campaign leakage: "${c}" appears in both Validation and Test`);
      }
    }

    // Check Product overlaps
    for (const p of valProducts) {
      if (trainProducts.has(p)) {
        errors.push(`Product SKU leakage: "${p}" appears in both Train and Validation`);
      }
    }
    for (const p of testProducts) {
      if (trainProducts.has(p)) {
        errors.push(`Product SKU leakage: "${p}" appears in both Train and Test`);
      }
      if (valProducts.has(p)) {
        errors.push(`Product SKU leakage: "${p}" appears in both Validation and Test`);
      }
    }

    // Check Content duplicates
    for (const content of valContents) {
      if (trainContents.has(content)) {
        errors.push("Verbatim content leakage detected between Train and Validation");
        break;
      }
    }
    for (const content of testContents) {
      if (trainContents.has(content)) {
        errors.push("Verbatim content leakage detected between Train and Test");
        break;
      }
      if (valContents.has(content)) {
        errors.push("Verbatim content leakage detected between Validation and Test");
        break;
      }
    }

    return {
      isDisjoint: errors.length === 0,
      errors,
      trainCount: split.train.length,
      validationCount: split.validation.length,
      testCount: split.test.length,
      totalApproved: split.train.length + split.validation.length + split.test.length,
    };
  }

  /**
   * Writes partition arrays to JSONL files.
   */
  public static writeJsonl(filePath: string, examples: DatasetExample[]): {
    filePath: string;
    recordCount: number;
    byteSize: number;
  } {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = examples.map((ex) => JSON.stringify(ex)).join("\n") + "\n";
    fs.writeFileSync(filePath, content, { encoding: "utf8" });

    const stat = fs.statSync(filePath);
    return {
      filePath,
      recordCount: examples.length,
      byteSize: stat.size,
    };
  }
}
