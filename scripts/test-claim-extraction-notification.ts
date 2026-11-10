/**
 * BrandShield AI — Claim Extraction Notification Unit Tests
 *
 * Validates:
 * 1. Exact string format for 1 claim: "AI Claim Extraction complete: Identified 1 claim."
 * 2. Exact string format for 3 claims: "AI Claim Extraction complete: Identified 3 claims."
 * 3. Exact string format for 8 claims: "AI Claim Extraction complete: Identified 8 claims."
 * 4. Pluralization rules (1 claim vs N claims)
 * 5. Dynamic count resolution from API response (claimsCount fallback to claims.length)
 * 6. Internal details exclusion (provider, model, duration not in user notification)
 */

function formatExtractionSuccessNotification(res: {
  claimsCount?: number;
  claims?: Array<unknown>;
}): string {
  const count = res.claimsCount ?? res.claims?.length ?? 0;
  return `AI Claim Extraction complete: Identified ${count} ${count === 1 ? "claim" : "claims"}.`;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, actual?: unknown, expected?: unknown) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (actual !== undefined || expected !== undefined) {
      console.error(`       Expected: ${expected}`);
      console.error(`       Actual:   ${actual}`);
    }
    failed++;
  }
}

console.log("========================================================================");
console.log(" BrandShield AI — Claim Extraction Notification Unit Tests              ");
console.log("========================================================================");

// Test 1: Single claim formatting
const n1 = formatExtractionSuccessNotification({ claimsCount: 1, claims: [{}] });
assert(
  n1 === "AI Claim Extraction complete: Identified 1 claim.",
  "1 claim produces 'AI Claim Extraction complete: Identified 1 claim.'",
  n1,
  "AI Claim Extraction complete: Identified 1 claim."
);

// Test 2: 3 claims formatting
const n3 = formatExtractionSuccessNotification({ claimsCount: 3, claims: [{}, {}, {}] });
assert(
  n3 === "AI Claim Extraction complete: Identified 3 claims.",
  "3 claims produce 'AI Claim Extraction complete: Identified 3 claims.'",
  n3,
  "AI Claim Extraction complete: Identified 3 claims."
);

// Test 3: 8 claims formatting
const n8 = formatExtractionSuccessNotification({ claimsCount: 8, claims: new Array(8).fill({}) });
assert(
  n8 === "AI Claim Extraction complete: Identified 8 claims.",
  "8 claims produce 'AI Claim Extraction complete: Identified 8 claims.'",
  n8,
  "AI Claim Extraction complete: Identified 8 claims."
);

// Test 4: 0 claims formatting
const n0 = formatExtractionSuccessNotification({ claimsCount: 0, claims: [] });
assert(
  n0 === "AI Claim Extraction complete: Identified 0 claims.",
  "0 claims produce 'AI Claim Extraction complete: Identified 0 claims.'",
  n0,
  "AI Claim Extraction complete: Identified 0 claims."
);

// Test 5: Fallback to claims.length if claimsCount is undefined
const nFallback = formatExtractionSuccessNotification({ claims: [{}, {}] });
assert(
  nFallback === "AI Claim Extraction complete: Identified 2 claims.",
  "Fallback to claims.length if claimsCount is omitted",
  nFallback,
  "AI Claim Extraction complete: Identified 2 claims."
);

// Test 6: Internal details exclusion invariant
const samplePayload = {
  claimsCount: 3,
  executionTimeMs: 1159,
  provider: "groq",
  model: "openai/gpt-oss-20b",
  claims: [{}, {}, {}],
};
const formatted = formatExtractionSuccessNotification(samplePayload);
assert(!formatted.includes("1159"), "Excludes processing duration ms", formatted);
assert(!formatted.includes("groq"), "Excludes provider name", formatted);
assert(!formatted.includes("openai/gpt-oss-20b"), "Excludes model identifier", formatted);
assert(!/\b\d+\s*ms\b/i.test(formatted), "Excludes processing duration ms unit", formatted);
assert(!formatted.includes("via"), "Excludes via connector", formatted);

// Test 7: Capitalization invariant ("Identified" with capital I)
assert(formatted.includes("Identified "), "Uses capitalized 'Identified'", formatted);
assert(!formatted.includes("identified "), "Does not use lowercase 'identified'", formatted);

console.log("========================================================================");
console.log(` SUMMARY: ${passed} passed, ${failed} failed.`);
console.log("========================================================================");

if (failed > 0) {
  process.exit(1);
}
