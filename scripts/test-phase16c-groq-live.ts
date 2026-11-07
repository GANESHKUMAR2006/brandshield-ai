/**
 * BrandShield AI — Phase 16C: Groq AI Provider Implementation & Live Verification
 * 
 * Tests the GroqProvider integration:
 * 1. Provider architecture & resolver checks.
 * 2. Configuration & credential safety (no secrets logged).
 * 3. Makes ONE live inference request to Groq with synthetic test content.
 * 4. Validates returned claims against production Zod schema.
 * 5. Verifies UTF-16 exact character offsets and verbatim substring equality.
 * 6. Records extraction provenance (provider: groq, model: openai/gpt-oss-20b, promptVersion).
 * 7. Measures actual inference latency and token usage.
 */

import { getConfiguredProvider } from "../src/lib/ai/providers/configured-provider";
import { GroqProvider } from "../src/lib/ai/providers/groq-provider";
import { MockLLMProvider } from "../src/lib/ai/providers/mock-provider";
import { ClaimValidator } from "../src/lib/ai/validation/claim-validator";
import { EXTRACTION_PROMPT_VERSION } from "../src/lib/ai/extraction/extraction-prompt";

async function runGroqVerification() {
  console.log("========================================================================");
  console.log("   BRANDSHIELD AI: PHASE 16C GROQ AI INTEGRATION & SMOKE TEST           ");
  console.log("========================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      if (details) console.log(`       └─ ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      if (details) console.error(`       └─ ${details}`);
      process.exit(1);
    }
  }

  // 1. Architecture & Resolver Verification
  console.log("--- Suite 1: Provider Architecture & Resolver ---");
  const rawProvider = getConfiguredProvider();
  if (!(rawProvider instanceof GroqProvider)) {
    console.error(`[FAIL] Expected GroqProvider, got ${rawProvider.constructor.name}`);
    process.exit(1);
  }
  const provider = rawProvider;
  assert(
    provider instanceof GroqProvider,
    "1.1 getConfiguredProvider() instantiates GroqProvider when LLM_PROVIDER=groq",
    `Instance: ${provider.constructor.name}`
  );
  assert(
    provider.providerName === "groq",
    "1.2 Provider identifies with providerName 'groq'",
    `providerName: "${provider.providerName}"`
  );
  assert(
    provider.baseURL === "https://api.groq.com/openai/v1",
    "1.3 Base URL defaults to official Groq OpenAI-compatible endpoint",
    `baseURL: "${provider.baseURL}"`
  );
  assert(
    provider.modelIdentifier === "openai/gpt-oss-20b",
    "1.4 Model identifier defaults to 'openai/gpt-oss-20b'",
    `model: "${provider.modelIdentifier}"`
  );
  assert(
    !(provider as unknown instanceof MockLLMProvider),
    "1.5 Anti-Mock invariant: Provider is strictly NOT MockLLMProvider"
  );

  // 2. Credential Verification (Without Leaking Secrets)
  console.log("\n--- Suite 2: Credential Security & Server-Side Availability ---");
  const rawKey = process.env.GROQ_API_KEY;
  assert(
    Boolean(rawKey && rawKey.trim().length > 0),
    "2.1 GROQ_API_KEY is present in environment"
  );
  assert(
    Boolean(rawKey && rawKey.startsWith("gsk_")),
    "2.2 GROQ_API_KEY has valid format prefix 'gsk_***'",
    `Prefix valid: true, Key length: ${rawKey?.length} chars`
  );
  assert(
    Boolean(rawKey && !rawKey.includes("placeholder") && !rawKey.includes("your_groq")),
    "2.3 GROQ_API_KEY is not a placeholder",
    `Secret redacted: [CONFIRMED SECURE]`
  );

  // 3. Live Smoke Test (ONE Live Request)
  console.log("\n--- Suite 3: Live Groq Inference Execution (Single Request) ---");
  const syntheticText = "DermaGlow Vitamin C Serum contains 15% Vitamin C and is available for ₹1,499.";
  console.log(`Synthetic Advertisement Content: "${syntheticText}"`);
  console.log("Dispatching live inference request to Groq (openai/gpt-oss-20b)...");

  const startTime = Date.now();
  const result = await provider.extractClaims({
    content: syntheticText,
    submissionTitle: "DermaGlow Phase 16C Synthetic Ad",
    channel: "Website",
    knownProducts: [
      {
        id: "00000000-0000-0000-0000-000000000010",
        name: "DermaGlow Vitamin C Serum",
        sku: "DG-VTC-001",
      },
    ],
  });
  const latencyMs = Date.now() - startTime;

  assert(
    Boolean(result && Array.isArray(result.rawClaims)),
    "3.1 Live Groq API response received",
    `Latency: ${latencyMs}ms (${(latencyMs / 1000).toFixed(2)}s)`
  );
  assert(
    result.rawClaims.length >= 2,
    "3.2 Groq extracted expected atomic candidate claims",
    `Extracted candidates: ${result.rawClaims.length}`
  );

  // 4. Production Schema Validation
  console.log("\n--- Suite 4: Production Zod Schema Validation ---");
  const validationReport = ClaimValidator.validateExtraction(result.rawClaims, syntheticText);
  assert(
    validationReport.success,
    "4.1 ClaimValidator accepts batch with auto-corrected offsets",
    `Success: ${validationReport.success}, Errors: ${validationReport.validationErrors.length}`
  );
  assert(
    validationReport.validatedClaims.length >= 2,
    "4.2 Extracted claims successfully validated into production pipeline",
    `Validated claims: ${validationReport.validatedClaims.length}`
  );
  assert(
    validationReport.rejectedClaims.length === 0,
    "4.3 Zero rejected claims from valid synthetic copy",
    `Rejected claims: ${validationReport.rejectedClaims.length}`
  );

  // 5. UTF-16 Exact Substring Invariants
  console.log("\n--- Suite 5: UTF-16 Offset & Exact Span Invariants ---");
  for (let i = 0; i < validationReport.validatedClaims.length; i++) {
    const claim = validationReport.validatedClaims[i];
    const sliced = syntheticText.slice(claim.text_start, claim.text_end);
    const invariantHolds = sliced === claim.claim_text;
    console.log(`   Claim ${i + 1}: "${claim.claim_text}"`);
    console.log(`     └─ Type: [${claim.claim_type}], Category: [${claim.claim_type}]`);
    console.log(`     └─ Offsets: [${claim.text_start}, ${claim.text_end}]`);
    console.log(`     └─ Content slice: "${sliced}"`);
    console.log(`     └─ Confidence: ${claim.extraction_confidence}`);
    assert(
      invariantHolds,
      `5.${i + 1} Exact slice invariant holds: content.slice(${claim.text_start}, ${claim.text_end}) === claim_text`,
      `"${sliced}" === "${claim.claim_text}"`
    );
  }

  // 6. Provenance & Metadata Verification
  console.log("\n--- Suite 6: Extraction Provenance & Model Telemetry ---");
  assert(
    result.provider === "groq",
    "6.1 Provenance records provider as 'groq'",
    `result.provider: "${result.provider}"`
  );
  assert(
    result.modelIdentifier === "openai/gpt-oss-20b",
    "6.2 Provenance records model as 'openai/gpt-oss-20b'",
    `result.modelIdentifier: "${result.modelIdentifier}"`
  );
  assert(
    result.promptVersion === EXTRACTION_PROMPT_VERSION,
    "6.3 Provenance records prompt version matching EXTRACTION_PROMPT_VERSION",
    `result.promptVersion: "${result.promptVersion}"`
  );

  if (result.usage) {
    console.log(`   Token Usage:`);
    console.log(`     └─ Prompt tokens: ${result.usage.promptTokens ?? "N/A"}`);
    console.log(`     └─ Completion tokens: ${result.usage.completionTokens ?? "N/A"}`);
    console.log(`     └─ Total tokens: ${result.usage.totalTokens ?? "N/A"}`);
  }

  console.log("\n========================================================================");
  console.log(` PHASE 16C GROQ TEST SUMMARY: ${passed}/${total} checks passed successfully.`);
  console.log(` Live Groq AI inference is OPERATIONAL and verified end-to-end.`);
  console.log("========================================================================");
}

runGroqVerification().catch((err) => {
  console.error("FATAL: Groq verification failed:", err);
  process.exit(1);
});
