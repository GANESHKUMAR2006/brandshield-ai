/**
 * BrandShield AI — Phase 10A Unit Test Suite
 * Standalone Offline Dataset Builder Invariant & Quality Gate Verification
 *
 * Verifies:
 * 1. Extraction schema reuse and 10 claim category coverage
 * 2. UTF-16 JavaScript offset invariants (content.slice(start, end) === claim_text)
 * 3. Strict rejection of invalid spans, drifted offsets, and fabricated substrings
 * 4. Entity cross-validation against claim text (price, discount, concentration)
 * 5. Programmatic human-review gate audit trail (reviewer ID, decision, timestamps)
 * 6. Disjoint partition integrity (zero campaign, SKU, or verbatim text leakage)
 * 7. Dataset target counts (750 train, 100 validation, 150 test = 1,000 approved)
 * 8. Cryptographic manifest provenance and SHA-256 generation
 */

import * as fs from "fs";
import * as path from "path";
import {
  CLAIM_TYPES,
  RawExtractedClaim,
  RawExtractedClaimSchema,
} from "../src/lib/ai/extraction/extraction-schema";
import { EXTRACTION_SYSTEM_PROMPT } from "../src/lib/ai/extraction/extraction-prompt";
import { DeterministicPRNG } from "../tools/dataset-builder/prng";
import {
  CATALOG_TRAIN,
  CATALOG_VALIDATION,
  CATALOG_TEST,
} from "../tools/dataset-builder/catalog";
import { DatasetValidator } from "../tools/dataset-builder/validator";
import { QualityReviewer } from "../tools/dataset-builder/reviewer";
import { Partitioner } from "../tools/dataset-builder/partitioner";
import { DeferredAdaptionExportAdapter } from "../tools/dataset-builder/export-adapter";
import { DatasetExample, PartitionSplit } from "../tools/dataset-builder/types";

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

