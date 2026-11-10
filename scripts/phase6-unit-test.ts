/**
 * BRANDSHIELD AI — PHASE 6 ISOLATED UNIT TEST SUITE
 * Human Review Workflow, State Transitions, Override Controls & Publication Gate
 *
 * Runs completely in-memory without requiring live Supabase credentials.
 */

import { ReviewWorkflowService } from "../src/lib/review/review-service";
import { ReviewerRole, EscalationCategory, ReviewStatus } from "../src/types";

async function runTests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 6 ISOLATED UNIT TEST SUITE                 ");
  console.log("       Human Compliance Review & Publication Eligibility Invariants     ");
  console.log("========================================================================\n");

  let passed = 0;
  let failed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail = "") {
    total++;
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

  // 1. Role Authorization
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "supported",
      "low",
      "approved",
      "viewer" as ReviewerRole
    );
    assert(!res.isValid && res.errors[0].includes("not authorized"), "1. Viewer role is strictly prohibited from recording decisions");
  }

  // 2. Standard Approval of Supported Claim
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "supported",
      "low",
      "approved",
      "compliance_reviewer"
    );
    assert(res.isValid && res.newStatus === "approved", "2. Compliance reviewer can approve supported claim without override");
  }

  // 3. Contradicted Claim: Override Required (Rejection on Missing Reason)
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "approved",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("requires a documented override reason")), "3. Approving contradicted claim without override reason is rejected");
  }

  // 4. Contradicted Claim: Override with Insufficient Characters Rejection
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "approved",
      "compliance_reviewer",
      { overrideReason: "Too short" }
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("at least 10 characters")), "4. Override reason under 10 characters is rejected");
  }

  // 5. Contradicted Claim: Valid Documented Policy Override Granted
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "approved",
      "compliance_reviewer",
      { overrideReason: "Legal exception granted under promotional grandfather clause #LG-2026." }
    );
    assert(res.isValid && res.newStatus === "approved", "5. Valid documented policy override reason enables approval of contradicted claim");
  }

  // 6. High Risk Claim: Mandatory Override Check
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "needs_review",
      "high",
      "approved",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("requires a documented override reason")), "6. High risk claim requires documented override reason");
  }

  // 7. Critical Risk Claim: Mandatory Override Check
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "needs_review",
      "critical",
      "approved",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("requires a documented override reason")), "7. Critical risk claim requires documented override reason");
  }

  // 8. Rejection Decision Valid Transition
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "rejected",
      "compliance_reviewer"
    );
    assert(res.isValid && res.newStatus === "rejected", "8. Reviewer rejection transitions claim to rejected");
  }

  // 9. Escalation Decision: Missing Category Rejection
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "escalated",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("escalation category must be specified")), "9. Escalation without categorization is rejected");
  }

  // 10. Escalation Decision: Invalid Category Rejection
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "escalated",
      "compliance_reviewer",
      { escalationCategory: "invalid_category" as EscalationCategory }
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("Invalid escalation category")), "10. Invalid escalation category is rejected");
  }

  // 11. Escalation Decision: Valid Category Acceptance
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "escalated",
      "compliance_reviewer",
      { escalationCategory: "regulatory" }
    );
    assert(res.isValid && res.newStatus === "escalated", "11. Valid escalation category transitions claim to escalated");
  }

  // 12. Modification Decision: Missing Replacement Text Rejection
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "modified",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("valid modified claim text must be supplied")), "12. Modification without revised text is rejected");
  }

  // 13. Modification Decision: Identical Replacement Text Rejection
  {
    const original = "100% cure within 24 hours";
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "modified",
      "compliance_reviewer",
      { originalClaimText: original, modifiedClaimText: original }
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("cannot be identical")), "13. Modification identical to original is rejected");
  }

  // 14. Modification Decision: Valid Revised Phrasing Acceptance
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "contradicted",
      "high",
      "modified",
      "compliance_reviewer",
      { originalClaimText: "100% cure within 24 hours", modifiedClaimText: "Clinically observed radiance support" }
    );
    assert(res.isValid && res.newStatus === "modified", "14. Valid revised phrasing transitions claim to modified");
  }

  // 15. Publication Eligibility: Zero Active Claims Ineligible (Rule 10)
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([]);
    assert(!el.isEligible && el.blockingReasons.some((r) => r.includes("zero active marketing claims")), "15. Submission with zero active claims is strictly ineligible for publication");
  }

  // 16. Publication Eligibility: Unreviewed Claims Block Publication
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "supported", review_status: "approved" },
      { id: "c2", verification_status: "supported", review_status: "pending" },
    ]);
    assert(!el.isEligible && el.unreviewedClaims === 1, "16. Submission with unreviewed pending claims is blocked from publication");
  }

  // 17. Publication Eligibility: Rejected Claims Block Publication
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "supported", review_status: "approved" },
      { id: "c2", verification_status: "contradicted", review_status: "rejected" },
    ]);
    assert(!el.isEligible && el.rejectedClaims === 1, "17. Submission with rejected claims is blocked from publication");
  }

  // 18. Publication Eligibility: Escalated Claims Block Publication
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "supported", review_status: "approved" },
      { id: "c2", verification_status: "needs_review", review_status: "escalated" },
    ]);
    assert(!el.isEligible && el.escalatedClaims === 1, "18. Submission with escalated claims is blocked from publication");
  }

  // 19. Publication Eligibility: Modified Predecessor Claims Block Publication
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "supported", review_status: "approved" },
      { id: "c2", verification_status: "contradicted", review_status: "modified", is_active: true },
    ]);
    assert(!el.isEligible, "19. Active modified claim awaiting replacement verification blocks publication");
  }

  // 20. Publication Eligibility: 100% Approved Claims Passes Gate
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "supported", review_status: "approved" },
      { id: "c2", verification_status: "contradicted", review_status: "approved" }, // Overridden
    ]);
    assert(el.isEligible && el.approvedClaims === 2 && el.blockingReasons.length === 0, "20. Submission with 100% approved claims passes publication eligibility gate");
  }

  // 21. Modified Child Claim: Unverified Child Cannot Be Approved
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "pending",
      "unverified",
      null,
      "approved",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("unverified")), "21. Unverified replacement claim cannot be approved until re-verification succeeds");
  }

  // 22. Superseded Claim: Already Modified Claim Cannot Be Directly Approved
  {
    const res = ReviewWorkflowService.validateReviewTransition(
      "modified",
      "supported",
      "low",
      "approved",
      "compliance_reviewer"
    );
    assert(!res.isValid && res.errors.some((e) => e.includes("superseded")), "22. Superseded modified claim cannot be directly approved");
  }

  // 23. Publication Eligibility: Unverified Claims Block Publication Gate
  {
    const el = ReviewWorkflowService.evaluatePublicationEligibility([
      { id: "c1", verification_status: "unverified", review_status: "approved" },
    ]);
    assert(!el.isEligible && el.blockingReasons.some((r) => r.includes("unverified")), "23. Unverified claims strictly block publication gate");
  }

  // 24. Security Audit: Production Fail-Closed Authentication Gate
  {
    const envRecord = process.env as Record<string, string | undefined>;
    const originalNodeEnv = envRecord.NODE_ENV;
    envRecord.NODE_ENV = "production";
    const { resolveServerSession, AuthenticationRequiredError } = await import("../src/lib/auth/server-session");

    let threwExpected = false;
    try {
      await resolveServerSession();
    } catch (err: unknown) {
      if (err instanceof AuthenticationRequiredError || (err instanceof Error && err.name === "AuthenticationRequiredError")) {
        threwExpected = true;
      }
    } finally {
      envRecord.NODE_ENV = originalNodeEnv;
    }

    assert(threwExpected, "24. Server session resolution strictly fails closed with AuthenticationRequiredError in production");
  }

  // 25. Workspace Membership: Authenticated User with No Workspace Membership Denied
  {
    const { validateUserWorkspaceMembership, WorkspaceAccessError, resolveServerSession } = await import("../src/lib/auth/server-session");
    const isMember = validateUserWorkspaceMembership([], "dermaglow");
    const isMemberNull = validateUserWorkspaceMembership(undefined, "dermaglow");
    assert(!isMember && !isMemberNull, "25. Authenticated user with no workspace membership is denied access");
  }

  // 26. Cross-Workspace Isolation: User Belonging to Different Workspace Denied
  {
    const { validateUserWorkspaceMembership } = await import("../src/lib/auth/server-session");
    const isMemberOther = validateUserWorkspaceMembership(["acme-corp"], "dermaglow");
    assert(!isMemberOther, "26. Cross-workspace access attempt is strictly rejected");
  }

  // 27. Role Authorization: Viewer Role Blocked from Publication
  {
    const { canPublishSubmissions, canReviewClaims, canOverrideContradictedClaims } = await import("../src/lib/auth/server-session");
    const canPub = canPublishSubmissions("viewer");
    const canRev = canReviewClaims("viewer");
    const canOver = canOverrideContradictedClaims("viewer");
    assert(!canPub && !canRev && !canOver, "27. Viewer role is strictly prohibited from review, override, and publication");
  }

  // 28. Role Authorization: Legal Reviewer Can Review and Override but Cannot Publish
  {
    const { canPublishSubmissions, canReviewClaims } = await import("../src/lib/auth/server-session");
    const canPub = canPublishSubmissions("legal_reviewer");
    const canRev = canReviewClaims("legal_reviewer");
    assert(canRev && !canPub, "28. Legal reviewer can review claims but is strictly prohibited from publishing");
  }

  // 29. Modified-Claim Publication Provenance: Compiler Reconciles Approved Revisions
  {
    const originalText = "100% permanently eradicates all wrinkles instantly";
    const approvedRevisedText = "Clinically proven to reduce the visible appearance of fine lines";
    const cleanContent = `Our new serum is fantastic. ${approvedRevisedText}. Apply daily for best results.`;

    const compilation = ReviewWorkflowService.compilePublishedContent(
      cleanContent,
      [
        {
          id: "claim-child-1",
          claim_text: approvedRevisedText,
          review_status: "approved",
          verification_status: "supported",
          original_claim_id: "claim-orig-1",
        },
      ],
      [
        {
          id: "claim-orig-1",
          claim_text: originalText,
        },
      ],
      2
    );

    assert(
      compilation.isPublishable &&
      compilation.reconciledClaimsCount === 1 &&
      compilation.supersededClaimsCount === 1 &&
      compilation.unresolvedNonCompliantPhrases.length === 0,
      "29. Deterministic publication compiler successfully verifies approved revised wording"
    );
  }

  // 30. Modified-Claim Publication Provenance: Original Non-Compliant Wording Blocks Publication
  {
    const originalText = "100% permanently eradicates all wrinkles instantly";
    const approvedRevisedText = "Clinically proven to reduce the visible appearance of fine lines";
    // Corrupted or unspliced content still containing original non-compliant wording!
    const taintedContent = `Our new serum is fantastic. ${originalText}. Apply daily for best results.`;

    const compilation = ReviewWorkflowService.compilePublishedContent(
      taintedContent,
      [
        {
          id: "claim-child-1",
          claim_text: approvedRevisedText,
          review_status: "approved",
          verification_status: "supported",
          original_claim_id: "claim-orig-1",
        },
      ],
      [
        {
          id: "claim-orig-1",
          claim_text: originalText,
        },
      ],
      2
    );

    assert(
      !compilation.isPublishable &&
      compilation.unresolvedNonCompliantPhrases.some((p) => p.includes("Superseded non-compliant wording present")),
      "30. Deterministic compiler strictly blocks publication if original non-compliant wording is still present"
    );
  }

  // 31. Modified-Claim Publication Provenance: Missing Approved Revision Blocks Publication
  {
    const originalText = "100% permanently eradicates all wrinkles instantly";
    const approvedRevisedText = "Clinically proven to reduce the visible appearance of fine lines";
    const mismatchedContent = "Our new serum is fantastic. We removed the claim entirely. Apply daily.";

    const compilation = ReviewWorkflowService.compilePublishedContent(
      mismatchedContent,
      [
        {
          id: "claim-child-1",
          claim_text: approvedRevisedText,
          review_status: "approved",
          verification_status: "supported",
          original_claim_id: "claim-orig-1",
        },
      ],
      [
        {
          id: "claim-orig-1",
          claim_text: originalText,
        },
      ],
      2
    );

    assert(
      !compilation.isPublishable &&
      compilation.unresolvedNonCompliantPhrases.some((p) => p.includes("Approved modified wording missing")),
      "31. Deterministic compiler blocks publication if approved modified wording is missing from document"
    );
  }

  // 32. Publication Gate: Unverified Active Claim Strictly Rejects Compilation
  {
    const approvedText = "Gentle daily hydrating formula";
    const content = `Our new serum is fantastic. ${approvedText}. Apply daily.`;

    const compilation = ReviewWorkflowService.compilePublishedContent(
      content,
      [
        {
          id: "claim-1",
          claim_text: approvedText,
          review_status: "approved",
          verification_status: "unverified", // Unverified active claim!
        },
      ],
      [],
      1
    );

    assert(
      !compilation.isPublishable &&
      compilation.unresolvedNonCompliantPhrases.some((p) => p.includes("Unverified active claim")),
      "32. Deterministic compiler blocks publication if any active claim remains unverified"
    );
  }

  // 33. Database-Dependent Pending Test Notice
  {
    total++;
    console.log("[PENDING] 33. Direct PostgreSQL live transaction & locking test");
    console.log("          └─ Safely deferred: live Supabase database connection string not yet provided.");
  }

  console.log("\n========================================================================");
  console.log(`TEST SUMMARY: ${passed}/${total - 1} passing, ${failed} failed, 1 pending database access.`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

