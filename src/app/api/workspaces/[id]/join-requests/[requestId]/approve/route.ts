import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { EmailService } from "@/lib/email/email-service";
import { ReviewerRole } from "@/types";

const approveSchema = z.object({
  role: z.enum(["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"]),
});

/**
 * POST /api/workspaces/[id]/join-requests/[requestId]/approve
 * Administrator approves a pending membership request.
 * - Enforces role-based permission
 * - Prevents self-approval (applicant cannot approve their own join request)
 * - Explicitly requires an assigned role
 * - Transactionally sets status = 'approved', creates/updates active membership
 * - Sends branded approval email to the applicant
 * - Records 21 CFR Part 11 audit event
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
        { success: false, error: "Forbidden: Only workspace administrators can approve join requests." },
        { status: 403 }
      );
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // empty body
    }

    const validated = approveSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid role ('admin', 'compliance_reviewer', 'legal_reviewer', 'creator', 'viewer') is required for approval.",
          details: validated.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { role: assignedRole } = validated.data;

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

    // 3. Self-approval prevention
    if (isValidUUID(session.userId) && session.userId === joinReq.user_id) {
      return NextResponse.json(
        { success: false, error: "Security restriction: You cannot approve your own membership join request." },
        { status: 403 }
      );
    }

    // 4. Status check
    if (joinReq.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `This request has already been ${joinReq.status}.` },
        { status: 400 }
      );
    }

    // 5. Transactionally approve request and create membership
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE workspace_join_requests
         SET status = 'approved',
             assigned_role = $1,
             reviewed_by = $2,
             reviewed_at = now(),
             updated_at = now()
         WHERE id = $3`,
        [assignedRole, isValidUUID(session.userId) ? session.userId : null, requestId]
      );

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (workspace_id, user_id)
         DO UPDATE SET 
           role = CASE WHEN workspace_memberships.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END,
           status = 'active', 
           updated_at = now()`,
        [workspaceId, joinReq.user_id, assignedRole]
      );
    });

    // 6. Send approval notification email
    try {
      await EmailService.sendJoinRequestApprovedEmail({
        recipientEmail: joinReq.user_email,
        applicantName: joinReq.user_name,
        organizationName: joinReq.workspace_name,
        assignedRole,
        reviewerName: session.userName || "Workspace Administrator",
      });
    } catch (emailErr) {
      console.warn("[POST join-requests/approve] Email notification error (non-fatal):", emailErr);
    }

    // 7. Record 21 CFR Part 11 Audit Trail
    try {
      await AuditService.recordEvent({
        workspaceId,
        actorId: session.userId,
        actorRole: session.role,
        actorName: session.userName,
        actorEmail: session.userEmail,
        entityType: "workspace",
        entityId: joinReq.id,
        action: "join_request_approved",
        afterState: {
          requestId: joinReq.id,
          userId: joinReq.user_id,
          userEmail: joinReq.user_email,
          assignedRole,
          approvedBy: session.userId,
        },
      });
    } catch (auditErr) {
      console.error("[POST join-requests/approve] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Join request for ${joinReq.user_email} has been approved with role "${assignedRole}".`,
      request: {
        id: joinReq.id,
        status: "approved",
        assignedRole,
        userId: joinReq.user_id,
        userEmail: joinReq.user_email,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST join-requests/approve Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to approve join request", correlationId },
      { status: 500 }
    );
  }
}

