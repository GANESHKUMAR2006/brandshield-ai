import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { EmailService, getActiveEmailProvider } from "@/lib/email/email-service";
import { ReviewerRole } from "@/types";

const testEmailSchema = z.object({
  recipientEmail: z.string().email("Valid corporate or QA recipient email is required"),
});

// In-memory sliding window rate limiter: Max 3 diagnostic test emails per 10 minutes per workspace/admin
const testEmailRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkTestEmailRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000; // 10 minutes
  const maxAttempts = 3;

  const record = testEmailRateLimits.get(key);
  if (!record || now > record.resetAt) {
    testEmailRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * POST /api/workspaces/[id]/email/test
 * Administrator-only diagnostic tool to verify active email provider delivery.
 * Sends a live test email strictly to an explicitly provided QA recipient address.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const session = await resolveServerSession();

    // 1. Authorize administrator access
    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [workspaceId, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === workspaceId ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can trigger email diagnostic tests." },
        { status: 403 }
      );
    }

    // 2. Enforce diagnostic test rate limit (max 3 tests per 10 minutes per workspace)
    const rateCheckKey = `${workspaceId}:${session.userId}`;
    const rateCheck = checkTestEmailRateLimit(rateCheckKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded: Diagnostic test emails are limited to 3 per 10 minutes. Please retry in ${rateCheck.retryAfterSeconds} seconds.`,
          retryAfter: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = testEmailSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { recipientEmail } = validated.data;
    const activeProvider = getActiveEmailProvider();

    // 2. Fetch workspace name
    let workspaceName = "Your Workspace";
    try {
      const wsRes = await query<{ name: string }>(`SELECT name FROM workspaces WHERE id = $1 LIMIT 1`, [workspaceId]);
      if (wsRes.rows[0]?.name) {
        workspaceName = wsRes.rows[0].name;
      }
    } catch {
      // fallback
    }

    // 3. Dispatch test email
    const result = await EmailService.sendAdminTestEmail({
      recipientEmail: recipientEmail.trim().toLowerCase(),
      adminName: session.userName || "Workspace Administrator",
      adminEmail: session.userEmail || "admin@brandshield.ai",
      workspaceName,
    });

    return NextResponse.json({
      success: true,
      message: `Diagnostic test email dispatched via ${activeProvider.toUpperCase()} to ${recipientEmail}`,
      provider: result.provider,
      messageId: result.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/[id]/email/test Error] [${correlationId}]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to deliver diagnostic test email: ${err instanceof Error ? err.message : String(err)}`,
        correlationId,
      },
      { status: 502 }
    );
  }
}

