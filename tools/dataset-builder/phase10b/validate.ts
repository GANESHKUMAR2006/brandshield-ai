/**
 * BrandShield AI — Phase 10B Validation & Manifest Generation Runner
 * Standalone Quality Measurement & Human Review Annotation Engine
 *
 * Verifies evaluation dataset integrity, runs cross-split duplicate audits against
 * Phase 10A outputs, and computes the cryptographic Phase 10B manifest.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { generateRawEvaluationDataset } from "./dataset-raw";
import { Phase10BValidator } from "./validator";
import {
  EvaluationExample,
  Phase10BManifest,
  EvaluationChannel,
} from "./types";
import { ClaimType } from "../../../src/lib/ai/extraction/extraction-schema";

const OUTPUT_DIR = path.join(__dirname, "output");
const DATASET_FILE = path.join(OUTPUT_DIR, "evaluation_dataset.jsonl");
const MANIFEST_FILE = path.join(OUTPUT_DIR, "phase10b-manifest.json");
const PHASE10A_OUTPUT_DIR = path.join(__dirname, "..", "output");

async function runValidationAndManifest() {
  console.log("================================================================================");
  console.log(" BrandShield AI — Phase 10B Real-World Evaluation Dataset Validation");
  console.log("================================================================================\n");

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Load or initialize evaluation dataset
  let examples: EvaluationExample[] = [];
  if (fs.existsSync(DATASET_FILE)) {
    console.log(`[1/4] Loading existing evaluation dataset from ${path.basename(DATASET_FILE)}...`);
    const lines = fs.readFileSync(DATASET_FILE, "utf8").trim().split("\n");
    examples = lines.filter(Boolean).map((l) => JSON.parse(l));
  } else {
    console.log(`[1/4] Initializing fresh raw evaluation dataset (120 curated candidates)...`);
    examples = generateRawEvaluationDataset();
    const content = examples.map((ex) => JSON.stringify(ex)).join("\n") + "\n";
    fs.writeFileSync(DATASET_FILE, content, "utf8");
    console.log(`      Wrote ${examples.length} records to ${DATASET_FILE}.`);
  }

  // 2. Validate all records & UTF-16 offset invariants
  console.log(`[2/4] Validating UTF-16 offsets and review status invariants...`);
  const valResult = Phase10BValidator.validateCollection(examples);

  if (!valResult.isValid) {
    console.error("FATAL: Evaluation dataset validation failed with errors:");
    for (const err of valResult.errors) {
      console.error(`  ✗ ${err}`);
    }
    process.exit(1);
  }
  console.log(`      Validation passed! 0 offset errors across ${valResult.totalClaims} claims in ${valResult.totalExamples} records.`);

  // 3. Cross-dataset leakage & deduplication audit
  console.log(`[3/4] Performing cross-split deduplication audit against Phase 10A outputs...`);
  const crossAudit = Phase10BValidator.auditCrossSplitLeakage(examples, PHASE10A_OUTPUT_DIR);

  if (!crossAudit.isClean) {
    console.error("FATAL: Cross-split leakage detected!");
    console.error(`  - Duplicates with Phase 10A Train: ${crossAudit.exactDuplicatesWith10aTrain}`);
    console.error(`  - Duplicates with Phase 10A Val:   ${crossAudit.exactDuplicatesWith10aVal}`);
    console.error(`  - Duplicates with Phase 10A Test:  ${crossAudit.exactDuplicatesWith10aTest}`);
    console.error(`  - Intra-10B duplicates:            ${crossAudit.intra10bDuplicates}`);
    process.exit(1);
  }
  console.log(`      Deduplication confirmed! 0 duplicate strings with Phase 10A (Max Jaccard: ${crossAudit.maxJaccardWithPhase10a}).`);

  // 4. Compute distributions and metrics
  console.log(`[4/4] Generating cryptographic manifest and summary metrics...`);

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

  for (const ex of examples) {
    for (const c of ex.claims) {
      if (c.claim_type in categoryCounts) {
        categoryCounts[c.claim_type as ClaimType]++;
      }
    }
  }

  const channelCounts: Record<EvaluationChannel, number> = {
    social_media_ad: 0,
    landing_page: 0,
    ecommerce_pdp: 0,
    email_promotion: 0,
    packaging: 0,
    search_ad: 0,
  };

  for (const ex of examples) {
    if (ex.channel in channelCounts) {
      channelCounts[ex.channel]++;
    }
  }

  let zeroClaimCount = 0;
  let singleClaimCount = 0;
  let multiClaimCount = 0;
  let ambiguousCount = 0;
  let numericalCount = 0;
  let promoConditionCount = 0;
  let highRiskCount = 0;

  for (const ex of examples) {
    if (ex.claims.length === 0) zeroClaimCount++;
    else if (ex.claims.length === 1) singleClaimCount++;
    else multiClaimCount++;

    if (ex.metadata.has_ambiguity) ambiguousCount++;
    if (ex.metadata.has_numerical_claim) numericalCount++;
    if (ex.metadata.has_promotional_conditions) promoConditionCount++;
    if (ex.metadata.has_high_risk_language) highRiskCount++;
  }

  const fileBuf = fs.readFileSync(DATASET_FILE);
  const sha256 = crypto.createHash("sha256").update(fileBuf).digest("hex");

  // Reviewer audit log
  const reviewerMap = new Map<string, { email: string; count: number; lastActive: string }>();
  for (const ex of examples) {
    const ann = ex.human_annotation;
    if (ann.reviewer_name && ann.review_status !== "unreviewed") {
      const key = ann.reviewer_name;
      const cur = reviewerMap.get(key) || { email: ann.reviewer_email || "", count: 0, lastActive: "" };
      cur.count++;
      if (!cur.lastActive || (ann.reviewed_at && ann.reviewed_at > cur.lastActive)) {
        cur.lastActive = ann.reviewed_at || "";
      }
      reviewerMap.set(key, cur);
    }
  }

  const manifest: Phase10BManifest = {
    manifest_version: "1.0.0",
    dataset_name: "brandshield_realworld_evaluation_v1",
    created_at: new Date().toISOString(),
    file_name: path.basename(DATASET_FILE),
    file_size_bytes: fileBuf.length,
    sha256,
    statistics: {
      total_prepared: examples.length,
      genuinely_reviewed_by_humans: valResult.humanReviewedApprovedCount + valResult.humanReviewedModifiedCount,
      ai_audited_approved_count: valResult.aiAuditedApprovedCount,
      ai_audited_modified_count: valResult.aiAuditedModifiedCount,
      needs_human_adjudication_count: valResult.needsHumanAdjudicationCount,
      awaiting_human_review: valResult.unreviewedCount,
      rejected_count: valResult.rejectedCount,
      status_breakdown: valResult.statusBreakdown,
      category_counts: categoryCounts,
      channel_counts: channelCounts,
      zero_claim_count: zeroClaimCount,
      single_claim_count: singleClaimCount,
      multi_claim_count: multiClaimCount,
      ambiguous_count: ambiguousCount,
      numerical_claim_count: numericalCount,
      promotional_condition_count: promoConditionCount,
      high_risk_count: highRiskCount,
    },
    cross_split_leakage_audit: {
      exact_duplicates_with_phase10a_train: crossAudit.exactDuplicatesWith10aTrain,
      exact_duplicates_with_phase10a_val: crossAudit.exactDuplicatesWith10aVal,
      exact_duplicates_with_phase10a_test: crossAudit.exactDuplicatesWith10aTest,
      intra_phase10b_duplicates: crossAudit.intra10bDuplicates,
      max_jaccard_similarity_with_phase10a: crossAudit.maxJaccardWithPhase10a,
    },
    reviewer_audit_log: Array.from(reviewerMap.entries()).map(([name, meta]) => ({
      reviewer_name: name,
      reviewer_email: meta.email,
      reviews_completed: meta.count,
      last_active: meta.lastActive,
    })),
  };

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), "utf8");

  console.log("\n================================================================================");
  console.log(" PHASE 10B EVALUATION DATASET AUDIT SUMMARY");
  console.log("================================================================================");
  console.log(`Total Prepared Examples:       ${manifest.statistics.total_prepared}`);
  console.log(`Genuinely Reviewed by Humans:  ${manifest.statistics.genuinely_reviewed_by_humans} (${manifest.statistics.status_breakdown.reviewed_approved} approved, ${manifest.statistics.status_breakdown.reviewed_modified} modified)`);
  console.log(`AI Compliance Audited:         ${manifest.statistics.ai_audited_approved_count + manifest.statistics.ai_audited_modified_count} (${manifest.statistics.ai_audited_approved_count} approved, ${manifest.statistics.ai_audited_modified_count} modified)`);
  console.log(`Needs Human Adjudication:      ${manifest.statistics.needs_human_adjudication_count}`);
  console.log(`Awaiting Review (Unreviewed):  ${manifest.statistics.awaiting_human_review}`);
  console.log(`Rejected Candidates:           ${manifest.statistics.rejected_count}`);
  console.log(`Total Proposed Claims:         ${valResult.totalClaims} across all 10 categories`);
  console.log(`Zero-Claim (Hard Negatives):   ${manifest.statistics.zero_claim_count}`);
  console.log(`Single-Claim Records:          ${manifest.statistics.single_claim_count}`);
  console.log(`Multi-Claim Records:           ${manifest.statistics.multi_claim_count}`);
  console.log(`Ambiguous Wording Records:     ${manifest.statistics.ambiguous_count}`);
  console.log(`Numerical Claims Records:      ${manifest.statistics.numerical_claim_count}`);
  console.log(`Promotional Condition Records: ${manifest.statistics.promotional_condition_count}`);
  console.log(`High-Risk Assertion Records:   ${manifest.statistics.high_risk_count}`);
  console.log("\nClaim Category Distribution:");
  for (const [cat, count] of Object.entries(manifest.statistics.category_counts)) {
    console.log(`  - ${cat.padEnd(20)}: ${count}`);
  }
  console.log("\nChannel Distribution:");
  for (const [ch, count] of Object.entries(manifest.statistics.channel_counts)) {
    console.log(`  - ${ch.padEnd(20)}: ${count}`);
  }
  console.log(`\nFile SHA-256: ${manifest.sha256} (${manifest.file_size_bytes} bytes)`);
  console.log("================================================================================\n");
}

runValidationAndManifest().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
