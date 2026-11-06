/**
 * BrandShield AI — Phase 10B Interactive & CLI Human Annotation Workflow
 * Standalone Quality Measurement & Human Review Annotation Engine
 *
 * Provides a dedicated review interface for human compliance auditors to:
 * - Review proposed claim spans and UTF-16 offsets
 * - Correct, add, or delete claims with automatic UTF-16 recalculation
 * - Edit claim entities, categories, and product associations
 * - View before/after preview diffs before committing
 * - Inspect previous AI audit decisions, rationale, and change log history
 * - Approve, modify, flag for adjudication, or skip records
 * - Record real human identities and ISO timestamps into an immutable audit trail
 *
 * STRICTURE: Unreviewed or AI-audited records remain distinct from human decisions.
 * Human review preserves all prior AI history without erasing provenance.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as readline from "readline";
import {
  EvaluationExample,
  EvaluationClaim,
  ReviewChangeLogEntry,
  Phase10BManifest,
  EvaluationChannel,
} from "./types";
import { Phase10BValidator } from "./validator";
import { ClaimType, CLAIM_TYPES, ClaimEntities } from "../../../src/lib/ai/extraction/extraction-schema";

const DEFAULT_FILE_PATH = path.join(__dirname, "output", "evaluation_dataset.jsonl");
const MANIFEST_PATH = path.join(__dirname, "output", "phase10b-manifest.json");
const PHASE10A_OUTPUT_DIR = path.join(__dirname, "..", "output");

export class ReviewWorkflowManager {
  private filePath: string;
  private manifestPath: string;

  constructor(filePath: string = DEFAULT_FILE_PATH, manifestPath: string = MANIFEST_PATH) {
    this.filePath = filePath;
    this.manifestPath = manifestPath;
  }

  public loadDataset(): EvaluationExample[] {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Evaluation dataset not found at ${this.filePath}. Run validate.ts first to initialize.`);
    }
    const lines = fs.readFileSync(this.filePath, "utf8").trim().split("\n");
    return lines.filter(Boolean).map((line) => JSON.parse(line));
  }

  public saveDataset(examples: EvaluationExample[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = examples.map((ex) => JSON.stringify(ex)).join("\n") + "\n";
    fs.writeFileSync(this.filePath, content, "utf8");
  }

  public getExample(exampleId: string): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }
    return target;
  }

  /**
   * Calculates exact UTF-16 offsets for an exact substring in content.
   */
  public findSubstringOffsets(content: string, substring: string): { start: number; end: number } {
    const start = content.indexOf(substring);
    if (start === -1) {
      throw new Error(`Substring "${substring}" not found in original content.`);
    }
    const end = start + substring.length;
    if (content.slice(start, end) !== substring) {
      throw new Error(`Invariant failure: content.slice(${start}, ${end}) does not match substring.`);
    }
    return { start, end };
  }

  /**
   * Helper to construct and validate a new claim for an example.
   */
  public createClaim(
    example: EvaluationExample,
    claimText: string,
    claimType: ClaimType,
    entities: ClaimEntities = {},
    productHint: string | null = null,
    claimIndex?: number
  ): EvaluationClaim {
    const offsets = this.findSubstringOffsets(example.content, claimText);
    const idx = claimIndex !== undefined ? claimIndex : example.claims.length + 1;
    const claim: EvaluationClaim = {
      claim_id: `${example.example_id}_c${idx}`,
      claim_text: claimText,
      claim_type: claimType,
      text_start: offsets.start,
      text_end: offsets.end,
      product_hint: productHint !== undefined ? productHint : (example.product_id || null),
      entities: entities || {},
      extraction_confidence: 1.0,
      annotation_state: "human_added",
    };

    const errs = Phase10BValidator.validateClaim(claim, example.content, example.example_id, idx);
    if (errs.length > 0) {
      throw new Error(`Claim validation failed: ${errs.join("; ")}`);
    }

    return claim;
  }

  /**
   * Records genuine human verification and approval of an existing AI or draft candidate.
   * Preserves previous AI audit history in change_log and previous_ai_audit.
   */
  public recordHumanVerification(
    exampleId: string,
    reviewerName: string,
    reviewerEmail: string,
    notes: string = ""
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const beforeSnapshot = JSON.parse(JSON.stringify(target.claims));

    // Archive previous AI audit if present without erasing
    const isAi =
      target.human_annotation.reviewer_name?.includes("AI") ||
      target.human_annotation.review_status.startsWith("ai_") ||
      target.human_annotation.review_status === "needs_human_adjudication";
    const previousAiAudit = isAi
      ? {
          review_status: target.human_annotation.review_status,
          reviewer_name: target.human_annotation.reviewer_name || "AI Auditor",
          reviewer_email: target.human_annotation.reviewer_email || "",
          reviewed_at: target.human_annotation.reviewed_at || "",
          review_notes: target.human_annotation.review_notes || "",
        }
      : target.human_annotation.previous_ai_audit;

    const entry: ReviewChangeLogEntry = {
      action: "human_verified",
      timestamp,
      reviewer_name: reviewerName,
      details: notes || "Human compliance auditor verified and confirmed all claims and spans verbatim.",
      before_snapshot: beforeSnapshot,
      after_snapshot: beforeSnapshot,
    };

    target.human_annotation = {
      review_status: "human_verified",
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      reviewed_at: timestamp,
      review_notes: notes || "Human compliance audit verified and approved all spans and categories.",
      previous_ai_audit: previousAiAudit,
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    target.claims.forEach((c) => {
      c.annotation_state = "human_verified";
    });

    this.saveDataset(examples);
    this.refreshManifest(examples);
    return target;
  }

  /**
   * Records human modification and approval of an evaluation candidate.
   * Preserves previous AI audit history in change_log and previous_ai_audit.
   */
  public recordHumanModification(
    exampleId: string,
    reviewerName: string,
    reviewerEmail: string,
    modifiedClaims: EvaluationClaim[],
    notes: string,
    updatedProductId?: string | null,
    actionType: ReviewChangeLogEntry["action"] = "human_modified"
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    // Verify all modified claims strictly against target content
    for (let i = 0; i < modifiedClaims.length; i++) {
      const errs = Phase10BValidator.validateClaim(modifiedClaims[i], target.content, exampleId, i);
      if (errs.length > 0) {
        throw new Error(`Validation failed for modified claim: ${errs.join("; ")}`);
      }
    }

    const timestamp = new Date().toISOString();
    const beforeSnapshot = JSON.parse(JSON.stringify(target.claims));
    const afterSnapshot = JSON.parse(JSON.stringify(modifiedClaims));

    // Archive previous AI audit if present without erasing
    const isAi =
      target.human_annotation.reviewer_name?.includes("AI") ||
      target.human_annotation.review_status.startsWith("ai_") ||
      target.human_annotation.review_status === "needs_human_adjudication";
    const previousAiAudit = isAi
      ? {
          review_status: target.human_annotation.review_status,
          reviewer_name: target.human_annotation.reviewer_name || "AI Auditor",
          reviewer_email: target.human_annotation.reviewer_email || "",
          reviewed_at: target.human_annotation.reviewed_at || "",
          review_notes: target.human_annotation.review_notes || "",
        }
      : target.human_annotation.previous_ai_audit;

    const status = isAi ? "human_modified" : "reviewed_modified";
    const action = actionType || (isAi ? "human_modified" : "modified_claim");

    const entry: ReviewChangeLogEntry = {
      action,
      timestamp,
      reviewer_name: reviewerName,
      details: notes,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot,
    };

    if (updatedProductId !== undefined) {
      target.product_id = updatedProductId;
    }

    target.claims = modifiedClaims;
    target.metadata.claim_count = modifiedClaims.length;
    target.metadata.has_claims = modifiedClaims.length > 0;
    target.metadata.claim_types = Array.from(new Set(modifiedClaims.map((c) => c.claim_type)));
    target.metadata.has_numerical_claim = modifiedClaims.some((c) => /\d/.test(c.claim_text));
    target.metadata.has_promotional_conditions = modifiedClaims.some(
      (c) => c.claim_type === "promotional" || c.claim_type === "discount"
    );

    target.human_annotation = {
      review_status: status,
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      reviewed_at: timestamp,
      review_notes: notes,
      previous_ai_audit: previousAiAudit,
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    this.saveDataset(examples);
    this.refreshManifest(examples);
    return target;
  }

  /**
   * Records human flagging of an example for further adjudication or legal review.
   */
  public recordHumanAdjudicationFlag(
    exampleId: string,
    reviewerName: string,
    reviewerEmail: string,
    rationale: string
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const beforeSnapshot = JSON.parse(JSON.stringify(target.claims));

    const entry: ReviewChangeLogEntry = {
      action: "flagged_ambiguous",
      timestamp,
      reviewer_name: reviewerName,
      details: rationale,
      before_snapshot: beforeSnapshot,
      after_snapshot: beforeSnapshot,
    };

    target.human_annotation = {
      review_status: "needs_human_adjudication",
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      reviewed_at: timestamp,
      review_notes: rationale,
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    target.claims.forEach((c) => {
      c.annotation_state = "flagged_ambiguous";
    });
    target.metadata.has_ambiguity = true;

    this.saveDataset(examples);
    this.refreshManifest(examples);
    return target;
  }

  /**
   * Records human rejection of an evaluation candidate.
   */
  public recordHumanRejection(
    exampleId: string,
    reviewerName: string,
    reviewerEmail: string,
    rejectionReason: string
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const entry: ReviewChangeLogEntry = {
      action: "rejected",
      timestamp,
      reviewer_name: reviewerName,
      details: rejectionReason,
    };

    target.human_annotation = {
      review_status: "rejected",
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      reviewed_at: timestamp,
      review_notes: rejectionReason,
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    this.saveDataset(examples);
    this.refreshManifest(examples);
    return target;
  }

  /**
   * Refreshes the cryptographic manifest after confirmed human review changes.
   */
  public refreshManifest(examples: EvaluationExample[]): void {
    if (path.resolve(this.filePath) !== path.resolve(DEFAULT_FILE_PATH)) {
      return; // Do not touch production manifest during tests on temporary datasets!
    }
    const valResult = Phase10BValidator.validateCollection(examples);
    const crossAudit = Phase10BValidator.auditCrossSplitLeakage(examples, PHASE10A_OUTPUT_DIR);

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

    const fileBuf = fs.readFileSync(this.filePath);
    const sha256 = crypto.createHash("sha256").update(fileBuf).digest("hex");

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
      file_name: path.basename(this.filePath),
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

    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }

  /**
   * Helper for raw batch approval.
   */
  public recordHumanApproval(
    exampleId: string,
    reviewerName: string,
    reviewerEmail: string,
    notes: string = ""
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const beforeSnapshot = JSON.parse(JSON.stringify(target.claims));
    const entry: ReviewChangeLogEntry = {
      action: "approved",
      timestamp,
      reviewer_name: reviewerName,
      details: notes || "Approved verbatim draft claims without modifications.",
      before_snapshot: beforeSnapshot,
      after_snapshot: beforeSnapshot,
    };

    target.human_annotation = {
      review_status: "reviewed_approved",
      reviewer_name: reviewerName,
      reviewer_email: reviewerEmail,
      reviewed_at: timestamp,
      review_notes: notes || "Human compliance audit confirmed all spans and categories.",
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    target.claims.forEach((c) => {
      c.annotation_state = "human_verified";
    });

    this.saveDataset(examples);
    this.refreshManifest(examples);
    return target;
  }

  /**
   * Records an explicit AI Compliance Audit decision.
   */
  public recordAiAuditDecision(
    exampleId: string,
    decisionStatus: "ai_audited_approved" | "ai_audited_modified" | "needs_human_adjudication",
    auditorName: string,
    auditorEmail: string,
    notes: string,
    updatedClaims?: EvaluationClaim[],
    updatedProductId?: string | null
  ): EvaluationExample {
    const examples = this.loadDataset();
    const target = examples.find((e) => e.example_id === exampleId);
    if (!target) {
      throw new Error(`Example ${exampleId} not found.`);
    }

    const timestamp = new Date().toISOString();
    const beforeSnapshot = JSON.parse(JSON.stringify(target.claims));

    if (updatedClaims) {
      for (let i = 0; i < updatedClaims.length; i++) {
        const errs = Phase10BValidator.validateClaim(updatedClaims[i], target.content, exampleId, i);
        if (errs.length > 0) {
          throw new Error(`Validation failed for claim ${i}: ${errs.join("; ")}`);
        }
      }
      target.claims = updatedClaims;
      target.metadata.claim_count = updatedClaims.length;
      target.metadata.has_claims = updatedClaims.length > 0;
      target.metadata.claim_types = Array.from(new Set(updatedClaims.map((c) => c.claim_type)));
      target.metadata.has_numerical_claim = updatedClaims.some((c) => /\d/.test(c.claim_text));
      target.metadata.has_promotional_conditions = updatedClaims.some(
        (c) => c.claim_type === "promotional" || c.claim_type === "discount"
      );
    }

    if (updatedProductId !== undefined) {
      target.product_id = updatedProductId;
    }

    const afterSnapshot = JSON.parse(JSON.stringify(target.claims));

    let action: ReviewChangeLogEntry["action"];
    if (decisionStatus === "ai_audited_approved") {
      action = "ai_audited_approved";
      target.claims.forEach((c) => {
        c.annotation_state = "ai_audited_verified";
      });
    } else if (decisionStatus === "ai_audited_modified") {
      action = "ai_audited_modified";
      target.claims.forEach((c) => {
        if (c.annotation_state === "draft_proposal") {
          c.annotation_state = "ai_audited_corrected";
        }
      });
    } else {
      action = "flagged_ambiguous";
      target.claims.forEach((c) => {
        c.annotation_state = "flagged_ambiguous";
      });
      target.metadata.has_ambiguity = true;
    }

    const entry: ReviewChangeLogEntry = {
      action,
      timestamp,
      reviewer_name: auditorName,
      details: notes,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot,
    };

    target.human_annotation = {
      review_status: decisionStatus,
      reviewer_name: auditorName,
      reviewer_email: auditorEmail,
      reviewed_at: timestamp,
      review_notes: notes,
      change_log: [...(target.human_annotation.change_log || []), entry],
    };

    this.saveDataset(examples);
    return target;
  }
}

// -----------------------------------------------------------------------------
// Interactive Review Session
// -----------------------------------------------------------------------------

function formatDiffPreview(
  originalEx: EvaluationExample,
  currentClaims: EvaluationClaim[],
  currentProductId: string | null
): string {
  const lines: string[] = [];
  lines.push("\n--- BEFORE / AFTER DIFF PREVIEW ---");
  lines.push(`Product SKU: [Before: ${originalEx.product_id || "null"}] -> [After: ${currentProductId || "null"}]`);
  lines.push(`Claim Count: [Before: ${originalEx.claims.length}] -> [After: ${currentClaims.length}]`);
  lines.push("Original Claims:");
  if (originalEx.claims.length === 0) {
    lines.push("  (None)");
  } else {
    originalEx.claims.forEach((c, idx) => {
      lines.push(`  [${idx + 1}] (${c.claim_type}) "${c.claim_text}" [${c.text_start}..${c.text_end}]`);
    });
  }
  lines.push("Modified/Current Claims:");
  if (currentClaims.length === 0) {
    lines.push("  (None — 0-claim hard negative)");
  } else {
    currentClaims.forEach((c, idx) => {
      lines.push(`  [${idx + 1}] (${c.claim_type}) "${c.claim_text}" [${c.text_start}..${c.text_end}] (state: ${c.annotation_state})`);
    });
  }
  lines.push("-----------------------------------\n");
  return lines.join("\n");
}

export function filterReviewQueue(
  examples: EvaluationExample[],
  options: {
    queue?: string;
    exampleId?: string;
    batch?: number;
    offset?: number;
  }
): EvaluationExample[] {
  // If specific example ID requested
  if (options.exampleId) {
    const single = examples.filter((e) => e.example_id === options.exampleId);
    if (single.length === 0) {
      throw new Error(`Example ${options.exampleId} not found in dataset.`);
    }
    return single;
  }

  const q = options.queue?.toLowerCase() || "adjudication";
  let pool: EvaluationExample[] = [];

  if (q === "adjudication" || q === "p1" || q === "priority1" || q === "ambiguous") {
    // Priority 1: 7 ambiguous records
    pool = examples.filter((e) => e.human_annotation.review_status === "needs_human_adjudication");
  } else if (q === "modified" || q === "p2" || q === "priority2") {
    // Priority 2: 7 AI-modified regression records
    pool = examples.filter((e) => e.human_annotation.review_status === "ai_audited_modified");
  } else if (q === "approved" || q === "p3" || q === "priority3") {
    // Priority 3: 88 AI-approved verbatim records
    pool = examples.filter((e) => e.human_annotation.review_status === "ai_audited_approved");
  } else if (q === "all-ai" || q === "ai") {
    // All AI audited records
    pool = examples.filter(
      (e) =>
        e.human_annotation.review_status === "needs_human_adjudication" ||
        e.human_annotation.review_status === "ai_audited_modified" ||
        e.human_annotation.review_status === "ai_audited_approved"
    );
  } else if (q === "unreviewed") {
    pool = examples.filter((e) => e.human_annotation.review_status === "unreviewed");
  } else {
    // Default queue order: Priority 1 first, then Priority 2, then Priority 3
    const p1 = examples.filter((e) => e.human_annotation.review_status === "needs_human_adjudication");
    const p2 = examples.filter((e) => e.human_annotation.review_status === "ai_audited_modified");
    const p3 = examples.filter((e) => e.human_annotation.review_status === "ai_audited_approved");
    pool = [...p1, ...p2, ...p3];
  }

  // Apply batching / pagination
  const offset = options.offset || 0;
  if (offset > 0 || (options.batch && options.batch > 0)) {
    const end = options.batch ? offset + options.batch : undefined;
    pool = pool.slice(offset, end);
  }

  return pool;
}

async function runInteractiveSession(
  manager: ReviewWorkflowManager,
  reviewerName: string,
  reviewerEmail: string,
  queueOptions: {
    queue?: string;
    exampleId?: string;
    batch?: number;
    offset?: number;
  }
): Promise<void> {
  const allExamples = manager.loadDataset();
  const queue = filterReviewQueue(allExamples, queueOptions);

  if (queue.length === 0) {
    console.log(`\nNo examples found matching queue criteria ("${queueOptions.queue || "default"}").`);
    console.log("All items in this queue may have already been reviewed!");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  console.log("================================================================================");
  console.log(` BrandShield AI — Interactive Manual Human Review Session`);
  console.log(` Reviewer:     ${reviewerName} (${reviewerEmail})`);
  console.log(` Active Queue: ${queueOptions.queue || (queueOptions.exampleId ? "single-example" : "adjudication")} (${queue.length} records)`);
  console.log("================================================================================\n");

  for (let i = 0; i < queue.length; i++) {
    const ex = queue[i];
    console.log("================================================================================");
    console.log(`[Queue: Item ${i + 1} of ${queue.length}] ${ex.example_id} | Channel: ${ex.channel}`);
    console.log(`Brand/Product: ${ex.brand_or_product_name}${ex.product_id ? ` (SKU: ${ex.product_id})` : " (Product SKU: Unassigned/Ambiguous)"}`);
    console.log(`Status:        ${ex.human_annotation.review_status.toUpperCase()}`);
    console.log(`Last Auditor:  ${ex.human_annotation.reviewer_name || "None"} (${ex.human_annotation.reviewed_at || "N/A"})`);
    console.log("--------------------------------------------------------------------------------");
    console.log("ORIGINAL MARKETING CONTENT:");
    console.log(`"${ex.content}"`);
    console.log("--------------------------------------------------------------------------------");
    console.log("PREVIOUS AUDIT DECISION & NOTES:");
    console.log(`${ex.human_annotation.review_notes || "(None)"}`);

    // Previous modifications / change log preview
    if (ex.human_annotation.change_log && ex.human_annotation.change_log.length > 0) {
      console.log("--------------------------------------------------------------------------------");
      console.log(`AUDIT TRAIL (${ex.human_annotation.change_log.length} entries):`);
      ex.human_annotation.change_log.forEach((cl, clIdx) => {
        console.log(`  [Entry ${clIdx + 1}] (${cl.action}) by ${cl.reviewer_name} at ${cl.timestamp}`);
        console.log(`            Details: "${cl.details}"`);
        if (cl.before_snapshot && cl.after_snapshot && cl.before_snapshot.length !== cl.after_snapshot.length) {
          console.log(`            Claim Count: ${cl.before_snapshot.length} -> ${cl.after_snapshot.length}`);
        }
      });
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(`CURRENT EXTRACTED CLAIMS (${ex.claims.length}):`);
    if (ex.claims.length === 0) {
      console.log("  [No claims asserted - Hard Negative / Lifestyle Copy]");
    } else {
      ex.claims.forEach((c, idx) => {
        console.log(`  [${idx + 1}] Category:    ${c.claim_type}`);
        console.log(`      Claim Text:  "${c.claim_text}"`);
        console.log(`      UTF-16 Span: [${c.text_start}..${c.text_end}]`);
        console.log(`      Entities:    ${JSON.stringify(c.entities)}`);
        console.log(`      State:       ${c.annotation_state}`);
      });
    }
    console.log("================================================================================");
    console.log("Options: [a] Approve current  [m] Modify  [f] Flag for adjudication  [s] Skip  [q] Quit");

    let answered = false;
    while (!answered) {
      const choice = (await question("Select decision [a/m/f/s/q]: ")).trim().toLowerCase();

      if (choice === "a") {
        const notes = (await question("Review notes / rationale (optional, press Enter to skip): ")).trim();
        manager.recordHumanVerification(ex.example_id, reviewerName, reviewerEmail, notes);
        console.log(`✓ [HUMAN VERIFIED] ${ex.example_id} recorded by ${reviewerName}.\n`);
        answered = true;
      } else if (choice === "f") {
        const reason = (await question("Adjudication reason / legal policy query: ")).trim();
        manager.recordHumanAdjudicationFlag(
          ex.example_id,
          reviewerName,
          reviewerEmail,
          reason || "Human reviewer flagged for further compliance/legal adjudication."
        );
        console.log(`⚑ [FLAGGED FOR ADJUDICATION] ${ex.example_id} recorded.\n`);
        answered = true;
      } else if (choice === "m") {
        // Deep interactive modification workflow
        let draftClaims: EvaluationClaim[] = JSON.parse(JSON.stringify(ex.claims));
        let draftProductId: string | null = ex.product_id;
        let modDone = false;

        while (!modDone) {
          console.log("\n--- MODIFICATION MENU ---");
          console.log(`Current Working Claims (${draftClaims.length}):`);
          draftClaims.forEach((c, idx) => {
            console.log(`  [${idx + 1}] (${c.claim_type}) "${c.claim_text}" [${c.text_start}..${c.text_end}]`);
          });
          console.log("Options:");
          console.log("  [1] Add a missing claim (exact substring in content)");
          console.log("  [2] Edit claim text (auto-recalculates UTF-16 offsets)");
          console.log("  [3] Correct claim category");
          console.log("  [4] Edit entities (price, discount, currency, etc.)");
          console.log("  [5] Remove an incorrectly extracted claim");
          console.log("  [6] Correct product association / SKU");
          console.log("  [7] Convert to zero-claim hard negative");
          console.log("  [p] Preview before/after diff");
          console.log("  [c] Commit modifications (requires explicit confirmation)");
          console.log("  [x] Cancel modifications and return to main options");

          const subChoice = (await question("Select modification action: ")).trim().toLowerCase();

          if (subChoice === "1") {
            const newText = (await question("Enter exact substring to add: ")).trim();
            if (!newText) {
              console.log("Error: Claim text cannot be empty.");
              continue;
            }
            try {
              const offsets = manager.findSubstringOffsets(ex.content, newText);
              console.log(`Permissible Categories: ${CLAIM_TYPES.join(", ")}`);
              const cat = (await question("Select claim category: ")).trim() as ClaimType;
              if (!CLAIM_TYPES.includes(cat)) {
                console.log(`Error: Invalid category "${cat}". Permissible: ${CLAIM_TYPES.join(", ")}`);
                continue;
              }
              const entityStr = (await question("Entities JSON (optional, press Enter for {}): ")).trim();
              let entities: ClaimEntities = {};
              if (entityStr) {
                try {
                  entities = JSON.parse(entityStr);
                } catch {
                  console.log("Invalid JSON, using empty entities.");
                }
              }
              const newClaim: EvaluationClaim = {
                claim_id: `${ex.example_id}_c${draftClaims.length + 1}`,
                claim_text: newText,
                claim_type: cat,
                text_start: offsets.start,
                text_end: offsets.end,
                product_hint: draftProductId,
                entities,
                extraction_confidence: 1.0,
                annotation_state: "human_added",
              };
              const validationErrors = Phase10BValidator.validateClaim(
                newClaim,
                ex.content,
                ex.example_id,
                draftClaims.length
              );
              if (validationErrors.length > 0) {
                console.log(`Validation errors:\n${validationErrors.join("\n")}`);
              } else {
                draftClaims.push(newClaim);
                console.log(`✓ Added claim: "${newText}" [${offsets.start}..${offsets.end}] as ${cat}`);
              }
            } catch (err: unknown) {
              console.log(`Error: ${(err as Error).message}`);
            }
          } else if (subChoice === "2") {
            if (draftClaims.length === 0) {
              console.log("No claims to edit.");
              continue;
            }
            const idxStr = (await question(`Claim number to edit (1 to ${draftClaims.length}): `)).trim();
            const claimIdx = parseInt(idxStr, 10) - 1;
            if (claimIdx < 0 || claimIdx >= draftClaims.length) {
              console.log("Invalid claim index.");
              continue;
            }
            const newText = (await question(`Enter replacement exact substring (current: "${draftClaims[claimIdx].claim_text}"): `)).trim();
            try {
              const offsets = manager.findSubstringOffsets(ex.content, newText);
              draftClaims[claimIdx].claim_text = newText;
              draftClaims[claimIdx].text_start = offsets.start;
              draftClaims[claimIdx].text_end = offsets.end;
              draftClaims[claimIdx].annotation_state = "human_corrected";
              console.log(`✓ Recalculated offsets: [${offsets.start}..${offsets.end}] for "${newText}"`);
            } catch (err: unknown) {
              console.log(`Error: ${(err as Error).message}`);
            }
          } else if (subChoice === "3") {
            if (draftClaims.length === 0) {
              console.log("No claims to edit.");
              continue;
            }
            const idxStr = (await question(`Claim number to edit (1 to ${draftClaims.length}): `)).trim();
            const claimIdx = parseInt(idxStr, 10) - 1;
            if (claimIdx < 0 || claimIdx >= draftClaims.length) {
              console.log("Invalid claim index.");
              continue;
            }
            console.log(`Permissible Categories: ${CLAIM_TYPES.join(", ")}`);
            const newCat = (await question(`New category (current: ${draftClaims[claimIdx].claim_type}): `)).trim() as ClaimType;
            if (CLAIM_TYPES.includes(newCat)) {
              draftClaims[claimIdx].claim_type = newCat;
              draftClaims[claimIdx].annotation_state = "human_corrected";
              console.log(`✓ Category updated to ${newCat}`);
            } else {
              console.log("Invalid category.");
            }
          } else if (subChoice === "4") {
            if (draftClaims.length === 0) {
              console.log("No claims to edit.");
              continue;
            }
            const idxStr = (await question(`Claim number to edit (1 to ${draftClaims.length}): `)).trim();
            const claimIdx = parseInt(idxStr, 10) - 1;
            if (claimIdx < 0 || claimIdx >= draftClaims.length) {
              console.log("Invalid claim index.");
              continue;
            }
            console.log(`Current entities: ${JSON.stringify(draftClaims[claimIdx].entities)}`);
            const entStr = (await question("Enter new entities as JSON object: ")).trim();
            try {
              const parsed = JSON.parse(entStr);
              draftClaims[claimIdx].entities = parsed;
              draftClaims[claimIdx].annotation_state = "human_corrected";
              console.log("✓ Entities updated.");
            } catch {
              console.log("Invalid JSON.");
            }
          } else if (subChoice === "5") {
            if (draftClaims.length === 0) {
              console.log("No claims to remove.");
              continue;
            }
            const idxStr = (await question(`Claim number to remove (1 to ${draftClaims.length}): `)).trim();
            const claimIdx = parseInt(idxStr, 10) - 1;
            if (claimIdx < 0 || claimIdx >= draftClaims.length) {
              console.log("Invalid claim index.");
              continue;
            }
            const removed = draftClaims.splice(claimIdx, 1);
            console.log(`✓ Removed claim: "${removed[0].claim_text}"`);
          } else if (subChoice === "6") {
            console.log(`Current Product SKU: ${draftProductId || "null"}`);
            const newSku = (await question("Enter new Product SKU (or 'null' for unassigned): ")).trim();
            draftProductId = newSku === "null" || newSku === "" ? null : newSku;
            console.log(`✓ Product SKU set to ${draftProductId || "null"}`);
          } else if (subChoice === "7") {
            draftClaims = [];
            console.log("✓ Converted to 0 claims (hard negative).");
          } else if (subChoice === "p") {
            console.log(formatDiffPreview(ex, draftClaims, draftProductId));
          } else if (subChoice === "c") {
            console.log(formatDiffPreview(ex, draftClaims, draftProductId));
            // Validate all claims before committing
            let valid = true;
            for (let cIdx = 0; cIdx < draftClaims.length; cIdx++) {
              const errs = Phase10BValidator.validateClaim(draftClaims[cIdx], ex.content, ex.example_id, cIdx);
              if (errs.length > 0) {
                console.log(`Claim ${cIdx + 1} Error: ${errs.join("; ")}`);
                valid = false;
              }
            }
            if (!valid) {
              console.log("Cannot commit while validation errors exist.");
              continue;
            }
            const confirm = (await question("Confirm commit of modifications? [y/N]: ")).trim().toLowerCase();
            if (confirm === "y") {
              const notes = (await question("Modification rationale / compliance notes: ")).trim();
              manager.recordHumanModification(
                ex.example_id,
                reviewerName,
                reviewerEmail,
                draftClaims,
                notes || "Human compliance auditor updated claims and spans.",
                draftProductId
              );
              console.log(`✓ [HUMAN MODIFIED & COMMITTED] ${ex.example_id} saved successfully.\n`);
              modDone = true;
              answered = true;
            } else {
              console.log("Commit aborted. Continuing edits.");
            }
          } else if (subChoice === "x") {
            console.log("Modification cancelled.");
            modDone = true;
          }
        }
      } else if (choice === "s") {
        console.log(`↷ [SKIPPED] ${ex.example_id} retained as current.\n`);
        answered = true;
      } else if (choice === "q") {
        console.log("\nQuitting review session. All decisions remain preserved.");
        rl.close();
        return;
      } else {
        console.log("Invalid selection. Please enter 'a' to approve, 'm' to modify, 'f' to flag, 's' to skip, or 'q' to quit.");
      }
    }
  }

  console.log("\nReview queue finished!");
  rl.close();
}

// -----------------------------------------------------------------------------
// CLI Runner
// -----------------------------------------------------------------------------

async function runCli() {
  const args = process.argv.slice(2);
  const manager = new ReviewWorkflowManager();

  if (args.includes("--help") || args.length === 0) {
    console.log(`
BrandShield AI — Phase 10B Interactive Manual Human Review CLI

Usage:
  npx tsx tools/dataset-builder/phase10b/review-cli.ts --status
    Displays human review status and queue breakdown across Priorities 1, 2, and 3.

  npx tsx tools/dataset-builder/phase10b/review-cli.ts --adjudicate --reviewer "<Name>" --email "<Email>"
    (Priority 1) Launches manual review for all 7 ambiguous records requiring human adjudication.

  npx tsx tools/dataset-builder/phase10b/review-cli.ts --modified --reviewer "<Name>" --email "<Email>"
    (Priority 2) Launches manual review for all 7 AI-modified regression records.

  npx tsx tools/dataset-builder/phase10b/review-cli.ts --approved --reviewer "<Name>" --email "<Email>" [--batch <N>] [--offset <N>]
    (Priority 3) Launches manual review for the 88 AI-approved records in manageable batches.

  npx tsx tools/dataset-builder/phase10b/review-cli.ts --example <example_id> --reviewer "<Name>" --email "<Email>"
    Reviews a specific individual example by ID (e.g. eval_10b_028).

  npx tsx tools/dataset-builder/phase10b/review-cli.ts --interactive --reviewer "<Name>" --email "<Email>" [--queue <adjudication|modified|approved|all>]
    General interactive review session across specified queue.
`);
    return;
  }

  if (args.includes("--status")) {
    const examples = manager.loadDataset();
    const valResult = Phase10BValidator.validateCollection(examples);

    const p1 = examples.filter((e) => e.human_annotation.review_status === "needs_human_adjudication");
    const p2 = examples.filter((e) => e.human_annotation.review_status === "ai_audited_modified");
    const p3 = examples.filter((e) => e.human_annotation.review_status === "ai_audited_approved");

    console.log("================================================================================");
    console.log(" BrandShield AI — Phase 10B Review Status & Human Review Queues");
    console.log("================================================================================");
    console.log(`Total Evaluation Examples:         ${valResult.totalExamples}`);
    console.log(`Total Extracted Claims:            ${valResult.totalClaims}`);
    console.log("");
    console.log(`Genuinely Reviewed by Humans:      ${valResult.humanReviewedApprovedCount + valResult.humanReviewedModifiedCount} (${(((valResult.humanReviewedApprovedCount + valResult.humanReviewedModifiedCount) / valResult.totalExamples) * 100).toFixed(1)}%)`);
    console.log(`  - Human Approved / Verified:     ${valResult.humanReviewedApprovedCount}`);
    console.log(`  - Human Modified / Corrected:    ${valResult.humanReviewedModifiedCount}`);
    console.log("");
    console.log(`Available for Manual Human Review: ${p1.length + p2.length + p3.length}`);
    console.log(`  - Priority 1 (Adjudication Queue): ${p1.length} examples`);
    console.log(`  - Priority 2 (AI-Modified Queue):  ${p2.length} examples`);
    console.log(`  - Priority 3 (AI-Approved Queue):  ${p3.length} examples`);
    console.log("");
    console.log(`Unreviewed Queue:                  ${valResult.unreviewedCount}`);
    console.log(`Rejected Candidates:               ${valResult.rejectedCount}`);
    console.log("================================================================================");
    console.log("Priority Queue Breakdown:");
    console.log(`  Priority 1 [Adjudication]: ${p1.map((e) => e.example_id).join(", ")}`);
    console.log(`  Priority 2 [Modified]:     ${p2.map((e) => e.example_id).join(", ")}`);
    console.log(`  Priority 3 [Approved]:     ${p3.length} items (Use --approved --batch 10 to review in batches)`);
    console.log("================================================================================");

    // Reviewer audit log
    const reviewers = new Map<string, { email: string; count: number; lastActive: string }>();
    for (const ex of examples) {
      const ann = ex.human_annotation;
      if (ann.reviewer_name && ann.review_status !== "unreviewed") {
        const key = ann.reviewer_name;
        const current = reviewers.get(key) || { email: ann.reviewer_email || "", count: 0, lastActive: "" };
        current.count++;
        if (!current.lastActive || (ann.reviewed_at && ann.reviewed_at > current.lastActive)) {
          current.lastActive = ann.reviewed_at || "";
        }
        reviewers.set(key, current);
      }
    }

    console.log("\nActive Reviewers / Auditors:");
    for (const [name, meta] of reviewers.entries()) {
      console.log(`  - ${name} (${meta.email}): ${meta.count} records reviewed (Last active: ${meta.lastActive})`);
    }
    console.log("");
    return;
  }

  // Interactive Manual Human Review Sessions
  const isInteractive =
    args.includes("--interactive") ||
    args.includes("--adjudicate") ||
    args.includes("--modified") ||
    args.includes("--approved") ||
    args.includes("--example");

  if (isInteractive) {
    const reviewer = getArg(args, "--reviewer");
    const email = getArg(args, "--email") || "unspecified@reviewer.org";

    if (!reviewer) {
      console.error("Error: --reviewer \"<Name>\" is required for manual human review.");
      console.error("Example: npx tsx tools/dataset-builder/phase10b/review-cli.ts --adjudicate --reviewer \"Saran\" --email \"tosaran09@gmail.com\"");
      process.exit(1);
    }

    let queue = getArg(args, "--queue") || undefined;
    if (args.includes("--adjudicate")) queue = "adjudication";
    if (args.includes("--modified")) queue = "modified";
    if (args.includes("--approved")) queue = "approved";

    const exampleId = getArg(args, "--example") || undefined;
    const batchStr = getArg(args, "--batch");
    const offsetStr = getArg(args, "--offset");
    const batch = batchStr ? parseInt(batchStr, 10) : undefined;
    const offset = offsetStr ? parseInt(offsetStr, 10) : undefined;

    await runInteractiveSession(manager, reviewer, email, {
      queue,
      exampleId,
      batch,
      offset,
    });
    return;
  }

  // CLI Non-Interactive Action: Approve Verbatim
  const approveIdx = args.indexOf("--approve");
  if (approveIdx !== -1) {
    const exampleId = args[approveIdx + 1];
    const reviewer = getArg(args, "--reviewer");
    const email = getArg(args, "--email") || "unspecified@reviewer.org";
    const notes = getArg(args, "--notes") || "";

    if (!reviewer) {
      console.error("Error: --reviewer is required to approve a record.");
      process.exit(1);
    }

    manager.recordHumanVerification(exampleId, reviewer, email, notes);
    console.log(`Successfully recorded human verification for ${exampleId} by reviewer ${reviewer}.`);
    return;
  }

  // CLI Non-Interactive Action: Reject
  const rejectIdx = args.indexOf("--reject");
  if (rejectIdx !== -1) {
    const exampleId = args[rejectIdx + 1];
    const reviewer = getArg(args, "--reviewer");
    const email = getArg(args, "--email") || "unspecified@reviewer.org";
    const reason = getArg(args, "--reason");

    if (!reviewer || !reason) {
      console.error("Error: Both --reviewer and --reason are required to reject a record.");
      process.exit(1);
    }

    manager.recordHumanRejection(exampleId, reviewer, email, reason);
    console.log(`Successfully recorded human rejection for ${exampleId} by reviewer ${reviewer}.`);
    return;
  }
}

function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error("CLI error:", err);
    process.exit(1);
  });
}
