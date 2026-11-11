/**
 * BrandShield AI — Transactional Email Inspection & Visual Verification Suite
 * 
 * Verifies that all 4 transactional templates + admin diagnostic email:
 * 1. Comply with the Enterprise Clean Email design (white/neutral background, no gradients/glassmorphism)
 * 2. Contain table-based Outlook & Gmail compatible layout
 * 3. Contain plain-text fallback links
 * 4. Contain meaningful plain-text alternatives (`text`)
 * 5. Safely HTML-escape dynamic inputs
 * 6. Correctly resolve environment base URLs
 */

import { EmailService, escapeHtml, getAppBaseUrl, renderBrandedLayout } from "../src/lib/email/email-service";

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

async function runInspection() {
  console.log("\n========================================================================");
  console.log(" BRANDSHIELD AI: TRANSACTIONAL EMAIL TEMPLATE DESIGN INSPECTION         ");
  console.log("========================================================================\n");

  // Force QA email capture mode
  process.env.QA_EMAIL_CAPTURE = "true";
  (process.env as any).NODE_ENV = "test";
  EmailService.clearCapturedEmails();

  console.log("--- Test 1: HTML Escaping Helper ---");
  const rawInput = '<script>alert("xss")</script> & "quotes" & \'single\'';
  const escaped = escapeHtml(rawInput);
  assert(!escaped.includes("<script>"), "1.1 HTML tags are properly escaped");
  assert(escaped.includes("&lt;script&gt;"), "1.2 < is converted to &lt;");
  assert(escaped.includes("&amp;"), "1.3 & is converted to &amp;");
  assert(escaped.includes("&quot;"), "1.4 \" is converted to &quot;");
  assert(escaped.includes("&#39;"), "1.5 ' is converted to &#39;");

  console.log("\n--- Test 2: Base URL Resolution ---");
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalRenderUrl = process.env.RENDER_EXTERNAL_URL;

  process.env.NEXT_PUBLIC_APP_URL = "https://app.brandshield.ai/";
  assert(getAppBaseUrl() === "https://app.brandshield.ai", "2.1 Strips trailing slashes from NEXT_PUBLIC_APP_URL");

  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.RENDER_EXTERNAL_URL = "https://brandshield-ai.onrender.com";
  assert(getAppBaseUrl() === "https://brandshield-ai.onrender.com", "2.2 Falls back to RENDER_EXTERNAL_URL when APP_URL is absent");

  delete process.env.RENDER_EXTERNAL_URL;
  (process.env as any).NODE_ENV = "production";
  assert(getAppBaseUrl() === "https://brandshield-ai-1.onrender.com", "2.3 Never resolves to localhost in production");

  // Restore test env
  (process.env as any).NODE_ENV = "test";
  process.env.NEXT_PUBLIC_APP_URL = "https://qa.brandshield.ai";

  console.log("\n--- Test 3: Template 1 — Workspace Invitation ---");
  await EmailService.sendInvitationEmail({
    recipientEmail: "dr.vance@example.com",
    organizationName: "DermaGlow Laboratories <script>alert(1)</script>",
    inviterName: "Lead Administrator & Officer",
    inviterEmail: "admin@dermaglow.com",
    assignedRole: "compliance_reviewer",
    inviteToken: "sec_tok_enterprise_998877",
    expiresAt: new Date("2026-11-25T12:00:00Z"),
  });

  const captured = EmailService.getCapturedEmails();
  const inviteEmail = captured[0];

  assert(Boolean(inviteEmail), "3.1 Invitation email captured");
  assert(!inviteEmail.html.includes("<script>"), "3.2 Dynamic user inputs are safely escaped in HTML");
  assert(!inviteEmail.html.includes("#060913"), "3.3 Dark background #060913 is completely eliminated");
  assert(!inviteEmail.html.includes("linear-gradient(135deg, #7c3aed"), "3.4 Violet gradients are completely eliminated");
  assert(!inviteEmail.html.includes("rgba(139, 92, 246"), "3.5 Purple glowing accents are completely eliminated");
  assert(inviteEmail.html.includes("background-color: #f8fafc;"), "3.6 Light neutral background #f8fafc is present");
  assert(inviteEmail.html.includes("max-width: 580px;"), "3.7 Centered 580px container is present");
  assert(inviteEmail.html.includes("background-color: #2563eb;"), "3.8 Restrained corporate blue CTA button (#2563eb) is present");
  assert(inviteEmail.html.includes("Accept Invitation"), "3.9 CTA button label is clear and accessible");
  assert(inviteEmail.html.includes("If the button above does not work, copy and paste this link into your browser"), "3.10 Plain-text fallback link instruction is in HTML");
  assert(inviteEmail.html.includes("https://qa.brandshield.ai/invite?token=sec_tok_enterprise_998877"), "3.11 Full fallback link is present in HTML");
  assert(inviteEmail.html.includes("Compliance Reviewer"), "3.12 Assigned role label is clearly presented");
  assert(inviteEmail.html.includes("Single-use secure link"), "3.13 Explicit single-use notice is displayed");
  assert(Boolean(inviteEmail.text && inviteEmail.text.includes("https://qa.brandshield.ai/invite?token=")), "3.14 Plain text alternative contains full invite link");
  assert(Boolean(inviteEmail.text && inviteEmail.text.includes("Compliance Reviewer")), "3.15 Plain text alternative contains role and details");

  console.log("\n--- Test 4: Template 2 — Join Request Received ---");
  await EmailService.sendJoinRequestReceivedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Taylor",
    organizationName: "DermaGlow Laboratories",
  });

  const capturedAfterReceived = EmailService.getCapturedEmails();
  const receivedEmail = capturedAfterReceived[1];
  assert(Boolean(receivedEmail), "4.1 Join request received email captured");
  assert(receivedEmail.subject.includes("Received: Membership Request for DermaGlow Laboratories"), "4.2 Subject matches enterprise format");
  assert(receivedEmail.html.includes("Membership Request Received"), "4.3 Clear subject-specific heading");
  assert(receivedEmail.html.includes("Under Review"), "4.4 Review status badge displayed");
  assert(receivedEmail.html.includes("An administrator will review your application"), "4.5 Clear next steps explained");
  assert(Boolean(receivedEmail.text && receivedEmail.text.includes("Under administrator review")), "4.6 Plain text alternative includes review notice");

  console.log("\n--- Test 5: Template 3 — Join Request Approved ---");
  await EmailService.sendJoinRequestApprovedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Taylor",
    organizationName: "DermaGlow Laboratories",
    assignedRole: "creator",
    reviewerName: "Lead Administrator",
  });

  const capturedAfterApproved = EmailService.getCapturedEmails();
  const approvedEmail = capturedAfterApproved[2];
  assert(Boolean(approvedEmail), "5.1 Join request approved email captured");
  assert(approvedEmail.html.includes("Marketing Creator"), "5.2 Assigned role clearly displayed in approval");
  assert(approvedEmail.html.includes("Sign In to Workspace"), "5.3 Direct sign-in CTA button present");
  assert(approvedEmail.html.includes("https://qa.brandshield.ai/login"), "5.4 Points to workspace login URL");
  assert(Boolean(approvedEmail.text && approvedEmail.text.includes("https://qa.brandshield.ai/login")), "5.5 Plain text alternative includes login URL");

  console.log("\n--- Test 6: Template 4 — Join Request Rejected ---");
  await EmailService.sendJoinRequestRejectedEmail({
    recipientEmail: "applicant@example.com",
    applicantName: "Jordan Taylor",
    organizationName: "DermaGlow Laboratories",
    reason: "Corporate email address required (e.g. @dermaglow.com).",
  });

  const capturedAfterRejected = EmailService.getCapturedEmails();
  const rejectedEmail = capturedAfterRejected[3];
  assert(Boolean(rejectedEmail), "6.1 Join request rejected email captured");
  assert(rejectedEmail.html.includes("Corporate email address required"), "6.2 Rejection reason clearly conveyed");
  assert(rejectedEmail.html.includes("Declined"), "6.3 Polite status indication");
  assert(rejectedEmail.html.includes("contact your organization administrator directly"), "6.4 Contact and support guidance included");
  assert(Boolean(rejectedEmail.text && rejectedEmail.text.includes("Corporate email address required")), "6.5 Plain text alternative includes decline reason");

  console.log("\n--- Test 7: Diagnostic Tool — Admin Test Email ---");
  await EmailService.sendAdminTestEmail({
    recipientEmail: "brandshield11@gmail.com",
    adminName: "Lead Administrator",
    adminEmail: "admin@dermaglow.com",
    workspaceName: "DermaGlow Laboratories",
  });

  const capturedAfterTest = EmailService.getCapturedEmails();
  const adminTestEmail = capturedAfterTest[4];
  assert(Boolean(adminTestEmail), "7.1 Admin test email captured");
  assert(adminTestEmail.html.includes("Email Delivery Health Check"), "7.2 Diagnostic title displayed");
  assert(adminTestEmail.html.includes("Active Provider"), "7.3 Active provider diagnosed");
  assert(Boolean(adminTestEmail.text && adminTestEmail.text.includes("Provider Diagnostic:")), "7.4 Plain text alternative contains diagnostic details");

  // Restore env
  if (originalAppUrl) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  else delete process.env.NEXT_PUBLIC_APP_URL;
  if (originalRenderUrl) process.env.RENDER_EXTERNAL_URL = originalRenderUrl;
  else delete process.env.RENDER_EXTERNAL_URL;

  console.log("\n========================================================================");
  console.log(` INSPECTION RESULTS: ${passed} passing, ${failed} failed.`);
  console.log("========================================================================\n");

  if (failed > 0) process.exit(1);
}

runInspection().catch((err) => {
  console.error("Fatal error running inspection:", err);
  process.exit(1);
});
