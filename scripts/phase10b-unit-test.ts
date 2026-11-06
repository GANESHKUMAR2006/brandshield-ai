/**
 * BrandShield AI — Phase 10B Isolated Unit Test Suite
 * Evaluation Dataset Integrity, Review Invariants, & Deduplication Audit
 *
 * Verifies:
 * 1. Schema structure and unreviewed initial state invariants
 * 2. Exact JavaScript UTF-16 substring slicing (content.slice(start, end) === claim_text)
 * 3. Strict rejection of drifted offsets and entity mismatches
 * 4. Cross-split deduplication against Phase 10A outputs
 * 5. Intra-dataset duplicate prevention
 * 6. Review workflow state transitions (approve, modify, reject)
 * 7. Representation across all 6 channels and all 10 claim categories
 */

import * as fs from "fs";
import * as path from "path";
import { generateRawEvaluationDataset } from "../tools/dataset-builder/phase10b/dataset-raw";
import { Phase10BValidator } from "../tools/dataset-builder/phase10b/validator";
import { ReviewWorkflowManager } from "../tools/dataset-builder/phase10b/review-cli";
import { EvaluationExample, EvaluationClaim } from "../tools/dataset-builder/phase10b/types";
import { CLAIM_TYPES } from "../src/lib/ai/extraction/extraction-schema";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

