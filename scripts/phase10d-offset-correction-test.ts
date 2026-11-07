/**
 * BrandShield AI — Phase 10D Deterministic Claim Offset Correction Test Suite
 *
 * Verifies:
 * 1. Exact claim matching against original content
 * 2. Automatic correction of incorrect model-proposed offsets (e.g. Qwen3 4B hallucinated bounds)
 * 3. Unicode currency symbols (₹ Indian Rupee, € Euro, ¥ Yen, £ Pound, $ Dollar)
 * 4. Emoji and surrogate pairs (astral code units U+10000+ like 🧴, ✨, 🌟 without surrogate splits)
 * 5. Repeated claim occurrences (1-to-1 sequential matching in document reading order)
 * 6. Missing claim text (reporting "missing", requiresManualReview, never inventing spans)
 * 7. Ambiguous matches (multiple occurrences > extracted claims flagged for manual review)
 * 8. Multiple distinct claims in a single sentence (zero span collisions)
 * 9. Empty and whitespace-only claim text (strict rejection)
 * 10. ClaimValidator end-to-end integration (gating unresolvable spans from validated output)
 */

import { ClaimOffsetCalculator } from "../src/lib/ai/extraction/claim-offset-calculator";
import { ClaimValidator } from "../src/lib/ai/validation/claim-validator";
import { ModelClaimInput, ModelClaimOutput } from "../src/lib/ai/extraction/extraction-schema";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail = "") {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (detail) console.log(`       └─ ${detail}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error(`       └─ ${detail}`);
    failed++;
  }
}

async function runPhase10DTests() {
  console.log("========================================================================");
  console.log(" BrandShield AI — Phase 10D Deterministic Offset Correction Unit Tests  ");
  console.log(" Invariant: content.slice(text_start, text_end) === claim_text           ");
  console.log("========================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: Exact Claim Matching
  // ---------------------------------------------------------------------------
  console.log("--- Suite 1: Exact Verbatim Claim Matching ---");
  {
    const content = "Formulated with 10% stabilised Vitamin C for superior skin brightening.";
    const claimText = "10% stabilised Vitamin C";
    const res = ClaimOffsetCalculator.calculateSingleOffset(content, claimText);

    assert(res.status === "exact_match", "1.1 Status is 'exact_match'");
    assert(res.isValid === true, "1.2 Result is valid");
    assert(res.text_start === 16, "1.3 text_start is exactly 16", `start: ${res.text_start}`);
    assert(res.text_end === 40, "1.4 text_end is exactly 40", `end: ${res.text_end}`);
    assert(
      content.slice(res.text_start!, res.text_end!) === claimText,
      "1.5 Invariant holds: content.slice(16, 40) === '10% stabilised Vitamin C'"
    );
    assert(res.requiresManualReview === false, "1.6 requiresManualReview is false");
  }

  // ---------------------------------------------------------------------------
  // Suite 2: Incorrect Model-Proposed Offsets (Live Qwen3 Hallucination Fix)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 2: Incorrect Model-Proposed Offsets (Live Qwen3 Hallucination Fix) ---");
  {
    const content = "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C, now available for ₹1,999.";

    // Exactly the hallucinated bounds returned by Qwen3 4B in the live test
    const hallucinatedClaims: ModelClaimInput[] = [
      {
        claim_text: "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C",
        claim_type: "product_attribute",
        text_start: 0,
        text_end: 38, // Hallucinated! Slice was "DermaGlow Vitamin C Serum contains 10%"
        extraction_confidence: 0.95,
      },
      {
        claim_text: "now available for ₹1,999",
        claim_type: "price",
        text_start: 39,
        text_end: 55, // Hallucinated! Slice was "stabilised Vitam"
        extraction_confidence: 0.98,
      },
    ];

    const batch = ClaimOffsetCalculator.resolveBatch(hallucinatedClaims, content);

    assert(batch.resolvedClaims.length === 2, "2.1 Both claims resolved deterministically");
    assert(batch.unresolvedClaims.length === 0, "2.2 Zero unresolved claims");

    const c1 = batch.resolvedClaims[0];
    assert(c1.text_start === 0 && c1.text_end === 59, "2.3 Claim 1 corrected from [0, 38] to [0, 59]");
    assert(
      content.slice(c1.text_start, c1.text_end) === c1.claim_text,
      "2.4 Claim 1 invariant: content.slice(0, 59) === 'DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C'"
    );

    const c2 = batch.resolvedClaims[1];
    assert(c2.text_start === 61 && c2.text_end === 85, "2.5 Claim 2 corrected from [39, 55] to [61, 85]");
    assert(
      content.slice(c2.text_start, c2.text_end) === c2.claim_text,
      "2.6 Claim 2 invariant: content.slice(61, 85) === 'now available for ₹1,999'"
    );

    // Run ClaimValidator end-to-end on the hallucinated claims
    const report = ClaimValidator.validateExtraction({ claims: hallucinatedClaims }, content);
    assert(report.success === true, "2.7 ClaimValidator accepts batch with auto-corrected offsets");
    assert(report.validatedClaims.length === 2, "2.8 Both claims validated into pipeline");
    assert(report.rejectedClaims.length === 0, "2.9 Zero rejected claims in pipeline");
  }

  // ---------------------------------------------------------------------------
  // Suite 3: Unicode Currency Symbols
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 3: Unicode Currency Symbols (₹, €, ¥, £, $) ---");
  {
    const content = "Special sale: ₹1,999 in India, €49.99 in EU, ¥6,500 in Japan, and £35 in UK.";

    // Indian Rupee (₹ U+20B9)
    const inr = ClaimOffsetCalculator.calculateSingleOffset(content, "₹1,999");
    assert(inr.status === "exact_match", "3.1 Indian Rupee (₹) matched exactly");
    assert(content.slice(inr.text_start!, inr.text_end!) === "₹1,999", "3.2 Rupee slice invariant holds");

    // Euro (€ U+20AC)
    const eur = ClaimOffsetCalculator.calculateSingleOffset(content, "€49.99");
    assert(eur.status === "exact_match", "3.3 Euro (€) matched exactly");
    assert(content.slice(eur.text_start!, eur.text_end!) === "€49.99", "3.4 Euro slice invariant holds");

    // Japanese Yen (¥ U+00A5)
    const jpy = ClaimOffsetCalculator.calculateSingleOffset(content, "¥6,500");
    assert(jpy.status === "exact_match", "3.5 Yen (¥) matched exactly");
    assert(content.slice(jpy.text_start!, jpy.text_end!) === "¥6,500", "3.6 Yen slice invariant holds");

    // British Pound (£ U+00A3)
    const gbp = ClaimOffsetCalculator.calculateSingleOffset(content, "£35");
    assert(gbp.status === "exact_match", "3.7 Pound (£) matched exactly");
    assert(content.slice(gbp.text_start!, gbp.text_end!) === "£35", "3.8 Pound slice invariant holds");
  }

  // ---------------------------------------------------------------------------
  // Suite 4: Emoji & Surrogate Pairs (SMP U+10000+)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 4: Emoji & UTF-16 Surrogate Pairs (🧴, ✨, 🌟) ---");
  {
    // "🌟" is U+1F31F (surrogate pair \uD83C\uDF1F, 2 code units)
    // "🧴" is U+1F9F4 (surrogate pair \uD83E\uDDF4, 2 code units)
    // "✨" is U+2728 (1 code unit)
    const content = "🌟 DermaGlow 🧴 with 10% Vitamin C ✨ delivers glowing results!";

    // Claim preceded by surrogate pairs
    const res1 = ClaimOffsetCalculator.calculateSingleOffset(content, "10% Vitamin C");
    assert(res1.status === "exact_match", "4.1 Suffix claim matched across surrogate pairs");
    assert(
      content.slice(res1.text_start!, res1.text_end!) === "10% Vitamin C",
      "4.2 Slice invariant holds across emoji prefix"
    );
    assert(
      ClaimOffsetCalculator.isSurrogateSafe(content, res1.text_start!),
      "4.3 text_start does not split surrogate pair"
    );
    assert(
      ClaimOffsetCalculator.isSurrogateSafe(content, res1.text_end!),
      "4.4 text_end does not split surrogate pair"
    );

    // Claim containing an emoji directly
    const res2 = ClaimOffsetCalculator.calculateSingleOffset(content, "🧴 with 10% Vitamin C");
    assert(res2.status === "exact_match", "4.5 Claim starting with surrogate pair matched");
    assert(
      content.slice(res2.text_start!, res2.text_end!) === "🧴 with 10% Vitamin C",
      "4.6 Slice invariant holds for emoji substring"
    );
    assert(
      ClaimOffsetCalculator.isSurrogateSafe(content, res2.text_start!),
      "4.7 Surrogate pair start is safe"
    );
    assert(
      ClaimOffsetCalculator.isSurrogateSafe(content, res2.text_end!),
      "4.8 Surrogate pair end is safe"
    );
  }

  // ---------------------------------------------------------------------------
  // Suite 5: Repeated Claim Occurrences (1-to-1 Sequential Matching)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 5: Repeated Claim Occurrences (1:1 Sequential Matching) ---");
  {
    const content = "Morning regimen contains 10% Vitamin C. Evening cream also contains 10% Vitamin C.";
    const claims: ModelClaimInput[] = [
      {
        claim_text: "contains 10% Vitamin C",
        claim_type: "product_attribute",
        product_hint: "Morning Regimen",
      },
      {
        claim_text: "contains 10% Vitamin C",
        claim_type: "product_attribute",
        product_hint: "Evening Cream",
      },
    ];

    const batch = ClaimOffsetCalculator.resolveBatch(claims, content);
    assert(batch.resolvedClaims.length === 2, "5.1 Exactly 2 repeated claims resolved");
    assert(batch.unresolvedClaims.length === 0, "5.2 Zero unresolved claims");

    const [first, second] = batch.resolvedClaims;
    assert(first.resolution_status === "sequential_match", "5.3 First claim marked 'sequential_match'");
    assert(second.resolution_status === "sequential_match", "5.4 Second claim marked 'sequential_match'");
    assert(first.text_start < second.text_start, "5.5 Claims resolved in document reading order");
    assert(
      content.slice(first.text_start, first.text_end) === "contains 10% Vitamin C",
      "5.6 First occurrence invariant verified"
    );
    assert(
      content.slice(second.text_start, second.text_end) === "contains 10% Vitamin C",
      "5.7 Second occurrence invariant verified"
    );
  }

  // ---------------------------------------------------------------------------
  // Suite 6: Missing Claim Text (Fabrication Detection)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 6: Missing Claim Text (Fabrication Detection) ---");
  {
    const content = "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C, now available for ₹1,999.";
    const missingClaim = "Eliminates 100% of wrinkles in 3 minutes";

    const res = ClaimOffsetCalculator.calculateSingleOffset(content, missingClaim);
    assert(res.status === "missing", "6.1 Missing claim receives status 'missing'");
    assert(res.isValid === false, "6.2 Missing claim isValid is false");
    assert(res.text_start === null && res.text_end === null, "6.3 text_start and text_end are null");
    assert(res.requiresManualReview === true, "6.4 requiresManualReview is true");
    assert(
      res.reason?.includes("was not found in source content") === true,
      "6.5 Clear descriptive error message emitted",
      res.reason
    );

    // Verify in ClaimValidator
    const report = ClaimValidator.validateExtraction(
      {
        claims: [
          {
            claim_text: missingClaim,
            claim_type: "guarantee",
          },
        ],
      },
      content
    );
    assert(report.success === false, "6.6 ClaimValidator fails when only missing claim provided");
    assert(report.rejectedClaims.length === 1, "6.7 Missing claim strictly rejected");
    assert(report.validatedClaims.length === 0, "6.8 Zero validated claims in pipeline");
  }

  // ---------------------------------------------------------------------------
  // Suite 7: Ambiguous Matches (Occurrences > Extracted Claims)
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 7: Ambiguous Matches (Occurrences > Extracted Claims) ---");
  {
    // "clinically tested" appears 3 times in content
    const content = "Our formula is clinically tested. Every batch is clinically tested. Guaranteed clinically tested.";

    // Only 1 claim extracted for 3 occurrences -> ambiguous!
    const singleClaim: ModelClaimInput[] = [
      {
        claim_text: "clinically tested",
        claim_type: "clinical",
      },
    ];

    const batch = ClaimOffsetCalculator.resolveBatch(singleClaim, content);
    assert(batch.resolvedClaims.length === 0, "7.1 Ambiguous claim is NOT arbitrarily resolved");
    assert(batch.unresolvedClaims.length === 1, "7.2 Ambiguous claim placed in unresolved list");

    const unresolved = batch.unresolvedClaims[0];
    assert(unresolved.status === "ambiguous", "7.3 Status is 'ambiguous'");
    assert(unresolved.requiresManualReview === true, "7.4 requiresManualReview is true");
    assert(unresolved.occurrences.length === 3, "7.5 Found all 3 candidate occurrences");
    assert(
      unresolved.reason.includes("occurs 3 times") && unresolved.reason.includes("only 1 claim"),
      "7.6 Descriptive reason identifies count mismatch",
      unresolved.reason
    );

    // Verify ClaimValidator rejects automatic approval
    const report = ClaimValidator.validateExtraction({ claims: singleClaim }, content);
    assert(report.success === false, "7.7 ClaimValidator rejects ambiguous extraction without guessing");
    assert(report.rejectedClaims.length === 1, "7.8 Rejected claims count is 1");
    assert(report.validatedClaims.length === 0, "7.9 Validated claims count is 0");
  }

  // ---------------------------------------------------------------------------
  // Suite 8: Multiple Claims in One Sentence
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 8: Multiple Claims in One Sentence ---");
  {
    const content = "HydraDefense contains 5% Niacinamide and 2% Hyaluronic Acid at only ₹799.";
    const claims: ModelClaimInput[] = [
      {
        claim_text: "5% Niacinamide",
        claim_type: "product_attribute",
      },
      {
        claim_text: "2% Hyaluronic Acid",
        claim_type: "product_attribute",
      },
      {
        claim_text: "only ₹799",
        claim_type: "price",
      },
    ];

    const batch = ClaimOffsetCalculator.resolveBatch(claims, content);
    assert(batch.resolvedClaims.length === 3, "8.1 All 3 claims in single sentence resolved");
    assert(batch.unresolvedClaims.length === 0, "8.2 Zero unresolved claims");

    const [c1, c2, c3] = batch.resolvedClaims;
    assert(content.slice(c1.text_start, c1.text_end) === "5% Niacinamide", "8.3 Claim 1 span verified");
    assert(content.slice(c2.text_start, c2.text_end) === "2% Hyaluronic Acid", "8.4 Claim 2 span verified");
    assert(content.slice(c3.text_start, c3.text_end) === "only ₹799", "8.5 Claim 3 span verified");

    // Ensure strictly non-overlapping sequential boundaries
    assert(c1.text_end <= c2.text_start, "8.6 Claim 1 precedes Claim 2");
    assert(c2.text_end <= c3.text_start, "8.7 Claim 2 precedes Claim 3");
  }

  // ---------------------------------------------------------------------------
  // Suite 9: Empty and Whitespace-Only Claim Text
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 9: Empty and Whitespace-Only Claim Text ---");
  {
    const content = "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C.";

    const emptyRes = ClaimOffsetCalculator.calculateSingleOffset(content, "");
    assert(emptyRes.status === "empty_text", "9.1 Empty string receives status 'empty_text'");
    assert(emptyRes.isValid === false, "9.2 Empty string isValid is false");
    assert(emptyRes.requiresManualReview === true, "9.3 Empty string requires manual review");

    const whitespaceRes = ClaimOffsetCalculator.calculateSingleOffset(content, "    ");
    assert(whitespaceRes.status === "empty_text", "9.4 Whitespace-only receives status 'empty_text'");
    assert(whitespaceRes.isValid === false, "9.5 Whitespace-only isValid is false");

    // In ClaimValidator
    const report = ClaimValidator.validateExtraction(
      {
        claims: [
          { claim_text: "", claim_type: "product_attribute" },
          { claim_text: "   ", claim_type: "price" },
        ],
      },
      content
    );
    assert(report.success === false, "9.6 ClaimValidator rejects empty claims");
    assert(report.rejectedClaims.length === 2, "9.7 Both empty claims rejected");
    assert(report.validatedClaims.length === 0, "9.8 Zero validated claims");
  }

  // ---------------------------------------------------------------------------
  // Suite 10: Mixed Batch with Valid, Ambiguous, and Missing Claims
  // ---------------------------------------------------------------------------
  console.log("\n--- Suite 10: Mixed Batch with Valid, Ambiguous, and Missing Claims ---");
  {
    const content = "DermaGlow Serum contains 10% Vitamin C. Always choose genuine Vitamin C for ₹1,499.";

    const mixedClaims: ModelClaimInput[] = [
      // 1. Unambiguous exact match
      { claim_text: "contains 10% Vitamin C", claim_type: "product_attribute" },
      // 2. Ambiguous repeated word ("Vitamin C" appears at index 25 and 62)
      { claim_text: "Vitamin C", claim_type: "product_attribute" },
      // 3. Unambiguous price
      { claim_text: "₹1,499", claim_type: "price" },
      // 4. Missing/Fabricated claim
      { claim_text: "100% money back guarantee", claim_type: "guarantee" },
    ];

    const report = ClaimValidator.validateExtraction({ claims: mixedClaims }, content);

    assert(report.validatedClaims.length === 2, "10.1 Exactly 2 unambiguous claims validated");
    assert(report.rejectedClaims.length === 2, "10.2 Exactly 2 unresolvable claims rejected");

    const validatedTexts = report.validatedClaims.map((c) => c.claim_text);
    assert(
      validatedTexts.includes("contains 10% Vitamin C") && validatedTexts.includes("₹1,499"),
      "10.3 Validated claims include the unambiguous product attribute and price"
    );

    const rejectedReasons = report.rejectedClaims.map((r) => r.reason);
    assert(
      rejectedReasons.some((r) => r.includes("Ambiguous match")),
      "10.4 Ambiguous claim identified and flagged"
    );
    assert(
      rejectedReasons.some((r) => r.includes("was not found in source content")),
      "10.5 Missing claim identified and flagged"
    );
  }

  console.log("\n========================================================================");
  console.log(` PHASE 10D TEST SUMMARY: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10DTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
