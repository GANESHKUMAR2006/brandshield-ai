import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { EmailService } from "@/lib/email/email-service";
import { ReviewerRole } from "@/types";

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/workspaces/[id]/join-requests/[requestId]/reject
 * Administrator rejects a pending membership request.
 * - Does NOT create membership
 * - Enforces admin permission
 * - Prevents self-rejection
 * - Sets status = 'rejected'
 * - Sends branded rejection email with optional reason
 * - Records audit event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: workspaceId, requestId } = await params;
    const session = await resolveServerSession();

    // 1. Authorize caller as admin
    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [workspaceId, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === workspaceId ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can reject join requests." },
        { status: 403 }
      );
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // optional
    }

    const validated = rejectSchema.safeParse(body);
    const reason = validated.success ? validated.data.reason : undefined;

    // 2. Fetch the join request
    const reqRes = await query<{
      id: string;
      workspace_id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      status: string;
      workspace_name: string;
    }>(
      `SELECT jr.id, jr.workspace_id, jr.user_id, jr.user_email, jr.user_name, jr.status, w.name as workspace_name
       FROM workspace_join_requests jr
       JOIN workspaces w ON jr.workspace_id = w.id
       WHERE jr.id = $1 AND jr.workspace_id = $2
       LIMIT 1`,
      [requestId, workspaceId]
    );

    if (reqRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Join request not found" }, { status: 404 });
    }

    const joinReq = reqRes.rows[0];

    // 3. Status check
    if (joinReq.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `This request has already been ${joinReq.status}.` },
        { status: 400 }
      );
    }

    // 4. Update status to rejected
    await query(
      `UPDATE workspace_join_requests
       SET status = 'rejected',
           rejection_reason = $1,
           reviewed_by = $2,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $3`,
      [reason || null, isValidUUID(session.userId) ? session.userId : null, requestId]
    );

    // 5. Send rejection notification email
    try {
      await EmailService.sendJoinRequestRejectedEmail({
        recipientEmail: joinReq.user_email,
        applicantName: joinReq.user_name,
        organizationName: joinReq.workspace_name,
        reason,
      });
    } catch (emailErr) {
      console.warn("[POST join-requests/reject] Email notification error (non-fatal):", emailErr);
    }

    // 6. Record Audit Trail
    try {
      await AuditService.recordEvent({
        workspaceId,
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.userName,
        actorEmail: session.userEmail,
        entityType: "workspace",
        entityId: joinReq.id,
        action: "join_request_rejected",
        afterState: {
          requestId: joinReq.id,
          userId: joinReq.user_id,
          userEmail: joinReq.user_email,
          reason,
          rejectedBy: session.userId,
        },
      });
    } catch (auditErr) {
      console.error("[POST join-requests/reject] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Join request for ${joinReq.user_email} has been rejected.`,
      request: {
        id: joinReq.id,
        status: "rejected",
        userId: joinReq.user_id,
        userEmail: joinReq.user_email,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST join-requests/reject Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to reject join request", correlationId },
      { status: 500 }
    );
  }
}

