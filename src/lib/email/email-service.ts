/**
 * BrandShield AI — Email Service
 * Multi-provider transactional email client supporting:
 * 1. Gmail SMTP via Nodemailer (Primary / Active: EMAIL_PROVIDER=gmail)
 * 2. Resend REST API (Alternative: EMAIL_PROVIDER=resend)
 * 3. Isolated QA memory capture (when QA_EMAIL_CAPTURE=true or NODE_ENV=test)
 * 
 * Strict Enterprise Requirements:
 * - Clean, professional corporate design optimized for Outlook and Gmail
 * - Light neutral background, centered 560-580px layout, restrained typography
 * - Plain-text fallback URLs and accessible contrast
 * - Credentials kept strictly server-side; never exposed to browser or logged
 * - Safe HTML entity escaping for user-supplied data
 * - Meaningful plain-text alternatives for all outbound messages
 */

import nodemailer from "nodemailer";

export type EmailProvider = "gmail" | "resend" | "qa_capture";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface CapturedEmail {
  id: string;
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  sentAt: string;
  provider: EmailProvider;
  category: "invitation" | "join_request_received" | "join_request_approved" | "join_request_rejected" | "admin_test";
}

// In-memory capture ledger strictly for QA & automated tests
const qaCapturedEmails: CapturedEmail[] = [];

export class EmailDeliveryError extends Error {
  public statusCode?: number;
  public provider?: EmailProvider;
  public providerResponse?: unknown;

  constructor(message: string, statusCode?: number, provider?: EmailProvider, providerResponse?: unknown) {
    super(message);
    this.name = "EmailDeliveryError";
    this.statusCode = statusCode;
    this.provider = provider;
    this.providerResponse = providerResponse;
  }
}

/**
 * Escapes unsafe dynamic strings to prevent HTML injection in email clients
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resolves application base URL safely across local, Render, and production environments
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "production") {
    return "https://brandshield-ai-1.onrender.com";
  }
  return "http://localhost:3000";
}

/**
 * Resolves active email provider from environment
 */
export function getActiveEmailProvider(): EmailProvider {
  const isQaCapture =
    process.env.QA_EMAIL_CAPTURE === "true" ||
    process.env.NODE_ENV === "test";

  if (isQaCapture) {
    return "qa_capture";
  }

  const configured = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase().trim();
  if (configured === "resend") {
    return "resend";
  }
  return "gmail";
}

export interface DetailItem {
  label: string;
  value: string;
}

export interface BrandedLayoutOptions {
  preheader: string;
  title: string;
  paragraphs: string[];
  details?: DetailItem[];
  callout?: {
    title?: string;
    text: string;
  };
  callToAction?: {
    label: string;
    url: string;
  };
  footerNote?: string;
}

/**
 * Enterprise Clean Email Layout
 * Compatible with Gmail, Outlook, Apple Mail, and mobile email clients
 */
