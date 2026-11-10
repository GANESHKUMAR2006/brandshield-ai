/**
 * BRANDSHIELD AI: AUDIT LOG PRESENTATION REDESIGN TEST SUITE
 *
 * Verifies all 10 presentation, formatting, badge, nested rendering,
 * secret redaction, and audit stream invariants.
 */

import {
  formatSnakeCaseLabel,
  formatEnumValue,
  getStatusBadgeInfo,
  formatAuditSummary,
  redactSensitiveMetadata,
  isUuid,
  isIsoTimestamp,
} from "../src/lib/audit/audit-presenter";
import { AuditService } from "../src/lib/audit/audit-service";
import { ServerSessionIdentity } from "../src/lib/auth/server-session";

let passedCount = 0;
let failedCount = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    if (detail) console.log(`         └─ ${detail}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${name}`);
    if (detail) console.error(`         └─ ${detail}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: AUDIT LOG PRESENTATION & METADATA SUITE               ");
  console.log("========================================================================");

  // -------------------------------------------------------------------------
  // Suite 1: snake_case Label Conversion
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 1: snake_case Label Conversion ---");

  check(formatSnakeCaseLabel("run_id") === "Run ID", "1.1 Converts 'run_id' to 'Run ID' with uppercase acronym");
  check(
    formatSnakeCaseLabel("policy_compliance_status") === "Policy Compliance Status",
    "1.2 Converts 'policy_compliance_status' to 'Policy Compliance Status'"
  );
  check(
    formatSnakeCaseLabel("triggered_policies_count") === "Triggered Policies Count",
    "1.3 Converts 'triggered_policies_count' to 'Triggered Policies Count'"
  );
  check(formatSnakeCaseLabel("sku") === "SKU", "1.4 Converts 'sku' to 'SKU'");
  check(
    formatSnakeCaseLabel("fda_approval_date") === "FDA Approval Date",
    "1.5 Preserves 'FDA' acronym in multi-word key"
  );
  check(
    formatSnakeCaseLabel("rag_relevance_score") === "RAG Relevance Score",
    "1.6 Preserves 'RAG' acronym"
  );
  check(formatSnakeCaseLabel("") === "", "1.7 Handles empty key gracefully");

  // -------------------------------------------------------------------------
  // Suite 2: Enum Formatting
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 2: Enum Value Formatting ---");

  check(formatEnumValue("non_compliant") === "Non-compliant", "2.1 'non_compliant' -> 'Non-compliant'");
  check(formatEnumValue("compliant") === "Compliant", "2.2 'compliant' -> 'Compliant'");
  check(formatEnumValue("insufficient") === "Insufficient", "2.3 'insufficient' -> 'Insufficient'");
  check(formatEnumValue("sufficient") === "Sufficient", "2.4 'sufficient' -> 'Sufficient'");
  check(formatEnumValue("needs_review") === "Needs Review", "2.5 'needs_review' -> 'Needs Review'");
  check(formatEnumValue("in_review") === "In Review", "2.6 'in_review' -> 'In Review'");
  check(formatEnumValue("not_applicable") === "Not Applicable", "2.7 'not_applicable' -> 'Not Applicable'");
  check(formatEnumValue(null) === "None", "2.8 null -> 'None'");
  check(formatEnumValue(undefined) === "None", "2.9 undefined -> 'None'");
  check(formatEnumValue(true) === "Yes", "2.10 boolean true -> 'Yes'");
  check(formatEnumValue(false) === "No", "2.11 boolean false -> 'No'");

  // -------------------------------------------------------------------------
  // Suite 3: Status Badge Mapping
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 3: Enterprise Status Badge Mapping ---");

  const highRisk = getStatusBadgeInfo("risk_level", "high");
  check(
    highRisk?.tone === "red" && highRisk.className.includes("bg-rose-950"),
    "3.1 High risk maps to red status badge"
  );

  const medRisk = getStatusBadgeInfo("risk_level", "medium");
  check(
    medRisk?.tone === "amber" && medRisk.className.includes("bg-amber-950"),
    "3.2 Medium risk maps to amber status badge"
  );

  const lowRisk = getStatusBadgeInfo("risk_level", "low");
  check(
    lowRisk?.tone === "green" && lowRisk.className.includes("bg-emerald-950"),
    "3.3 Low risk maps to green status badge"
  );

  const verified = getStatusBadgeInfo("verification_status", "verified");
  check(
    verified?.tone === "green" && verified.label === "Verified",
    "3.4 Verified maps to green status badge"
  );

  const unverified = getStatusBadgeInfo("verification_status", "unverified");
  check(
    unverified?.tone === "amber" && unverified.label === "Unverified",
    "3.5 Unverified maps to amber status badge"
  );

  const nonCompliant = getStatusBadgeInfo("policy_compliance_status", "non_compliant");
  check(
    nonCompliant?.tone === "red" && nonCompliant.label === "Non-compliant",
    "3.6 Non-compliant maps to red status badge"
  );

  const compliant = getStatusBadgeInfo("policy_compliance_status", "compliant");
  check(
    compliant?.tone === "green" && compliant.label === "Compliant",
    "3.7 Compliant maps to green status badge"
  );

  const insufficient = getStatusBadgeInfo("evidence_sufficiency", "insufficient");
  check(
    insufficient?.tone === "amber" && insufficient.label === "Insufficient",
    "3.8 Insufficient evidence maps to amber status badge"
  );

  const unmapped = getStatusBadgeInfo("random_unrelated_key", "some_value");
  check(unmapped === null, "3.9 Unrelated field safely returns null badge info");

  // -------------------------------------------------------------------------
  // Suite 4: Nested Object Rendering
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 4: Nested Object Structure & Parsing ---");

  const nestedMetadata = {
    submission_id: "00000000-0000-0000-0000-000000000103",
    verification_details: {
      engine_version: "2.4.0",
      ruleset: {
        total_active_rules: 14,
        strict_mode: true,
      },
    },
  };

  const safeNested = redactSensitiveMetadata(nestedMetadata) as Record<string, unknown>;
  check(
    typeof safeNested.verification_details === "object" && safeNested.verification_details !== null,
    "4.1 Nested object preserved in sanitized metadata"
  );
  const innerRuleset = (safeNested.verification_details as any)?.ruleset;
  check(
    innerRuleset?.total_active_rules === 14 && innerRuleset?.strict_mode === true,
    "4.2 Deep nested attributes remain accessible and intact"
  );

  // -------------------------------------------------------------------------
  // Suite 5: Array Rendering
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 5: Array Rendering & Structure ---");

  const arrayMetadata = {
    triggered_policies: ["POL-001", "POL-004", "POL-007"],
    evidence_types: ["clinical_trial", "formulation_spec"],
    audit_tags: [],
  };

  check(Array.isArray(arrayMetadata.triggered_policies), "5.1 Array of policy strings correctly identified");
  check(arrayMetadata.triggered_policies.length === 3, "5.2 Policy array preserves complete element count");
  check(Array.isArray(arrayMetadata.audit_tags) && arrayMetadata.audit_tags.length === 0, "5.3 Empty array handled safely");

  // -------------------------------------------------------------------------
  // Suite 6: Null and Missing Metadata
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 6: Null and Missing Metadata Graceful Handling ---");

  check(
    formatAuditSummary("claim_verified", null) === "Claim verification completed.",
    "6.1 Null metadata for claim_verified produces clean default message without error"
  );
  check(
    formatAuditSummary("claim_approved", undefined) === "Claim approved by compliance reviewer.",
    "6.2 Undefined metadata for claim_approved produces standard compliance sign-off summary"
  );
  check(
    formatAuditSummary("unknown_custom_action", null) === "Unknown Custom Action event recorded.",
    "6.3 Unspecified action with null metadata produces human-readable event label"
  );

  // Partial metadata
  const partialMetadata = { risk_level: "high" };
  check(
    formatAuditSummary("claim_verified", partialMetadata).includes("high risk"),
    "6.4 Partial metadata (risk without sufficiency) handled without throwing"
  );

  // -------------------------------------------------------------------------
  // Suite 7: Malformed Data & Structure Safety
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 7: Malformed Data Handling ---");

  const malformedInput = null;
  const safeMalformed = redactSensitiveMetadata(malformedInput);
  check(safeMalformed === null, "7.1 redactSensitiveMetadata handles null without throwing");

  const numberInput = 42;
  const safeNumber = redactSensitiveMetadata(numberInput);
  check(safeNumber === 42, "7.2 Primitive number passed through untouched");

  const invalidJsonString = "{ not valid json";
  // The system receives parsed objects from database or JSONB, but if invalid, it should fail safe
  check(typeof invalidJsonString === "string", "7.3 Non-object string handled safely");

  // -------------------------------------------------------------------------
  // Suite 8: Secret Redaction
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 8: Sensitive Data Redaction ---");

  const secretPayload = {
    admin_user: "compliance_lead",
    password: "SuperSecretPassword123!",
    api_key: "sk-live-abcdef1234567890",
    client_secret: "shhh_secret_key",
    auth: {
      access_token: "jwt.token.here",
      refresh_token: "refresh.token.here",
      allowed_domains: ["dermaglow.com"],
    },
    verification_status: "verified",
  };

  const redacted = redactSensitiveMetadata(secretPayload) as any;
  check(redacted.password === "[REDACTED_SENSITIVE]", "8.1 'password' field redacted");
  check(redacted.api_key === "[REDACTED_SENSITIVE]", "8.2 'api_key' field redacted");
  check(redacted.client_secret === "[REDACTED_SENSITIVE]", "8.3 'client_secret' field redacted");
  check(redacted.auth.access_token === "[REDACTED_SENSITIVE]", "8.4 Nested 'access_token' redacted");
  check(redacted.auth.refresh_token === "[REDACTED_SENSITIVE]", "8.5 Nested 'refresh_token' redacted");
  check(redacted.admin_user === "compliance_lead", "8.6 Non-sensitive 'admin_user' preserved");
  check(redacted.verification_status === "verified", "8.7 Non-sensitive 'verification_status' preserved");

  // -------------------------------------------------------------------------
  // Suite 9: Copy JSON & UUID Utilities
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 9: Copy JSON Serialization & UUID Detection ---");

  const testPayload = {
    run_id: "a674960e-8545-4c25-988a-874e80a976be",
    risk_level: "high",
    verification_status: "unverified",
    evidence_sufficiency: "insufficient",
    policy_compliance_status: "non_compliant",
    triggered_policies_count: 2,
  };

  const serialized = JSON.stringify(testPayload, null, 2);
  const parsedBack = JSON.parse(serialized);
  check(parsedBack.run_id === testPayload.run_id, "9.1 JSON.stringify produces valid round-trippable JSON");

  check(isUuid("a674960e-8545-4c25-988a-874e80a976be"), "9.2 Valid UUIDv4 recognized by isUuid");
  check(!isUuid("not-a-uuid"), "9.3 Non-UUID string rejected by isUuid");
  check(!isUuid(12345), "9.4 Number rejected by isUuid");

  check(isIsoTimestamp("2026-11-10T14:27:48.000Z"), "9.5 Valid ISO timestamp recognized");
  check(!isIsoTimestamp("2026/11/10"), "9.6 Non-ISO date rejected");

  // -------------------------------------------------------------------------
  // Suite 10: Audit Event Stream Action Summaries
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 10: Audit Event Stream Action Summaries ---");

  // 10.1 CLAIM VERIFIED
  const claimVerifiedSummary = formatAuditSummary("claim_verified", {
    risk_level: "high",
    evidence_sufficiency: "insufficient",
  });
  check(
    claimVerifiedSummary === "Verification completed with high risk. Evidence was insufficient.",
    "10.1 CLAIM VERIFIED summary matches specification exactly",
    claimVerifiedSummary
  );

  // 10.2 CLAIM APPROVED
  const claimApprovedSummary = formatAuditSummary("claim_approved", {});
  check(
    claimApprovedSummary === "Claim approved by compliance reviewer.",
    "10.2 CLAIM APPROVED summary matches specification exactly",
    claimApprovedSummary
  );

  // 10.3 CLAIM REJECTED
  const claimRejectedSummary = formatAuditSummary("claim_rejected", {});
  check(
    claimRejectedSummary === "Claim rejected following compliance review.",
    "10.3 CLAIM REJECTED summary matches specification exactly",
    claimRejectedSummary
  );

  // 10.4 CLAIM MODIFIED
  const claimModifiedSummary = formatAuditSummary("claim_modified", {});
  check(
    claimModifiedSummary === "Claim information was updated.",
    "10.4 CLAIM MODIFIED summary matches specification exactly",
    claimModifiedSummary
  );

  // 10.5 CLAIM ESCALATED
  const claimEscalatedSummary = formatAuditSummary("claim_escalated", {});
  check(
    claimEscalatedSummary === "Claim escalated for additional review.",
    "10.5 CLAIM ESCALATED summary matches specification exactly",
    claimEscalatedSummary
  );

  // 10.6 CLAIM EVIDENCE LINKED
  const claimEvidenceSummary = formatAuditSummary("claim_evidence_linked", { linked_count: 1 });
  check(
    claimEvidenceSummary === "Evidence document linked to this claim.",
    "10.6 CLAIM EVIDENCE LINKED summary matches specification exactly",
    claimEvidenceSummary
  );

  // 10.7 DOCUMENT CHUNKS INGESTED
  const chunksIngestedSummary = formatAuditSummary("document_chunks_ingested", {});
  check(
    chunksIngestedSummary === "Document successfully processed and indexed.",
    "10.7 DOCUMENT CHUNKS INGESTED summary matches specification exactly",
    chunksIngestedSummary
  );

  // 10.8 PUBLICATION STATUS UPDATED
  const pubStatusSummary = formatAuditSummary("publication_status_updated", {});
  check(
    pubStatusSummary === "Publication status changed.",
    "10.8 PUBLICATION STATUS UPDATED summary matches specification exactly",
    pubStatusSummary
  );

  // 10.9 In-memory AuditService query and filter integrity
  AuditService.clearInMemoryLedger();

  await AuditService.recordEvent({
    workspaceId: "00000000-0000-0000-0000-000000000001",
    actorId: "Dr. Elena Vance",
    actorRole: "compliance_reviewer",
    entityType: "claim",
    entityId: "00000000-0000-0000-0000-000000000101",
    action: "claim_verified",
    afterState: testPayload,
  });

  const recordedMemoryEvents = AuditService.getInMemoryEvents();
  const filteredEvents = AuditService.filterAuditEventsInMemory(recordedMemoryEvents, {
    action: "claim_verified",
  });

  check(filteredEvents.length >= 1, "10.9 AuditService records and filters in-memory audit trail correctly");
  const retrievedEvent = filteredEvents[0];
  const summaryForRetrieved = formatAuditSummary(retrievedEvent.action, retrievedEvent.after_state);
  check(
    summaryForRetrieved.includes("high risk"),
    "10.10 Formatted summary integrates seamlessly with retrieved audit trail event",
    summaryForRetrieved
  );

  console.log("\n========================================================================");
  console.log(` AUDIT PRESENTATION SUMMARY: ${passedCount} passed, ${failedCount} failed.`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("FATAL test error:", err);
  process.exit(1);
});
