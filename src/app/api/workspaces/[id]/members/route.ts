import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { resolveServerSession, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify workspace exists
    const wsCheck = await query<{ slug: string }>(
      `SELECT slug FROM workspaces WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (wsCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Workspace not found" }, { status: 404 });
    }

    // Verify caller is member of workspace (safe from non-UUID demo identity leakage)
    const isMember = isValidUUID(session.userId)
      ? await query(
          `SELECT id FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    if (isMember.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You are not an active member of this workspace" },
        { status: 403 }
      );
    }

    // Query active members with user details
    let members: Array<{
      id: string;
      userId: string;
      role: string;
      status: string;
      email: string;
      name: string;
      joinedAt: string;
    }> = [];

    try {
      const res = await query<{
        id: string;
        user_id: string;
        role: string;
        status: string;
        created_at: string;
        email: string | null;
        name: string | null;
      }>(
        `SELECT 
           wm.id,
           wm.user_id,
           wm.role,
           wm.status,
           wm.created_at,
           u.email,
           COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as name
         FROM workspace_memberships wm
         LEFT JOIN auth.users u ON wm.user_id = u.id
         WHERE wm.workspace_id = $1
         ORDER BY wm.created_at ASC`,
        [id]
      );

      members = res.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        role: r.role,
        status: r.status,
        email: r.email || "member@organization.internal",
        name: r.name || "Workspace Member",
        joinedAt: r.created_at,
      }));
    } catch {
      // Fallback query if auth.users is restricted from current role
      const res = await query<{
        id: string;
        user_id: string;
        role: string;
        status: string;
        created_at: string;
      }>(
        `SELECT id, user_id, role, status, created_at
         FROM workspace_memberships
         WHERE workspace_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      members = res.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        role: r.role,
        status: r.status,
        email: r.user_id === session.userId ? session.userEmail : "member@organization.internal",
        name: r.user_id === session.userId ? session.userName : "Workspace Member",
        joinedAt: r.created_at,
      }));
    }

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/members Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load workspace members", correlationId },
      { status: 500 }
    );
  }
}