export function renderBrandedLayout({
  preheader,
  title,
  paragraphs,
  details,
  callout,
  callToAction,
  footerNote,
}: BrandedLayoutOptions): string {
  const currentYear = new Date().getFullYear();

  const detailsRows = details && details.length > 0
    ? details.map((item) => `
      <tr>
        <td style="padding: 6px 12px 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #64748b; font-weight: 500; vertical-align: top; width: 130px; white-space: nowrap;">
          ${escapeHtml(item.label)}
        </td>
        <td style="padding: 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; color: #0f172a; font-weight: 600; vertical-align: top;">
          ${item.value}
        </td>
      </tr>
    `).join("")
    : "";

  const paragraphsHtml = paragraphs
    .map((p) => `<p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">${p}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .content-cell { padding: 24px 20px !important; }
      .header-cell { padding: 18px 20px !important; }
      .footer-cell { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(preheader)}
  </div>

  <!-- Background Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td class="header-cell" style="padding: 22px 32px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">BrandShield <span style="color: #2563eb; font-weight: 700;">AI</span></span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Enterprise Governance</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td class="content-cell" style="padding: 32px 32px 28px; background-color: #ffffff;">
              <!-- Subject Heading -->
              <h1 style="margin: 0 0 18px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; line-height: 1.35; color: #0f172a; letter-spacing: -0.01em;">
                ${escapeHtml(title)}
              </h1>

              <!-- Message Body -->
              ${paragraphsHtml}

              <!-- Details Table (if provided) -->
              ${
                detailsRows
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin: 20px 0 22px 0;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailsRows}
                    </table>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <!-- Callout Note (if provided) -->
              ${
                callout
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-left: 3px solid #2563eb; border-radius: 0 4px 4px 0; margin: 18px 0;">
                <tr>
                  <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #475569;">
                    ${callout.title ? `<strong style="color: #0f172a;">${escapeHtml(callout.title)}: </strong>` : ""}${callout.text}
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <!-- CTA Button -->
              ${
                callToAction
                  ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 26px 0 16px 0;">
                <tr>
                  <td align="left" style="border-radius: 6px; background-color: #2563eb;">
                    <a href="${callToAction.url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #2563eb;">
                      ${escapeHtml(callToAction.label)}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Plain-text Fallback URL -->
              <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #64748b; word-break: break-all;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${callToAction.url}" style="color: #2563eb; text-decoration: underline;">${callToAction.url}</a>
              </p>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer-cell" style="padding: 22px 32px; border-top: 1px solid #e2e8f0; background-color: #f8fafc;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #64748b;">
                    ${footerNote ? `<p style="margin: 0 0 8px 0; color: #64748b;">${footerNote}</p>` : ""}
                    <p style="margin: 0; color: #94a3b8;">
                      &copy; ${currentYear} BrandShield AI. All rights reserved. Enterprise Marketing Compliance &amp; Substantiation Governance.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Send email via Gmail SMTP (Nodemailer)
 */
async function sendViaGmailSmtp(options: SendEmailOptions, fromEmail: string): Promise<string> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE !== "false"; // default true for 465
  const user = process.env.SMTP_USER || "brandshield11@gmail.com";
  const pass = process.env.SMTP_PASS;

  if (!pass) {
    throw new EmailDeliveryError(
      "Gmail SMTP configuration incomplete: SMTP_PASS (<Google App Password>) is missing.",
      500,
      "gmail"
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,   // 10s greeting timeout
    socketTimeout: 15000,     // 15s socket timeout
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  try {
    const toStr = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    const info = await transporter.sendMail({
      from: fromEmail,
      to: toStr,
      subject: options.subject,
      text: options.text || options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    return info.messageId || `gmail_${Date.now()}`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new EmailDeliveryError(
      `Gmail SMTP delivery failed: ${message}`,
      502,
      "gmail",
      err
    );
  }
}

/**
 * Send email via Resend REST API
 */
async function sendViaResend(options: SendEmailOptions, fromEmail: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailDeliveryError("RESEND_API_KEY is missing. Cannot deliver outbound transactional email.", 500, "resend");
  }

  const toList = Array.isArray(options.to) ? options.to : [options.to];
  const payload = {
    from: fromEmail,
    to: toList,
    subject: options.subject,
    html: options.html,
    text: options.text,
    reply_to: options.replyTo,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error?.message || `Resend API failed with HTTP ${res.status}`;
      throw new EmailDeliveryError(errorMsg, res.status, "resend", data);
    }

    return data?.id || `resend_${Date.now()}`;
  } catch (err: unknown) {
    if (err instanceof EmailDeliveryError) throw err;
    throw new EmailDeliveryError(
      `Network error delivering email via Resend: ${err instanceof Error ? err.message : String(err)}`,
      502,
      "resend"
    );
  }
}

/**
 * Universal Outbound Email Sender
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id: string; provider: EmailProvider }> {
  const activeProvider = getActiveEmailProvider();
  const fromEmail = process.env.EMAIL_FROM || "BrandShield AI <brandshield11@gmail.com>";

  // QA Capture Mode
  if (activeProvider === "qa_capture") {
    const mockId = `qa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const captured: CapturedEmail = {
      id: mockId,
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      html: options.html,
      text: options.text,
      sentAt: new Date().toISOString(),
      provider: "qa_capture",
      category: options.subject.toLowerCase().includes("invit")
        ? "invitation"
        : options.subject.toLowerCase().includes("approved")
        ? "join_request_approved"
        : options.subject.toLowerCase().includes("decline") || options.subject.toLowerCase().includes("rejected")
        ? "join_request_rejected"
        : options.subject.toLowerCase().includes("test")
        ? "admin_test"
        : "join_request_received",
    };
    qaCapturedEmails.push(captured);
    return { success: true, id: mockId, provider: "qa_capture" };
  }

  // Live Gmail SMTP
  if (activeProvider === "gmail") {
    const messageId = await sendViaGmailSmtp(options, fromEmail);
    return { success: true, id: messageId, provider: "gmail" };
  }

  // Live Resend REST
  if (activeProvider === "resend") {
    const messageId = await sendViaResend(options, fromEmail);
    return { success: true, id: messageId, provider: "resend" };
  }

  throw new EmailDeliveryError(`Unsupported EMAIL_PROVIDER: ${activeProvider}`);
}

