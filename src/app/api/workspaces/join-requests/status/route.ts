import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveAuthenticatedUser, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/workspaces/join-requests/status
 * Fetches all join requests submitted by the currently authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    if (!isValidUUID(user.id)) {
      return NextResponse.json(
        { success: false, requests: [] },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const res = await query<{
      id: string;
      workspace_id: string;
      workspace_name: string;
      workspace_slug: string;
      status: string;
      assigned_role: string | null;
      rejection_reason: string | null;
      created_at: string;
      reviewed_at: string | null;
    }>(
      `SELECT jr.id, jr.workspace_id, w.name as workspace_name, w.slug as workspace_slug,
              jr.status, jr.assigned_role, jr.rejection_reason, jr.created_at, jr.reviewed_at
       FROM workspace_join_requests jr
       JOIN workspaces w ON jr.workspace_id = w.id
       WHERE jr.user_id = $1
       ORDER BY jr.created_at DESC`,
      [user.id]
    );

    return NextResponse.json(
      {
        success: true,
        requests: res.rows.map((r) => ({
          id: r.id,
          workspaceId: r.workspace_id,
          organizationName: r.workspace_name,
          organizationSlug: r.workspace_slug,
          status: r.status,
          assignedRole: r.assigned_role,
          rejectionReason: r.rejection_reason,
          createdAt: r.created_at,
          reviewedAt: r.reviewed_at,
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/join-requests/status Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch join request status", correlationId },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

