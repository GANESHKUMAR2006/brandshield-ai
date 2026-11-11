import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveAuthenticatedUser, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { EmailService } from "@/lib/email/email-service";
import { DistributedRateLimiter } from "@/lib/rate-limit/distributed-rate-limiter";

const joinRequestSchema = z.object({
  joinCode: z.string().min(4, "Organization join code is required").max(32),
});

const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * POST /api/workspaces/join-requests
 * Submits a join request using an organization join code.
 * User must be authenticated with Supabase Auth.
 * Enforces distributed rate limiting on failed join-code attempts across both IP and User keys.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required. Please sign in before requesting to join an organization." },
        { status: 401 }
      );
    }

    if (!isValidUUID(user.id)) {
      return NextResponse.json(
        { success: false, error: "A valid authenticated user account is required." },
        { status: 401 }
      );
    }

    // Rate limit keys: Per-IP and Per-User
    const clientIp = getClientIp(request);
    const ipKey = `join_code:ip:${clientIp}`;
    const userKey = `join_code:user:${user.id}`;

    // Pre-check rate limits (read-only peek)
    const ipCheck = await DistributedRateLimiter.checkLimit(ipKey, MAX_FAILED_ATTEMPTS);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed join code attempts from this IP address. Please wait ${Math.ceil(ipCheck.retryAfterSeconds / 60)} minutes before trying again.`,
          retryAfter: ipCheck.retryAfterSeconds,
          rateLimited: true,
        },
        {
          status: 429,
          headers: { "Retry-After": String(ipCheck.retryAfterSeconds) },
        }
      );
    }

    const userCheck = await DistributedRateLimiter.checkLimit(userKey, MAX_FAILED_ATTEMPTS);
    if (!userCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed join code attempts on your account. Please wait ${Math.ceil(userCheck.retryAfterSeconds / 60)} minutes before trying again.`,
          retryAfter: userCheck.retryAfterSeconds,
          rateLimited: true,
        },
        {
          status: 429,
          headers: { "Retry-After": String(userCheck.retryAfterSeconds) },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = joinRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Invalid join code format", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { joinCode } = validated.data;
    const cleanCode = joinCode.trim().toUpperCase();
    const joinCodeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

    // 1. Find matching workspace with this join code enabled
    const wsRes = await query<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug 
       FROM workspaces 
       WHERE join_code_hash = $1 AND join_code_enabled = true
       LIMIT 1`,
      [joinCodeHash]
    );

    // If join code is invalid or deactivated, atomically increment failed attempts for both IP and User
    if (wsRes.rows.length === 0) {
      const ipRecord = await DistributedRateLimiter.recordAttempt(ipKey, RATE_LIMIT_WINDOW_SECONDS, MAX_FAILED_ATTEMPTS);
      const userRecord = await DistributedRateLimiter.recordAttempt(userKey, RATE_LIMIT_WINDOW_SECONDS, MAX_FAILED_ATTEMPTS);
      const worstRetryAfter = Math.max(ipRecord.retryAfterSeconds, userRecord.retryAfterSeconds);

      if (!ipRecord.allowed || !userRecord.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Too many failed join code attempts. Rate limit exceeded. Please wait ${Math.ceil(worstRetryAfter / 60)} minutes before trying again.`,
            retryAfter: worstRetryAfter,
            rateLimited: true,
          },
          {
            status: 429,
            headers: { "Retry-After": String(worstRetryAfter) },
          }
        );
      }

      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - Math.max(ipRecord.count, userRecord.count));
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or inactive organization join code. Please verify the code with your workspace administrator.",
          remainingAttempts,
        },
        { status: 404 }
      );
    }

    const targetWorkspace = wsRes.rows[0];

    // 2. Check if user is already an active member
    const existingMember = await query(
      `SELECT id, role FROM workspace_memberships 
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
       LIMIT 1`,
      [targetWorkspace.id, user.id]
    );

    if (existingMember.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `You are already an active member of ${targetWorkspace.name}.`,
          workspace: targetWorkspace,
        },
        { status: 409 }
      );
    }

    // 3. Check for existing pending request
    const existingPending = await query<{ id: string; created_at: string }>(
      `SELECT id, created_at FROM workspace_join_requests 
       WHERE workspace_id = $1 AND user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [targetWorkspace.id, user.id]
    );

    if (existingPending.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `You already have a pending join request for ${targetWorkspace.name} submitted on ${new Date(existingPending.rows[0].created_at).toLocaleDateString()}. Please await administrator approval.`,
          pendingRequestId: existingPending.rows[0].id,
        },
        { status: 409 }
      );
    }

    const userEmail = user.email || "";
    const userName = user.name || userEmail || "Team Member";

    // 4. Create pending join request
    const insertRes = await query<{
      id: string;
      workspace_id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      status: string;
      created_at: string;
    }>(
      `INSERT INTO workspace_join_requests (workspace_id, user_id, user_email, user_name, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, workspace_id, user_id, user_email, user_name, status, created_at`,
      [targetWorkspace.id, user.id, userEmail, userName]
    );

    const joinRequest = insertRes.rows[0];

    // 5. Send notification email to applicant
    try {
      await EmailService.sendJoinRequestReceivedEmail({
        recipientEmail: userEmail,
        applicantName: userName,
        organizationName: targetWorkspace.name,
      });
    } catch (emailErr) {
      console.warn("[POST /api/workspaces/join-requests] Email notification error (non-fatal):", emailErr);
    }

    // 6. Record audit log
    try {
      await AuditService.recordEvent({
        workspaceId: targetWorkspace.id,
        actorId: user.id,
        actorRole: "viewer",
        actorName: user.name,
        actorEmail: user.email,
        entityType: "workspace",
        entityId: joinRequest.id,
        action: "join_request_submitted",
        afterState: {
          requestId: joinRequest.id,
          userEmail: user.email,
          workspaceName: targetWorkspace.name,
        },
      });
    } catch (auditErr) {
      console.error("[POST /api/workspaces/join-requests] Audit warning:", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Your request to join ${targetWorkspace.name} has been submitted. A workspace administrator must review and approve your application.`,
        request: {
          id: joinRequest.id,
          organizationName: targetWorkspace.name,
          organizationSlug: targetWorkspace.slug,
          status: joinRequest.status,
          createdAt: joinRequest.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/join-requests Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to submit join request", correlationId },
      { status: 500 }
    );
  }
}
