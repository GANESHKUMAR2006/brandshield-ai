import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { ReviewerRole } from "@/types";

/**
 * GET /api/workspaces/[id]/join-requests
 * Lists join requests for an organization.
 * Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can view join requests" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let sql = `
      SELECT id, workspace_id, user_id, user_email, user_name, status,
             reviewed_by, reviewed_at, assigned_role, rejection_reason, created_at, updated_at
      FROM workspace_join_requests
      WHERE workspace_id = $1
    `;
    const queryParams: unknown[] = [id];

    if (statusFilter && ["pending", "approved", "rejected", "canceled"].includes(statusFilter)) {
      sql += ` AND status = $2`;
      queryParams.push(statusFilter);
    }

    sql += ` ORDER BY created_at DESC`;

    const res = await query<{
      id: string;
      workspace_id: string;
      user_id: string;
      user_email: string;
      user_name: string;
      status: string;
      reviewed_by: string | null;
      reviewed_at: string | null;
      assigned_role: string | null;
      rejection_reason: string | null;
      created_at: string;
      updated_at: string;
    }>(sql, queryParams);

    return NextResponse.json({
      success: true,
      requests: res.rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        userId: r.user_id,
        userEmail: r.user_email,
        userName: r.user_name,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewedAt: r.reviewed_at,
        assignedRole: r.assigned_role,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/join-requests Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load join requests", correlationId },
      { status: 500 }
    );
  }
}