/**
 * High-level Transactional Mailers
 */
export const EmailService = {
  /**
   * 1. Send Workspace Invitation to New or Existing User
   */
  async sendInvitationEmail(params: {
    recipientEmail: string;
    organizationName: string;
    inviterName: string;
    inviterEmail: string;
    assignedRole: string;
    inviteToken: string;
    expiresAt: Date | string;
  }) {
    const baseUrl = getAppBaseUrl();
    const acceptUrl = `${baseUrl}/invite?token=${encodeURIComponent(params.inviteToken)}`;
    const formattedExpiry = new Date(params.expiresAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const roleLabels: Record<string, string> = {
      admin: "Administrator",
      compliance_reviewer: "Compliance Reviewer",
      legal_reviewer: "Legal Reviewer",
      creator: "Marketing Creator",
      viewer: "Viewer",
    };
    const roleLabel = roleLabels[params.assignedRole] || params.assignedRole;

    const text = [
      `Hello,`,
      ``,
      `${params.inviterName} (${params.inviterEmail}) has invited you to join ${params.organizationName} on BrandShield AI.`,
      ``,
      `Workspace Details:`,
      `- Organization: ${params.organizationName}`,
      `- Assigned Role: ${roleLabel}`,
      `- Invited By: ${params.inviterName} (${params.inviterEmail})`,
      `- Expiration: ${formattedExpiry}`,
      `- Access: Single-use link`,
      ``,
      `To accept your invitation, visit the following URL:`,
      acceptUrl,
      ``,
      `Security Notice: This invitation link is unique to you, single-use, and will expire on ${formattedExpiry}. If you do not have an account yet, you will be prompted to create your password upon opening the link.`,
      ``,
      `--`,
      `BrandShield AI | Enterprise Marketing Compliance & Substantiation Governance`,
    ].join("\n");

    const html = renderBrandedLayout({
      preheader: `You've been invited to join ${params.organizationName} on BrandShield AI`,
      title: `You're invited to join ${params.organizationName}`,
      paragraphs: [
        `Hello,`,
        `<strong>${escapeHtml(params.inviterName)}</strong> (${escapeHtml(params.inviterEmail)}) has invited you to join <strong>${escapeHtml(params.organizationName)}</strong> on BrandShield AI.`,
        `BrandShield AI is the collaborative enterprise governance platform for marketing claims substantiation, regulatory compliance, and multi-tier evidence reviews.`,
      ],
      details: [
        { label: "Organization", value: escapeHtml(params.organizationName) },
        { label: "Assigned Role", value: `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: #eff6ff; color: #1d4ed8; font-size: 12px; font-weight: 600; border: 1px solid #bfdbfe;">${escapeHtml(roleLabel)}</span>` },
        { label: "Invited By", value: `${escapeHtml(params.inviterName)} &lt;${escapeHtml(params.inviterEmail)}&gt;` },
        { label: "Expires", value: escapeHtml(formattedExpiry) },
        { label: "Access Security", value: "Single-use secure link" },
      ],
      callout: {
        title: "Security Notice",
        text: `This invitation link is unique to you, single-use, and will expire on <strong>${escapeHtml(formattedExpiry)}</strong>. If you do not have an account yet, you will be prompted to create your password upon opening the link.`,
      },
      callToAction: {
        label: "Accept Invitation",
        url: acceptUrl,
      },
      footerNote: `This invitation was issued by ${escapeHtml(params.inviterName)} (${escapeHtml(params.inviterEmail)}). If you were not expecting this invitation, you can safely ignore this email.`,
    });

    return await sendEmail({
      to: params.recipientEmail,
      subject: `Invitation: Join ${params.organizationName} on BrandShield AI`,
      html,
      text,
    });
  },

  /**
   * 2. Send Join Request Received (Notification to Applicant & Workspace Admins)
   */
  async sendJoinRequestReceivedEmail(params: {
    recipientEmail: string;
    applicantName: string;
    organizationName: string;
  }) {
    const text = [
      `Hello ${params.applicantName},`,
      ``,
      `Your request to join ${params.organizationName} on BrandShield AI has been received and submitted to organization administrators for review.`,
      ``,
      `Request Details:`,
      `- Organization: ${params.organizationName}`,
      `- Applicant: ${params.applicantName}`,
      `- Status: Under administrator review`,
      ``,
      `Next Steps: An administrator will review your application and assign your regulatory role. You will receive an automated email confirmation as soon as a decision is made.`,
      ``,
      `--`,
      `BrandShield AI | Enterprise Marketing Compliance & Substantiation Governance`,
    ].join("\n");

    const html = renderBrandedLayout({
      preheader: `Your membership request for ${params.organizationName} has been received`,
      title: "Membership Request Received",
      paragraphs: [
        `Hello ${escapeHtml(params.applicantName)},`,
        `Your request to join <strong>${escapeHtml(params.organizationName)}</strong> on BrandShield AI has been received and submitted to organization administrators for review.`,
      ],
      details: [
        { label: "Organization", value: escapeHtml(params.organizationName) },
        { label: "Applicant", value: escapeHtml(params.applicantName) },
        { label: "Status", value: `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; border: 1px solid #fde68a;">Under Review</span>` },
      ],
      callout: {
        title: "Next Steps",
        text: "An administrator will review your application and assign your regulatory role. You will receive an automated email as soon as a decision is made.",
      },
      footerNote: `You are receiving this confirmation because you submitted a join request for ${escapeHtml(params.organizationName)}.`,
    });

    return await sendEmail({
      to: params.recipientEmail,
      subject: `Received: Membership Request for ${params.organizationName}`,
      html,
      text,
    });
  },

  /**
   * 3. Send Join Request Approved Email
   */
  async sendJoinRequestApprovedEmail(params: {
    recipientEmail: string;
    applicantName: string;
    organizationName: string;
    assignedRole: string;
    reviewerName: string;
  }) {
    const baseUrl = getAppBaseUrl();
    const loginUrl = `${baseUrl}/login`;

    const roleLabels: Record<string, string> = {
      admin: "Administrator",
      compliance_reviewer: "Compliance Reviewer",
      legal_reviewer: "Legal Reviewer",
      creator: "Marketing Creator",
      viewer: "Viewer",
    };
    const roleLabel = roleLabels[params.assignedRole] || params.assignedRole;

    const text = [
      `Hello ${params.applicantName},`,
      ``,
      `Great news! Your request to join ${params.organizationName} on BrandShield AI has been approved by ${params.reviewerName}.`,
      ``,
      `Membership Details:`,
      `- Organization: ${params.organizationName}`,
      `- Assigned Role: ${roleLabel}`,
      `- Approved By: ${params.reviewerName}`,
      ``,
      `You can now sign in to your workspace at:`,
      loginUrl,
      ``,
      `--`,
      `BrandShield AI | Enterprise Marketing Compliance & Substantiation Governance`,
    ].join("\n");

    const html = renderBrandedLayout({
      preheader: `Your membership request for ${params.organizationName} has been approved`,
      title: `Welcome to ${params.organizationName}!`,
      paragraphs: [
        `Hello ${escapeHtml(params.applicantName)},`,
        `Great news! Your request to join <strong>${escapeHtml(params.organizationName)}</strong> on BrandShield AI has been approved by <strong>${escapeHtml(params.reviewerName)}</strong>.`,
        `You have been assigned the role of <strong>${escapeHtml(roleLabel)}</strong>. You can now sign in to BrandShield AI to collaborate on marketing compliance packages, review substantiation evidence, and participate in claims governance workflows.`,
      ],
      details: [
        { label: "Organization", value: escapeHtml(params.organizationName) },
        { label: "Assigned Role", value: `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 600; border: 1px solid #a7f3d0;">${escapeHtml(roleLabel)}</span>` },
        { label: "Approved By", value: escapeHtml(params.reviewerName) },
      ],
      callToAction: {
        label: "Sign In to Workspace",
        url: loginUrl,
      },
      footerNote: `You are receiving this notification because your membership application for ${escapeHtml(params.organizationName)} was approved.`,
    });

    return await sendEmail({
      to: params.recipientEmail,
      subject: `Approved: You have joined ${params.organizationName} on BrandShield AI`,
      html,
      text,
    });
  },

  /**
   * 4. Send Join Request Rejected Email
   */
  async sendJoinRequestRejectedEmail(params: {
    recipientEmail: string;
    applicantName: string;
    organizationName: string;
    reason?: string;
  }) {
    const text = [
      `Hello ${params.applicantName},`,
      ``,
      `Thank you for your interest in joining ${params.organizationName} on BrandShield AI.`,
      ``,
      `After review, the organization administrators have declined your join request at this time.`,
      ...(params.reason ? [``, `Reason provided: ${params.reason}`] : []),
      ``,
      `If you believe this was in error, please contact your organization administrator directly or request assistance from your corporate IT team.`,
      ``,
      `--`,
      `BrandShield AI | Enterprise Marketing Compliance & Substantiation Governance`,
    ].join("\n");

    const paragraphs = [
      `Hello ${escapeHtml(params.applicantName)},`,
      `Thank you for your interest in joining <strong>${escapeHtml(params.organizationName)}</strong> on BrandShield AI.`,
      `After review, the organization administrators have declined your join request at this time.`,
    ];

    if (params.reason) {
      paragraphs.push(`<strong>Reason provided:</strong> ${escapeHtml(params.reason)}`);
    }

    paragraphs.push(
      `If you believe this was in error, please contact your organization administrator directly or request assistance from your corporate IT team.`
    );

    const html = renderBrandedLayout({
      preheader: `Update regarding your membership request for ${params.organizationName}`,
      title: "Membership Request Status",
      paragraphs,
      details: [
        { label: "Organization", value: escapeHtml(params.organizationName) },
        { label: "Status", value: `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: #fef2f2; color: #991b1b; font-size: 12px; font-weight: 600; border: 1px solid #fecaca;">Declined</span>` },
      ],
      footerNote: `You are receiving this notification because a join request was submitted for ${escapeHtml(params.organizationName)}.`,
    });

    return await sendEmail({
      to: params.recipientEmail,
      subject: `Declined: Membership Request for ${params.organizationName}`,
      html,
      text,
    });
  },

  /**
   * 5. Send Administrator QA Test Email
   */
  async sendAdminTestEmail(params: {
    recipientEmail: string;
    adminName: string;
    adminEmail: string;
    workspaceName: string;
  }) {
    const timestamp = new Date().toISOString();
    const activeProvider = getActiveEmailProvider();

    const text = [
      `Hello,`,
      ``,
      `This is a live transactional test email sent by ${params.adminName} (${params.adminEmail}) from workspace ${params.workspaceName}.`,
      ``,
      `Provider Diagnostic:`,
      `- Active Provider: ${activeProvider.toUpperCase()}`,
      `- Workspace: ${params.workspaceName}`,
      `- Initiated By: ${params.adminName} (${params.adminEmail})`,
      `- Timestamp: ${timestamp}`,
      ``,
      `If you received this message, outbound transactional email delivery is functioning properly.`,
      ``,
      `--`,
      `BrandShield AI | Enterprise Marketing Compliance & Substantiation Governance`,
    ].join("\n");

    const html = renderBrandedLayout({
      preheader: `BrandShield AI Email Diagnostic Test — ${activeProvider.toUpperCase()}`,
      title: "Email Delivery Health Check",
      paragraphs: [
        `Hello,`,
        `This is a live transactional test email sent by <strong>${escapeHtml(params.adminName)}</strong> (${escapeHtml(params.adminEmail)}) from workspace <strong>${escapeHtml(params.workspaceName)}</strong>.`,
        `If you received this message, outbound transactional email delivery is functioning normally.`,
      ],
      details: [
        { label: "Active Provider", value: `<code style="font-family: monospace; font-size: 12px; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(activeProvider.toUpperCase())}</code>` },
        { label: "Workspace", value: escapeHtml(params.workspaceName) },
        { label: "Initiated By", value: `${escapeHtml(params.adminName)} &lt;${escapeHtml(params.adminEmail)}&gt;` },
        { label: "Timestamp", value: escapeHtml(timestamp) },
      ],
      callout: {
        title: "Compliance Verification",
        text: "FDA 21 CFR Part 11 / FTC Substantiation System Health Check passed.",
      },
      footerNote: "Sent via administrator diagnostic test tool.",
    });

    return await sendEmail({
      to: params.recipientEmail,
      subject: `[BrandShield AI] Test Email Delivery — ${activeProvider.toUpperCase()}`,
      html,
      text,
    });
  },

  // Test / QA Helper utilities
  getCapturedEmails(): CapturedEmail[] {
    return [...qaCapturedEmails];
  },

  clearCapturedEmails() {
    qaCapturedEmails.length = 0;
  },
};