async function runPhase10BTests() {
  console.log("================================================================================");
  console.log(" BrandShield AI — Phase 10B Isolated Unit Tests");
  console.log("================================================================================\n");

  const rawExamples = generateRawEvaluationDataset();

  // ---------------------------------------------------------------------------
  // Suite 1: Dataset Volume & Initial Unreviewed State Invariants
  // ---------------------------------------------------------------------------
  console.log("[Suite 1] Volume & Unreviewed Initial State");

  assert(
    rawExamples.length >= 100 && rawExamples.length <= 150,
    `Dataset volume is between 100 and 150 examples (Actual: ${rawExamples.length})`
  );

  const allUnreviewed = rawExamples.every(
    (e) =>
      e.human_annotation.review_status === "unreviewed" &&
      e.human_annotation.reviewer_name === null &&
      e.human_annotation.reviewed_at === null
  );
  assert(
    allUnreviewed,
    "100% of prepared examples are initialized as unreviewed with null reviewer identities"
  );

  const noSyntheticApproved = rawExamples.every(
    (e) => e.human_annotation.review_status !== "reviewed_approved"
  );
  assert(
    noSyntheticApproved,
    "Zero synthetic or automated approvals exist in the raw evaluation dataset"
  );

  // ---------------------------------------------------------------------------
  // Suite 2: UTF-16 Offsets & Invariant Slicing
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 2] UTF-16 Offset Slicing & Validation");

  let totalClaims = 0;
  let offsetErrors = 0;

  for (const ex of rawExamples) {
    totalClaims += ex.claims.length;
    for (const c of ex.claims) {
      const slice = ex.content.slice(c.text_start, c.text_end);
      if (slice !== c.claim_text) {
        offsetErrors++;
      }
    }
  }

  assert(offsetErrors === 0, `All ${totalClaims} proposed claims strictly satisfy content.slice(start, end) === claim_text`);

  const valResult = Phase10BValidator.validateCollection(rawExamples);
  assert(
    valResult.isValid && valResult.errors.length === 0,
    "Phase10BValidator confirms zero schema or offset errors across all raw examples"
  );

  // Offset Drift Rejection Test
  const mockEx: EvaluationExample = JSON.parse(JSON.stringify(rawExamples[0]));
  mockEx.claims[0].text_start += 3;
  mockEx.claims[0].text_end += 3;
  const driftErrors = Phase10BValidator.validateExample(mockEx);
  assert(
    driftErrors.some((e) => e.includes("Offset mismatch")),
    "Drifted offset (+3 chars) is strictly rejected (never silently repaired)"
  );

  // Negative Boundary Rejection Test
  mockEx.claims[0].text_start = -1;
  const negErrors = Phase10BValidator.validateExample(mockEx);
  assert(
    negErrors.some((e) => e.includes("cannot be negative")),
    "Negative text_start is strictly rejected by bounds checker"
  );

  // Entity Mismatch Rejection Test
  const entityMock: EvaluationExample = JSON.parse(JSON.stringify(rawExamples[0]));
  entityMock.claims[0].entities = { price: 99999, currency: "INR" }; // Mismatched price
  const entErrors = Phase10BValidator.validateExample(entityMock);
  assert(
    entErrors.some((e) => e.includes("price 99999 not found")),
    "Mismatched price entity is caught and rejected by validator"
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Cross-Split Deduplication Against Phase 10A
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3] Cross-Dataset Deduplication Audit");

  const phase10aOutputDir = path.join(__dirname, "../tools/dataset-builder/output");
  const crossAudit = Phase10BValidator.auditCrossSplitLeakage(rawExamples, phase10aOutputDir);

  assert(
    crossAudit.exactDuplicatesWith10aTrain === 0,
    "Zero exact duplicate marketing copies with Phase 10A Train partition"
  );
  assert(
    crossAudit.exactDuplicatesWith10aVal === 0,
    "Zero exact duplicate marketing copies with Phase 10A Validation partition"
  );
  assert(
    crossAudit.exactDuplicatesWith10aTest === 0,
    "Zero exact duplicate marketing copies with Phase 10A Test partition"
  );
  assert(
    crossAudit.intra10bDuplicates === 0,
    "Zero intra-dataset duplicate marketing copies within Phase 10B"
  );
  assert(
    crossAudit.isClean,
    `Overall cross-dataset audit is completely clean (Max Jaccard token overlap: ${crossAudit.maxJaccardWithPhase10a})`
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Channel & Category Representation
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4] Category & Channel Representation");

  const channelsRepresented = new Set(rawExamples.map((e) => e.channel));
  assert(channelsRepresented.size === 6, "All 6 required marketing channels are represented");

  const expectedChannels = [
    "social_media_ad",
    "landing_page",
    "ecommerce_pdp",
    "email_promotion",
    "packaging",
    "search_ad",
  ];
  const allChannelsPresent = expectedChannels.every((ch) => channelsRepresented.has(ch as any));
  assert(allChannelsPresent, "Each specific required channel is present in the dataset");

  const allCategories = new Set<string>();
  for (const ex of rawExamples) {
    for (const c of ex.claims) {
      allCategories.add(c.claim_type);
    }
  }
  const all10Covered = CLAIM_TYPES.every((t) => allCategories.has(t));
  assert(all10Covered, "All 10 closed-enum claim categories are represented in Phase 10B");

  // ---------------------------------------------------------------------------
  // Suite 5: Review Workflow & Audit Trail Transitions
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 5] Human Review Workflow Transitions");

  const tempFilePath = path.join(__dirname, "../tools/dataset-builder/phase10b/output/temp_test_dataset.jsonl");
  const tempDir = path.dirname(tempFilePath);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const subset = rawExamples.slice(0, 5);
  fs.writeFileSync(tempFilePath, subset.map((s) => JSON.stringify(s)).join("\n") + "\n", "utf8");

  const workflowMgr = new ReviewWorkflowManager(tempFilePath);

  // Action: Human Approval
  const approvedItem = workflowMgr.recordHumanApproval(
    subset[0].example_id,
    "Dr. Aris Thorne",
    "aris.thorne@dermaglow.com",
    "Clinical review confirmed verbatim claims."
  );
  assert(
    approvedItem.human_annotation.review_status === "reviewed_approved",
    "Workflow transitions status to 'reviewed_approved'"
  );
  assert(
    approvedItem.human_annotation.reviewer_name === "Dr. Aris Thorne",
    "Workflow records genuine human reviewer identity"
  );
  assert(
    approvedItem.human_annotation.change_log.length === 1 &&
      approvedItem.human_annotation.change_log[0].action === "approved",
    "Workflow appends to immutable change_log"
  );

  // Action: Human Rejection
  const rejectedItem = workflowMgr.recordHumanRejection(
    subset[1].example_id,
    "Dr. Aris Thorne",
    "aris.thorne@dermaglow.com",
    "Corrupt formatting in sample copy."
  );
  assert(
    rejectedItem.human_annotation.review_status === "rejected",
    "Workflow transitions status to 'rejected'"
  );
  assert(
    rejectedItem.human_annotation.review_notes === "Corrupt formatting in sample copy.",
    "Workflow records rejection rationale"
  );

  // Action: Human Modification
  const modifiedClaims: EvaluationClaim[] = [
    {
      ...subset[2].claims[0],
      claim_type: "product_attribute",
      annotation_state: "human_corrected",
    },
  ];
  const modItem = workflowMgr.recordHumanModification(
    subset[2].example_id,
    "Dr. Aris Thorne",
    "aris.thorne@dermaglow.com",
    modifiedClaims,
    "Reclassified claim type based on ingredient context."
  );
  assert(
    modItem.human_annotation.review_status === "reviewed_modified",
    "Workflow transitions status to 'reviewed_modified'"
  );
  assert(
    modItem.claims[0].claim_type === "product_attribute",
    "Workflow updates modified claims"
  );

  // ---------------------------------------------------------------------------
  // Suite 6: Advanced Editing & AI Compliance Audit Transitions
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 6] Advanced Editing & AI Audit Transitions");

  // Offset calculation helper
  const offsets = workflowMgr.findSubstringOffsets(subset[3].content, subset[3].claims[0].claim_text);
  assert(
    offsets.start === subset[3].claims[0].text_start && offsets.end === subset[3].claims[0].text_end,
    "findSubstringOffsets accurately calculates UTF-16 code unit bounds"
  );

  // AI Audited Approval
  const aiApproved = workflowMgr.recordAiAuditDecision(
    subset[3].example_id,
    "ai_audited_approved",
    "BrandShield Compliance AI Auditor (Phase 10B)",
    "compliance-auditor@brandshield.internal",
    "All claims and boundaries verified clean."
  );
  assert(
    aiApproved.human_annotation.review_status === "ai_audited_approved",
    "recordAiAuditDecision transitions status to 'ai_audited_approved'"
  );
  assert(
    aiApproved.claims[0].annotation_state === "ai_audited_verified",
    "recordAiAuditDecision marks claim annotation_state as 'ai_audited_verified'"
  );

  // Needs Human Adjudication Flag
  const flagged = workflowMgr.recordAiAuditDecision(
    subset[4].example_id,
    "needs_human_adjudication",
    "BrandShield Compliance AI Auditor (Phase 10B)",
    "compliance-auditor@brandshield.internal",
    "Borderline puffery requires legal adjudication."
  );
  assert(
    flagged.human_annotation.review_status === "needs_human_adjudication",
    "recordAiAuditDecision transitions status to 'needs_human_adjudication'"
  );
  assert(
    flagged.claims[0].annotation_state === "flagged_ambiguous",
    "recordAiAuditDecision marks claim annotation_state as 'flagged_ambiguous'"
  );

  // Clean up temp test file
  if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

  // ---------------------------------------------------------------------------
  // Suite 7: Audited Output Dataset Integrity & Provenance
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 7] Output Dataset Provenance & Integrity");

  const prodDatasetPath = path.join(__dirname, "../tools/dataset-builder/phase10b/output/evaluation_dataset.jsonl");
  const prodLines = fs.readFileSync(prodDatasetPath, "utf8").trim().split("\n");
  const prodExamples: EvaluationExample[] = prodLines.map((l) => JSON.parse(l));

  const prodValidation = Phase10BValidator.validateCollection(prodExamples);
  assert(prodValidation.isValid, "Audited evaluation_dataset.jsonl is 100% valid with zero offset or schema errors");
  assert(prodValidation.unreviewedCount === 0, "Zero unreviewed records remain in evaluation_dataset.jsonl");
  assert(
    prodValidation.humanReviewedApprovedCount === 31,
    "Exact 31 genuine human approvals (14 initial + 17 verified) by Saran are preserved"
  );
  assert(
    prodValidation.humanReviewedModifiedCount === 25,
    "Exact 25 genuine human modifications (3 initial + 22 modified) by Saran are preserved"
  );
  assert(
    prodValidation.humanReviewedApprovedCount + prodValidation.humanReviewedModifiedCount === 56,
    "Exact 56 total human reviews by Saran are preserved"
  );
  assert(prodValidation.aiAuditedApprovedCount === 64, "64 records are transparently marked ai_audited_approved");
  assert(prodValidation.aiAuditedModifiedCount === 0, "Zero unadjudicated AI modifications remain");
  assert(prodValidation.needsHumanAdjudicationCount === 0, "Zero borderline records remain needing human adjudication");

  // Suite 7b: Corrective Remediation Provenance Verification
  const remediatedIds = ["eval_10b_005", "eval_10b_036", "eval_10b_058"];
  const allCorrectlyAttributed = remediatedIds.every((id) => {
    const ex = prodExamples.find((e) => e.example_id === id);
    if (!ex) return false;
    const entry = ex.human_annotation.change_log.find((cl) => cl.timestamp === "2026-11-06T12:50:55.485Z");
    return (
      entry !== undefined &&
      entry.action === "automated_remediation" &&
      entry.reviewer_name === "BrandShield Dataset Integrity Auditor (Automated Remediation)"
    );
  });
  assert(
    allCorrectlyAttributed,
    "Corrective remediation entries in eval_10b_005, 036, and 058 are explicitly attributed to automated auditor"
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(` Phase 10B Test Results: ${passed} passed, ${failed} failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10BTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