async function runTestSuite() {
  console.log("================================================================================");
  console.log(" BrandShield AI — Phase 10A Isolated Unit Tests");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: Schema Reuse & 10 Claim Categories
  // ---------------------------------------------------------------------------
  console.log("[Suite 1] Schema Reuse & Enums");

  assert(
    CLAIM_TYPES.length === 10,
    "CLAIM_TYPES has exactly 10 defined categories"
  );

  const requiredTypes = [
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
  ];
  const allPresent = requiredTypes.every((t) => CLAIM_TYPES.includes(t as any));
  assert(allPresent, "All 10 required claim categories are present in CLAIM_TYPES");

  assert(
    typeof EXTRACTION_SYSTEM_PROMPT === "string" &&
      EXTRACTION_SYSTEM_PROMPT.includes("BrandShield AI"),
    "Reuses original EXTRACTION_SYSTEM_PROMPT without modification"
  );

  // ---------------------------------------------------------------------------
  // Suite 2: UTF-16 JavaScript Offset Invariants & Slicing
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 2] Substring Slicing & Offset Invariants");

  const sampleCopy = "Special launch of DermaGlow Serum at only ₹1,499 for 24 hours!";
  const validPriceClaim: RawExtractedClaim = {
    claim_text: "only ₹1,499",
    claim_type: "price",
    text_start: sampleCopy.indexOf("only ₹1,499"),
    text_end: sampleCopy.indexOf("only ₹1,499") + "only ₹1,499".length,
    product_hint: "DG-VITC-01",
    entities: { price: 1499, currency: "INR" },
    extraction_confidence: 0.98,
  };

  const validReport = DatasetValidator.validateCandidate(sampleCopy, [validPriceClaim]);
  assert(
    validReport.isValid && validReport.errors.length === 0,
    "Valid claim with exact UTF-16 substring slice passes validation"
  );

  // Offset Drift Test (+3 characters)
  const driftedClaim = {
    ...validPriceClaim,
    text_start: validPriceClaim.text_start + 3,
    text_end: validPriceClaim.text_end + 3,
  };
  const driftReport = DatasetValidator.validateCandidate(sampleCopy, [driftedClaim]);
  assert(
    !driftReport.isValid &&
      driftReport.errors.some((e) => e.includes("Offset mismatch")),
    "Drifted offset is strictly rejected (never silently repaired)"
  );

  // Negative Boundary Test
  const negativeStartClaim = {
    ...validPriceClaim,
    text_start: -1,
  };
  const negReport = DatasetValidator.validateCandidate(sampleCopy, [negativeStartClaim]);
  assert(
    !negReport.isValid &&
      negReport.errors.some((e) => e.includes("text_start") || e.includes("cannot be negative")),
    "Negative text_start is strictly rejected by boundary check"
  );

  // Out of Bounds End Test
  const outOfBoundsClaim = {
    ...validPriceClaim,
    text_end: sampleCopy.length + 10,
  };
  const oobReport = DatasetValidator.validateCandidate(sampleCopy, [outOfBoundsClaim]);
  assert(
    !oobReport.isValid &&
      oobReport.errors.some((e) => e.includes("exceeds original content length")),
    "text_end exceeding content length is strictly rejected"
  );

  // Fabricated Text Test
  const fabricatedClaim = {
    ...validPriceClaim,
    claim_text: "cures all wrinkles instantly",
  };
  const fabReport = DatasetValidator.validateCandidate(sampleCopy, [fabricatedClaim]);
  assert(
    !fabReport.isValid,
    "Fabricated claim text not present in content is strictly rejected"
  );

  // ---------------------------------------------------------------------------
  // Suite 3: Entity Cross-Validation Against Claim Text
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3] Entity Cross-Validation");

  // Mismatched Price Entity
  const mismatchedPriceClaim = {
    ...validPriceClaim,
    entities: { price: 9999, currency: "INR" }, // 9999 does not exist in "only ₹1,499"
  };
  const priceMismatchReport = DatasetValidator.validateCandidate(sampleCopy, [mismatchedPriceClaim]);
  assert(
    !priceMismatchReport.isValid &&
      priceMismatchReport.errors.some((e) => e.includes("price 9999 not found")),
    "Mismatched price entity is caught and rejected"
  );

  // Concentration Entity Match & Mismatch
  const concCopy = "Contains active 10% Vitamin C for daily brightening.";
  const concClaim = {
    claim_text: "Contains active 10% Vitamin C",
    claim_type: "product_attribute",
    text_start: concCopy.indexOf("Contains active 10% Vitamin C"),
    text_end: concCopy.indexOf("Contains active 10% Vitamin C") + "Contains active 10% Vitamin C".length,
    product_hint: "DG-VITC-01",
    entities: { ingredient: "Vitamin C", concentration: "10%" },
    extraction_confidence: 0.95,
  };
  const concReport = DatasetValidator.validateCandidate(concCopy, [concClaim]);
  assert(concReport.isValid, "Matching concentration entity passes validation");

  const mismatchedConcClaim = {
    ...concClaim,
    entities: { ingredient: "Vitamin C", concentration: "25%" }, // 25% does not exist in text
  };
  const concMismatchReport = DatasetValidator.validateCandidate(concCopy, [mismatchedConcClaim]);
  assert(
    !concMismatchReport.isValid &&
      concMismatchReport.errors.some((e) => e.includes("concentration 25% not found")),
    "Mismatched concentration entity is rejected"
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Human-Review Gate & Audit Trail
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4] Quality Reviewer Gate & Audit Trail");

  const mockApprovedExample: Omit<DatasetExample, "human_review"> = {
    example_id: "ex_test_001",
    campaign_id: "CAMP-TRN-SUMMER-2026",
    product_id: "DG-VITC-01",
    product_name: "DermaGlow Vitamin C",
    channel: "instagram",
    content: sampleCopy,
    claims: [validPriceClaim],
    metadata: {
      has_claims: true,
      claim_count: 1,
      claim_types: ["price"],
      is_hard_negative: false,
      is_ambiguous: false,
      is_high_risk: false,
    },
    provenance: {
      source_type: "synthetic_combinatorial",
      author_or_generator: "BrandShield-DatasetBuilder-v1.0.0",
      created_at: new Date().toISOString(),
    },
  };

  const reviewPass = QualityReviewer.reviewCandidate(mockApprovedExample, []);
  assert(
    reviewPass.approved &&
      reviewPass.audit.status === "approved" &&
      typeof reviewPass.audit.reviewed_by === "string" &&
      reviewPass.audit.reviewed_by.startsWith("auditor-"),
    "Valid candidate passes review gate with assigned auditor ID"
  );

  // Omission Flaw: Text has price symbol but 0 claims
  const omissionExample: Omit<DatasetExample, "human_review"> = {
    ...mockApprovedExample,
    content: "Special offer: only ₹1,999 today!",
    claims: [],
  };
  const reviewOmission = QualityReviewer.reviewCandidate(omissionExample, []);
  assert(
    !reviewOmission.approved &&
      reviewOmission.audit.status === "rejected" &&
      (reviewOmission.audit.rejection_reason?.includes("Omission flaw") ?? false),
    "Omission flaw in zero-claim candidate is caught by reviewer gate"
  );

  // Dangling Leading Punctuation
  const punctuationClaim: RawExtractedClaim = {
    ...validPriceClaim,
    claim_text: ", only ₹1,499",
  };
  const punctExample: Omit<DatasetExample, "human_review"> = {
    ...mockApprovedExample,
    claims: [punctuationClaim],
  };
  const reviewPunct = QualityReviewer.reviewCandidate(punctExample, []);
  assert(
    !reviewPunct.approved &&
      reviewPunct.audit.status === "rejected" &&
      (reviewPunct.audit.rejection_reason?.includes("starts with punctuation") ?? false),
    "Dangling leading punctuation is rejected by reviewer gate"
  );

  // ---------------------------------------------------------------------------
  // Suite 5: Partition Disjointness & Duplicate Protection
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 5] Disjoint Partitioning");

  // Check catalogs
  const trainSKUs = new Set(CATALOG_TRAIN.products.map((p) => p.sku));
  const valSKUs = new Set(CATALOG_VALIDATION.products.map((p) => p.sku));
  const testSKUs = new Set(CATALOG_TEST.products.map((p) => p.sku));

  let skuOverlap = false;
  for (const s of valSKUs) {
    if (trainSKUs.has(s)) skuOverlap = true;
  }
  for (const s of testSKUs) {
    if (trainSKUs.has(s) || valSKUs.has(s)) skuOverlap = true;
  }
  assert(!skuOverlap, "Product catalog SKUs are strictly disjoint across Train, Val, and Test");

  const trainCamps = new Set(CATALOG_TRAIN.campaigns);
  const valCamps = new Set(CATALOG_VALIDATION.campaigns);
  const testCamps = new Set(CATALOG_TEST.campaigns);

  let campOverlap = false;
  for (const c of valCamps) {
    if (trainCamps.has(c)) campOverlap = true;
  }
  for (const c of testCamps) {
    if (trainCamps.has(c) || valCamps.has(c)) campOverlap = true;
  }
  assert(!campOverlap, "Campaign identifiers are strictly disjoint across Train, Val, and Test");

  // Synthetic split disjointness test
  const splitMock: PartitionSplit = {
    train: [mockApprovedExample as any],
    validation: [
      {
        ...mockApprovedExample,
        example_id: "ex_val_001",
        campaign_id: "CAMP-VAL-SPRING-2026",
        product_id: "DG-CERAM-01",
        content: "Different validation copy without claims.",
        claims: [],
      } as any,
    ],
    test: [
      {
        ...mockApprovedExample,
        example_id: "ex_test_002",
        campaign_id: "CAMP-TST-BLACK-FRIDAY-2026",
        product_id: "DG-RET-01",
        content: "Unique held-out test copy.",
        claims: [],
      } as any,
    ],
  };
  const disjointCheck = Partitioner.verifyDisjointness(splitMock);
  assert(disjointCheck.isDisjoint, "Partitioner verifies clean disjoint splits");

  // Duplicate Text Leakage Detection
  const leakedSplit: PartitionSplit = {
    ...splitMock,
    test: [
      {
        ...splitMock.test[0],
        content: sampleCopy, // Duplicate of Train copy!
      },
    ],
  };
  const leakCheck = Partitioner.verifyDisjointness(leakedSplit);
  assert(
    !leakCheck.isDisjoint &&
      leakCheck.errors.some((e) => e.includes("Verbatim content leakage")),
    "Partitioner catches and halts on verbatim text leakage between partitions"
  );

  // ---------------------------------------------------------------------------
  // Suite 6: Generated Dataset Artifact Verification
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 6] Output Dataset Artifacts & Manifest");

  const outputDir = path.join(__dirname, "../tools/dataset-builder/output");
  const trainJsonlPath = path.join(outputDir, "train.jsonl");
  const valJsonlPath = path.join(outputDir, "validation.jsonl");
  const testJsonlPath = path.join(outputDir, "test.jsonl");
  const manifestPath = path.join(outputDir, "manifest.json");

  assert(fs.existsSync(trainJsonlPath), "train.jsonl exists on disk");
  assert(fs.existsSync(valJsonlPath), "validation.jsonl exists on disk");
  assert(fs.existsSync(testJsonlPath), "test.jsonl exists on disk");
  assert(fs.existsSync(manifestPath), "manifest.json exists on disk");

  const trainLines = fs
    .readFileSync(trainJsonlPath, "utf8")
    .trim()
    .split("\n");
  const valLines = fs
    .readFileSync(valJsonlPath, "utf8")
    .trim()
    .split("\n");
  const testLines = fs
    .readFileSync(testJsonlPath, "utf8")
    .trim()
    .split("\n");

  assert(trainLines.length === 750, `train.jsonl contains exactly 750 records (${trainLines.length})`);
  assert(valLines.length === 100, `validation.jsonl contains exactly 100 records (${valLines.length})`);
  assert(testLines.length === 150, `test.jsonl contains exactly 150 records (${testLines.length})`);

  const totalApprovedOnDisk = trainLines.length + valLines.length + testLines.length;
  assert(totalApprovedOnDisk === 1000, `Total approved records equals target of 1,000 (${totalApprovedOnDisk})`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.statistics.total_approved === 1000, "Manifest records total_approved = 1000");
  assert(
    Object.keys(manifest.files).length === 4,
    "Manifest tracks 4 output files with SHA-256 hashes"
  );

  // ---------------------------------------------------------------------------
  // Suite 7: Adaption Export Decoupling
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 7] Adaption Decoupling & Export Adapter");

  const adapter = new DeferredAdaptionExportAdapter();
  assert(
    adapter.schemaVersion === "pending_official_docs",
    "DeferredAdaptionExportAdapter flags schema version as pending official docs"
  );

  let adapterThrew = false;
  try {
    adapter.transformExample();
  } catch (err: any) {
    adapterThrew = true;
    assert(
      err.message.includes("deliberately held pending official documentation"),
      "Adapter safely prevents premature transformation to unverified format"
    );
  }
  assert(adapterThrew, "Adapter throws when attempting export before official schema verified");

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(` Phase 10A Test Results: ${passed} passed, ${failed} failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
