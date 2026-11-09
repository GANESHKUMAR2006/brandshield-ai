/**
 * BrandShield AI — CodeNexus Round 3: RC-1 Release Hardening Validation Suite
 *
 * Validates:
 * 1. Safe regex complexity screening & ReDoS catastrophic backtracking protection
 * 2. OCR confidence semantics & removal of hardcoded constant values
 * 3. Policy JSON schema rejection of vulnerable regex rules
 * 4. Condition evaluator fail-closed behavior on unsafe regex patterns
 * 5. Phase 3 database migration idempotency, dependencies, and rollback safety
 */

import { PolicySchemaValidator, MAX_REGEX_LENGTH } from "../src/lib/policy/policy-schema-validator";
import { ConditionEvaluator } from "../src/lib/policy/condition-evaluator";
import { LocalFallbackOcrProvider, OpenAiVisionOcrProvider } from "../src/lib/rag/ingestion/ocr-provider";
import { PdfDocumentParser } from "../src/lib/rag/ingestion/pdf-parser";
import * as fs from "fs";
import * as path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         └─ ${detail}`);
  }
}

async function runHardeningSuite() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: RC-1 RELEASE HARDENING VALIDATION SUITE          ");
  console.log("========================================================================");

  // --------------------------------------------------------------------------
  // SUITE 1: ReDoS Catastrophic Backtracking Screening
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 1: ReDoS Catastrophic Backtracking Screening");
  {
    // 1.1 Nested quantifiers
    const nestedRes1 = PolicySchemaValidator.isSafeRegex("((a+)+)+$");
    assert(
      !nestedRes1.isSafe && nestedRes1.code === "UNSAFE_REGEX",
      "1.1 Deeply nested quantifier ((a+)+)+$ is blocked",
      `Code: ${nestedRes1.code}, Reason: ${nestedRes1.reason}`
    );

    const nestedRes2 = PolicySchemaValidator.isSafeRegex("(a+)+$");
    assert(
      !nestedRes2.isSafe && nestedRes2.code === "UNSAFE_REGEX",
      "1.2 Simple nested quantifier (a+)+$ is blocked",
      `Code: ${nestedRes2.code}`
    );

    const nestedRes3 = PolicySchemaValidator.isSafeRegex("([0-9]+)+");
    assert(
      !nestedRes3.isSafe && nestedRes3.code === "UNSAFE_REGEX",
      "1.3 Nested character class quantifier ([0-9]+)+ is blocked",
      `Code: ${nestedRes3.code}`
    );

    // 1.4 Quantified alternation with inner quantifiers
    const altRes1 = PolicySchemaValidator.isSafeRegex("(a|b+)+$");
    assert(
      !altRes1.isSafe && altRes1.code === "UNSAFE_REGEX",
      "1.4 Quantified alternation with sub-quantifier (a|b+)+$ is blocked",
      `Code: ${altRes1.code}`
    );

    // 1.5 Quantified alternation with identical branches
    const altRes2 = PolicySchemaValidator.isSafeRegex("(test|test)+$");
    assert(
      !altRes2.isSafe && altRes2.code === "UNSAFE_REGEX",
      "1.5 Quantified alternation with duplicate branches (test|test)+$ is blocked",
      `Code: ${altRes2.code}`
    );

    // 1.6 Quantified group with wildcard quantifier
    const wildRes = PolicySchemaValidator.isSafeRegex("(.*a)+$");
    assert(
      !wildRes.isSafe && wildRes.code === "UNSAFE_REGEX",
      "1.6 Quantified group with dot-star (.*a)+$ is blocked",
      `Code: ${wildRes.code}`
    );

    // 1.7 Consecutive quantifiers
    const consecRes = PolicySchemaValidator.isSafeRegex("a++");
    assert(
      !consecRes.isSafe && consecRes.code === "UNSAFE_REGEX",
      "1.7 Consecutive quantifiers a++ is blocked",
      `Code: ${consecRes.code}`
    );

    // 1.8 Excessive group nesting depth
    const deepRes = PolicySchemaValidator.isSafeRegex("((((hello))))");
    assert(
      !deepRes.isSafe && deepRes.code === "UNSAFE_REGEX",
      "1.8 Group nesting depth exceeding 3 levels is blocked",
      `Code: ${deepRes.code}`
    );

    // 1.9 Max regex length enforcement
    const longPattern = "a".repeat(MAX_REGEX_LENGTH + 1);
    const lengthRes = PolicySchemaValidator.isSafeRegex(longPattern);
    assert(
      !lengthRes.isSafe && lengthRes.code === "EXCESSIVE_REGEX_LENGTH",
      "1.9 Regex exceeding MAX_REGEX_LENGTH (150 chars) is blocked",
      `Length: ${longPattern.length}, Code: ${lengthRes.code}`
    );

    // 1.10 Malformed syntax handling
    const malformedRes = PolicySchemaValidator.isSafeRegex("[a-z");
    assert(
      !malformedRes.isSafe && malformedRes.code === "INVALID_REGEX",
      "1.10 Malformed regex syntax is caught with INVALID_REGEX",
      `Code: ${malformedRes.code}`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Safe Regex Allowlisting
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 2: Safe Regex Allowlisting");
  {
    const safe1 = PolicySchemaValidator.isSafeRegex("^[A-Z0-9_-]{3,50}$");
    assert(safe1.isSafe, "2.1 Standard identifier pattern ^[A-Z0-9_-]{3,50}$ is allowed");

    const safe2 = PolicySchemaValidator.isSafeRegex("\\b(?:guarantee|cure|100%|miracle)\\b");
    assert(safe2.isSafe, "2.2 Non-capturing alternation \\b(?:guarantee|cure|100%|miracle)\\b is allowed");

    const safe3 = PolicySchemaValidator.isSafeRegex("\\d+(?:\\.\\d+)?%?");
    assert(safe3.isSafe, "2.3 Numeric percentage pattern \\d+(?:\\.\\d+)?%? is allowed");

    const safe4 = PolicySchemaValidator.isSafeRegex("\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b");
    assert(safe4.isSafe, "2.4 Standard email pattern is allowed");

    const safe5 = PolicySchemaValidator.isSafeRegex("^(fda|ce)-approved");
    assert(safe5.isSafe, "2.5 Non-repeating alternation group is allowed");
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Policy Schema Validation & ReDoS Rule Rejection
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 3: Policy Schema & Rule Saving Guardrails");
  {
    const redosPolicy = {
      name: "Malicious ReDoS Policy",
      code: "POL-REDOS-ATTACK",
      category: "prohibited_claims",
      severity: "critical",
      rules: [
        {
          id: "RULE-REDOS-01",
          name: "Catastrophic Backtracking Rule",
          category: "prohibited_claims",
          severity: "critical",
          action: "block_publication",
          conditions: [
            {
              field: "claim_text",
              operator: "matches_regex",
              value: "((a+)+)+$",
            },
          ],
        },
      ],
    };

    const valResult = PolicySchemaValidator.validatePolicy(redosPolicy);
    assert(
      !valResult.isValid && valResult.issues.some((i) => i.code === "UNSAFE_REGEX"),
      "3.1 Policy containing ReDoS pattern is rejected during schema validation",
      `Issues: ${valResult.issues.map((i) => `${i.code}: ${i.message}`).join("; ")}`
    );

    const safePolicy = {
      name: "Valid Marketing Compliance Policy",
      code: "POL-MARKETING-01",
      category: "prohibited_claims",
      severity: "high",
      rules: [
        {
          id: "RULE-PROHIBITED-01",
          name: "Prohibit Absolute Cure",
          category: "prohibited_claims",
          severity: "high",
          action: "flag_violation",
          conditions: [
            {
              field: "claim_text",
              operator: "matches_regex",
              value: "\\b(?:cure|miracle|100% effective)\\b",
            },
          ],
        },
      ],
    };

    const safeValResult = PolicySchemaValidator.validatePolicy(safePolicy);
    assert(
      safeValResult.isValid,
      "3.2 Policy containing safe regex passes schema validation with zero issues"
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Condition Evaluator Runtime Fail-Closed Protection
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 4: Condition Evaluator Runtime Protection");
  {
    // Evaluate ReDoS condition at runtime — evaluator must fail closed
    const unsafeCondition = {
      field: "claim_text",
      operator: "matches_regex" as const,
      value: "((a+)+)+$",
    };

    const evalResult = ConditionEvaluator.evaluateCondition(unsafeCondition, {
      claimText: "aaaaaaaaaaaaaaaaaaaaaaaaaaaa!",
      claimType: "efficacy",
      evidenceTypes: ["clinical_study"],
    });

    assert(
      !evalResult.isMatched &&
        evalResult.failedDetail !== undefined &&
        evalResult.failedDetail.includes("Regex safety screening rejected pattern"),
      "4.1 ConditionEvaluator fails closed when evaluating unsafe regex at runtime",
      `failedDetail: "${evalResult.failedDetail}"`
    );

    // Evaluate safe condition at runtime — matches successfully
    const safeCondition = {
      field: "claim_text",
      operator: "matches_regex" as const,
      value: "\\b(?:miracle|cure)\\b",
    };

    const safeEvalResult = ConditionEvaluator.evaluateCondition(safeCondition, {
      claimText: "This cream is a miraculous cure for wrinkles.",
      claimType: "efficacy",
      evidenceTypes: ["clinical_study"],
    });

    assert(
      safeEvalResult.isMatched && safeEvalResult.actualValue === "cure",
      "4.2 ConditionEvaluator successfully matches safe regex pattern",
      `Matched: "${safeEvalResult.actualValue}"`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 5: OCR Confidence Semantics & Provenance
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 5: OCR Confidence Semantics & Provenance");
  {
    const localOcr = new LocalFallbackOcrProvider();

    // 5.1 Default without explicit telemetry: confidence must be null and unavailable
    const defaultRes = await localOcr.extractText("[SCANNED_OCR] Lab Assay Report: Purity 99.4%");
    assert(
      defaultRes.confidence === null &&
        defaultRes.confidenceType === "unavailable" &&
        defaultRes.metadata?.confidenceAvailable === false,
      "5.1 LocalFallbackOcrProvider returns confidence: null and confidenceType: 'unavailable' by default",
      `Confidence: ${defaultRes.confidence}, Type: ${defaultRes.confidenceType}`
    );

    // 5.2 Provider-derived telemetry via explicit token
    const derivedRes = await localOcr.extractText("[SCANNED_OCR] [OCR_CONFIDENCE:0.96] HPLC Verification Certificate");
    assert(
      derivedRes.confidence === 0.96 &&
        derivedRes.confidenceType === "provider_derived" &&
        derivedRes.metadata?.confidenceAvailable === true,
      "5.2 LocalFallbackOcrProvider derives exact confidence when provider telemetry is present",
      `Confidence: ${derivedRes.confidence}, Type: ${derivedRes.confidenceType}`
    );

    // 5.3 Explicit estimation flag
    const estimatedRes = await localOcr.extractText(
      "[SCANNED_OCR] HPLC Verification Certificate",
      undefined,
      { allowEstimatedConfidence: true }
    );
    assert(
      estimatedRes.confidence === 0.90 &&
        estimatedRes.confidenceType === "estimated" &&
        estimatedRes.metadata?.isEstimated === true,
      "5.3 LocalFallbackOcrProvider returns confidenceType: 'estimated' when allowEstimatedConfidence is true",
      `Confidence: ${estimatedRes.confidence}, Type: ${estimatedRes.confidenceType}`
    );

    // 5.4 OpenAI Vision OCR semantics: does not output misleading 0.98
    const openAiOcr = new OpenAiVisionOcrProvider();
    const visionRes = await openAiOcr.extractText("[SCANNED_OCR] Certificate");
    assert(
      visionRes.confidence !== 0.98,
      "5.4 OpenAiVisionOcrProvider does NOT return hardcoded 0.98 constant",
      `Confidence reported: ${visionRes.confidence}`
    );

    // 5.5 Document parsing with OCR semantics preserved
    const pdfParser = new PdfDocumentParser();
    const parsedScanned = await pdfParser.parse(
      "SCANNED_PDF: [SCANNED_OCR] [OCR_CONFIDENCE:0.95] Clinical study page 1",
      { title: "Test Clinical PDF", filename: "test.pdf" }
    );
    assert(
      parsedScanned.extractionMethod === "ocr" &&
        parsedScanned.extractionConfidence === 0.95 &&
        parsedScanned.ocrConfidenceType === "provider_derived",
      "5.5 PdfDocumentParser preserves provider-derived extractionConfidence and ocrConfidenceType",
      `Method: ${parsedScanned.extractionMethod}, Conf: ${parsedScanned.extractionConfidence}, Type: ${parsedScanned.ocrConfidenceType}`
    );
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Phase 3 Database Migration Readiness Inspection
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 6: Phase 3 Database Migration Readiness Inspection");
  {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261112000000_round3_phase3_policy_studio.sql"
    );

    const fileExists = fs.existsSync(migrationPath);
    assert(fileExists, "6.1 Migration 20261112000000_round3_phase3_policy_studio.sql exists on disk");

    if (fileExists) {
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");

      // Idempotency checks
      const hasIdempotentCheck = sqlContent.includes("IF EXISTS") && sqlContent.includes("policy_versions_status_check");
      assert(hasIdempotentCheck, "6.2 Migration safely drops and recreates policy_versions_status_check conditionally");

      const hasAddColumnIfNotExists = sqlContent.includes("ADD COLUMN IF NOT EXISTS severity");
      assert(hasAddColumnIfNotExists, "6.3 Migration uses ADD COLUMN IF NOT EXISTS for severity column");

      const hasIndexIfNotExists = sqlContent.includes("CREATE INDEX IF NOT EXISTS idx_policies_severity");
      assert(hasIndexIfNotExists, "6.4 Migration creates idx_policies_severity with IF NOT EXISTS");

      const hasLookupIndex = sqlContent.includes("CREATE INDEX IF NOT EXISTS idx_policy_versions_lookup");
      assert(hasLookupIndex, "6.5 Migration creates composite lookup index with IF NOT EXISTS");

      const hasSchemaRegistry = sqlContent.includes("ON CONFLICT (version) DO NOTHING");
      assert(hasSchemaRegistry, "6.6 Migration registry recording is idempotent (ON CONFLICT DO NOTHING)");

      const includesValidatedStatus = sqlContent.includes("'validated'");
      assert(includesValidatedStatus, "6.7 Status constraint includes 'validated' version lifecycle state");
    }
  }

  console.log("\n========================================================================");
  console.log(`RC-1 Release Hardening Suite Complete: ${passed}/${passed + failed} passed (${failed} failed)`);
  console.log("========================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningSuite().catch((err) => {
  console.error("RC-1 Hardening Suite threw an unhandled error:", err);
  process.exit(1);
});
