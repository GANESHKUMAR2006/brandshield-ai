import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db/server-db";

/**
 * GET /api/workspaces/invitations/verify?token=...
 * Public verification endpoint for recipients opening invitation links.
 * Returns invitation preview metadata (organization name, email, role, expired status)
 * without consuming or accepting the token.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || token.trim().length < 10) {
      return NextResponse.json({ success: false, error: "Missing or invalid invitation token." }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const res = await query<{
      id: string;
      workspace_id: string;
      email: string;
      role: string;
      status: string;
      expires_at: string;
      workspace_name: string;
    }>(
      `SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.status, wi.expires_at, w.name as workspace_name
       FROM workspace_invitations wi
       JOIN workspaces w ON wi.workspace_id = w.id
       WHERE wi.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invitation not found or invalid." }, { status: 404 });
    }

    const invite = res.rows[0];
    const isExpired = new Date(invite.expires_at).getTime() < Date.now();

    return NextResponse.json({
      success: true,
      invitation: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        workspaceName: invite.workspace_name,
        status: isExpired && invite.status === "pending" ? "expired" : invite.status,
        expiresAt: invite.expires_at,
        isExpired,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/invitations/verify Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Internal server error verifying invitation.", correlationId },
      { status: 500 }
    );
  }
}
