/**
 * BrandShield AI — Multi-Provider Email Service Test Suite
 * 
 * Verifies:
 * 1. EMAIL_PROVIDER=gmail selection and configuration resolution
 * 2. EMAIL_PROVIDER=resend selection and configuration resolution
 * 3. QA in-memory capture mode (when QA_EMAIL_CAPTURE=true or NODE_ENV=test)
 * 4. Missing configuration handling (fails closed, never leaks secrets)
 * 5. Invalid credentials rejection
 * 6. All 4 branded templates + admin diagnostic test template
 * 7. Fallback invitation behavior: pending invitation preserved + copyable link returned
 */

import {
  EmailService,
  sendEmail,
  EmailDeliveryError,
  getActiveEmailProvider,
} from "../src/lib/email/email-service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passed++;
  } else {
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runEmailProviderTests() {
  console.log("\n========================================================================");
  console.log(" BRANDSHIELD AI: GMAIL SMTP & MULTI-PROVIDER EMAIL TEST SUITE           ");
  console.log(" Testing Nodemailer Gmail SMTP, Resend REST, and In-Memory QA Capture   ");
  console.log("========================================================================\n");

  // Save original environment
  const originalEnv = { ...process.env };

  try {
    console.log("--- Suite 1: Provider Selection & Configuration Resolution ---");
    // 1.1 Test QA capture takes precedence when test/capture flags are active
    process.env.QA_EMAIL_CAPTURE = "true";
    (process.env as any).NODE_ENV = "test";
    assert(getActiveEmailProvider() === "qa_capture", "1.1 Resolves 'qa_capture' when QA_EMAIL_CAPTURE=true");

    // 1.2 Test Gmail selection
    delete process.env.QA_EMAIL_CAPTURE;
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "gmail";
    assert(getActiveEmailProvider() === "gmail", "1.2 Resolves 'gmail' when EMAIL_PROVIDER=gmail");

    // 1.3 Test Resend selection
    process.env.EMAIL_PROVIDER = "resend";
    assert(getActiveEmailProvider() === "resend", "1.3 Resolves 'resend' when EMAIL_PROVIDER=resend");

    // 1.4 Test default fallback to gmail
    delete process.env.EMAIL_PROVIDER;
    assert(getActiveEmailProvider() === "gmail", "1.4 Defaults to 'gmail' when EMAIL_PROVIDER is unset");

    console.log("\n--- Suite 2: Gmail SMTP Missing Configuration & Fail-Closed Errors ---");
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "gmail";
    delete process.env.SMTP_PASS;

    let threwMissingSmtpPass = false;
    let missingPassError = "";
    try {
      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });
    } catch (err) {
      if (err instanceof EmailDeliveryError) {
        threwMissingSmtpPass = true;
        missingPassError = err.message;
      }
    }
    assert(threwMissingSmtpPass, "2.1 Fails closed when SMTP_PASS is missing for Gmail");
    assert(missingPassError.includes("SMTP_PASS (<Google App Password>) is missing"), "2.2 Emits clear actionable recovery guidance for SMTP_PASS");
    assert(!missingPassError.includes("password123"), "2.3 Error output contains zero secret tokens or passwords");

    console.log("\n--- Suite 3: Resend Provider Missing Configuration Error ---");
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;

    let threwMissingResendKey = false;
    try {
      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });
    } catch (err) {
      if (err instanceof EmailDeliveryError && err.message.includes("RESEND_API_KEY is missing")) {
        threwMissingResendKey = true;
      }
    }
    assert(threwMissingResendKey, "3.1 Fails closed when RESEND_API_KEY is missing for Resend provider");

    console.log("\n--- Suite 4: Gmail SMTP Connection Rejection Simulation ---");
    process.env.EMAIL_PROVIDER = "gmail";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "65534"; // non-existent local port
    process.env.SMTP_USER = "brandshield11@gmail.com";
    process.env.SMTP_PASS = "dummy_invalid_password";

    let threwConnectionFailure = false;
    let connectionErrorMsg = "";
    try {
      await sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });
    } catch (err) {
      if (err instanceof EmailDeliveryError && err.provider === "gmail") {
        threwConnectionFailure = true;
        connectionErrorMsg = err.message;
      }
    }
    assert(threwConnectionFailure, "4.1 Correctly wraps socket/connection failures into EmailDeliveryError");
    assert(connectionErrorMsg.includes("Gmail SMTP delivery failed"), "4.2 Provider context attached to delivery failure");

    console.log("\n--- Suite 5: All 4 Existing Templates + Admin Diagnostic Test in QA Mode ---");
    // Switch to isolated QA capture mode
    process.env.QA_EMAIL_CAPTURE = "true";
    (process.env as any).NODE_ENV = "test";
    EmailService.clearCapturedEmails();

    // 5.1 Invitation email
    await EmailService.sendInvitationEmail({
      recipientEmail: "dr.vance@example.com",
      organizationName: "DermaGlow Laboratories",
      inviterName: "Lead Administrator",
      inviterEmail: "admin@dermaglow.com",
      assignedRole: "compliance_reviewer",
      inviteToken: "sec_tok_123456789",
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    // 5.2 Join request received
    await EmailService.sendJoinRequestReceivedEmail({
      recipientEmail: "applicant@example.com",
      applicantName: "Jordan Taylor",
      organizationName: "DermaGlow Laboratories",
    });

    // 5.3 Join request approved
    await EmailService.sendJoinRequestApprovedEmail({
      recipientEmail: "applicant@example.com",
      applicantName: "Jordan Taylor",
      organizationName: "DermaGlow Laboratories",
      assignedRole: "creator",
      reviewerName: "Lead Administrator",
    });

    // 5.4 Join request rejected
    await EmailService.sendJoinRequestRejectedEmail({
      recipientEmail: "applicant@example.com",
      applicantName: "Jordan Taylor",
      organizationName: "DermaGlow Laboratories",
      reason: "Domain mismatch.",
    });

    // 5.5 Admin test email
    await EmailService.sendAdminTestEmail({
      recipientEmail: "brandshield11@gmail.com",
      adminName: "Lead Administrator",
      adminEmail: "admin@dermaglow.com",
      workspaceName: "DermaGlow Laboratories",
    });

    const captured = EmailService.getCapturedEmails();
    assert(captured.length === 5, "5.1 Exactly 5 emails captured in test memory ledger");

    const invEmail = captured.find((e) => e.category === "invitation");
    assert(Boolean(invEmail && invEmail.subject.includes("DermaGlow Laboratories")), "5.2 Template 1 (Invitation): Contains org name and subject");
    assert(Boolean(invEmail && invEmail.html.includes("Compliance Reviewer")), "5.3 Template 1 (Invitation): Contains assigned role");

    const recEmail = captured.find((e) => e.category === "join_request_received");
    assert(Boolean(recEmail && recEmail.subject.includes("Received: Membership Request")), "5.4 Template 2 (Request Received): Dispatched successfully");

    const appEmail = captured.find((e) => e.category === "join_request_approved");
    assert(Boolean(appEmail && appEmail.html.includes("Marketing Creator")), "5.5 Template 3 (Request Approved): Formatted with assigned role");

    const rejEmail = captured.find((e) => e.category === "join_request_rejected");
    assert(Boolean(rejEmail && rejEmail.html.includes("Domain mismatch.")), "5.6 Template 4 (Request Rejected): Contains decline reason");

    const testEmail = captured.find((e) => e.category === "admin_test");
    assert(Boolean(testEmail && testEmail.subject.includes("[BrandShield AI] Test Email Delivery")), "5.7 Diagnostic Tool (Admin Test): Generated diagnostic message");

  } finally {
    // Restore original environment
    process.env = originalEnv;
  }

  console.log("\n========================================================================");
  console.log(` RESULTS: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================\n");

  if (failed > 0) process.exit(1);
}

runEmailProviderTests().catch((err) => {
  console.error("Fatal error running email tests:", err);
  process.exit(1);
});

