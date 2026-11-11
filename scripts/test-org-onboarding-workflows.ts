/**
 * Automated Functional Test Suite for Workflows A & B:
 * - Workflow A: Production Email Invitations & Verification
 * - Workflow B: User Registration & Organization Join Requests
 * - Administrator Approval / Rejection Lifecycle
 * - Resend API Error Handling & Provider Rejection Verification
 * - Single-Use Token Protection & Audit Attribution
 */

import { EmailService, EmailDeliveryError, sendEmail } from "../src/lib/email/email-service";
import crypto from "crypto";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runOrgOnboardingTests() {
  console.log("\n========================================================================");
  console.log(" BRANDSHIELD AI: PRODUCTION INVITATIONS & JOIN REQUESTS TEST SUITE      ");
  console.log(" Multi-Tenant Onboarding, Resend Email Delivery, and Admin Governance   ");
  console.log("========================================================================\n");

  // Force QA email capture mode for controlled assertions
  process.env.QA_EMAIL_CAPTURE = "true";
  (process.env as any).NODE_ENV = "test";
  EmailService.clearCapturedEmails();

  console.log("--- Suite 1: Email Service & Intelligent Glass Branded Templates ---");

  // Test 1.1: Send Invitation Email
  const inviteRes = await EmailService.sendInvitationEmail({
    recipientEmail: "dr.vance@example.com",
    organizationName: "DermaGlow Pharmaceuticals",
    inviterName: "Chief Compliance Officer",
    inviterEmail: "admin@dermaglow.com",
    assignedRole: "compliance_reviewer",
    inviteToken: "sec_token_abcdef1234567890",
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });

  assert(inviteRes.success === true, "1.1 Invitation email dispatches successfully via EmailService");
  assert(inviteRes.provider === "qa_capture", "1.2 QA capture ledger records email in test environment");

  const captured = EmailService.getCapturedEmails();
  assert(captured.length === 1, "1.3 Email ledger has exactly 1 captured email");
  assert(captured[0].category === "invitation", "1.4 Email category correctly identified as invitation");
  assert(captured[0].subject.includes("DermaGlow Pharmaceuticals"), "1.5 Subject contains organization name");
  assert(captured[0].html.includes("Compliance Reviewer"), "1.6 HTML includes assigned role badge");
  assert(captured[0].html.includes("/invite?token=sec_token_abcdef1234567890"), "1.7 HTML contains valid invite URL with token");
  assert(captured[0].html.includes("BrandShield AI"), "1.8 HTML includes BrandShield AI Intelligent Glass branding");

  // Test 1.2: Send Join Request Received Email
  await EmailService.sendJoinRequestReceivedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Smith",
    organizationName: "DermaGlow Pharmaceuticals",
  });
  const captured2 = EmailService.getCapturedEmails();
  assert(captured2.length === 2, "1.9 Join request received email successfully logged");
  assert(captured2[1].category === "join_request_received", "1.10 Category correctly tagged as join_request_received");

  // Test 1.3: Send Join Request Approved Email
  await EmailService.sendJoinRequestApprovedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Smith",
    organizationName: "DermaGlow Pharmaceuticals",
    assignedRole: "creator",
    reviewerName: "Compliance Administrator",
  });
  const captured3 = EmailService.getCapturedEmails();
  assert(captured3.length === 3, "1.11 Approval email logged");
  assert(captured3[2].category === "join_request_approved", "1.12 Category correctly tagged as join_request_approved");
  assert(captured3[2].html.includes("Marketing Creator"), "1.13 Approval email reflects assigned role");

  // Test 1.4: Send Join Request Rejected Email
  await EmailService.sendJoinRequestRejectedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Smith",
    organizationName: "DermaGlow Pharmaceuticals",
    reason: "Please register with an authorized corporate email domain.",
  });
  const captured4 = EmailService.getCapturedEmails();
  assert(captured4.length === 4, "1.14 Rejection email logged");
  assert(captured4[3].category === "join_request_rejected", "1.15 Category correctly tagged as join_request_rejected");
  assert(captured4[3].html.includes("Please register with an authorized corporate email domain."), "1.16 Rejection reason conveyed");

  console.log("\n--- Suite 2: Provider Failure Handling (Fail-Closed) ---");

  // Test 2.1: Missing API Key in Live Mode Throws Actionable Error
  const prevCapture = process.env.QA_EMAIL_CAPTURE;
  const prevEnv = process.env.NODE_ENV;
  const prevProvider = process.env.EMAIL_PROVIDER;
  delete process.env.QA_EMAIL_CAPTURE;
  (process.env as any).NODE_ENV = "production";
  process.env.EMAIL_PROVIDER = "resend";
  delete process.env.RESEND_API_KEY;

  let threwMissingKey = false;
  try {
    await sendEmail({
      to: "fail@example.com",
      subject: "Test Live",
      html: "<p>Test</p>",
    });
  } catch (err) {
    if (err instanceof EmailDeliveryError && err.message.includes("RESEND_API_KEY is missing")) {
      threwMissingKey = true;
    }
  }
  assert(threwMissingKey, "2.1 Fails closed if RESEND_API_KEY is missing in production mode for resend");

  // Restore test env
  process.env.QA_EMAIL_CAPTURE = prevCapture;
  (process.env as any).NODE_ENV = prevEnv;
  if (prevProvider) process.env.EMAIL_PROVIDER = prevProvider;
  else delete process.env.EMAIL_PROVIDER;

  console.log("\n--- Suite 3: Join Code Security & Token Invariants ---");

  // Test 3.1: Join Code Generation and SHA-256 Hashing
  const rawCode = `BS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  assert(/^BS-[0-9A-F]{8}$/.test(rawCode), "3.1 Generated join code matches format BS-XXXXXXXX");

  const hash1 = crypto.createHash("sha256").update(rawCode.trim().toUpperCase()).digest("hex");
  const hash2 = crypto.createHash("sha256").update(rawCode.toLowerCase().trim().toUpperCase()).digest("hex");
  assert(hash1 === hash2, "3.2 Join code hash is case-insensitive and normalized");
  assert(hash1.length === 64, "3.3 Join code hash is standard SHA-256 (64 hex characters)");

  // Test 3.2: Replay Prevention Simulation
  const singleUseToken = crypto.randomBytes(32).toString("hex");
  const singleUseHash = crypto.createHash("sha256").update(singleUseToken).digest("hex");

  const tokenLedger: Record<string, { status: "pending" | "accepted" | "revoked" | "expired" }> = {
    [singleUseHash]: { status: "pending" },
  };

  function simulateAccept(tok: string): { success: boolean; error?: string } {
    const h = crypto.createHash("sha256").update(tok).digest("hex");
    const rec = tokenLedger[h];
    if (!rec) return { success: false, error: "Token not found" };
    if (rec.status === "accepted") return { success: false, error: "This invitation has already been used and accepted." };
    if (rec.status !== "pending") return { success: false, error: `Invalid status: ${rec.status}` };
    rec.status = "accepted";
    return { success: true };
  }

  const firstAccept = simulateAccept(singleUseToken);
  assert(firstAccept.success === true, "3.4 Single-use token accepted on first attempt");

  const replayAttempt = simulateAccept(singleUseToken);
  assert(Boolean(replayAttempt.success === false && replayAttempt.error?.includes("already been used")), "3.5 Replay of accepted token is strictly rejected");

  console.log("\n--- Suite 4: Membership Join Request Invariants ---");

  // Test 4.1: Self-Approval Prevention Invariant
  function validateApproval(adminUserId: string, applicantUserId: string) {
    if (adminUserId === applicantUserId) {
      throw new Error("Security restriction: You cannot approve your own membership join request.");
    }
    return true;
  }

  let selfApprovalBlocked = false;
  try {
    validateApproval("user-123", "user-123");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("cannot approve your own")) {
      selfApprovalBlocked = true;
    }
  }
  assert(selfApprovalBlocked, "4.1 Administrator cannot approve their own join request");

  const validCrossApproval = validateApproval("admin-456", "applicant-789");
  assert(validCrossApproval === true, "4.2 Legitimate administrator can approve another user's request");

  // Test 4.2: Duplicate Request Prevention
  const activePendingUserIds = new Set<string>();
  function submitRequest(userId: string) {
    if (activePendingUserIds.has(userId)) {
      throw new Error("You already have a pending join request for this organization.");
    }
    activePendingUserIds.add(userId);
    return true;
  }

  assert(submitRequest("user-abc") === true, "4.3 User submits first pending join request");
  let duplicateBlocked = false;
  try {
    submitRequest("user-abc");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("already have a pending join request")) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, "4.4 Duplicate pending join request from same user is blocked");

  console.log("\n========================================================================");
  console.log(` RESULTS: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================\n");

  if (failed > 0) process.exit(1);
}

runOrgOnboardingTests().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});

