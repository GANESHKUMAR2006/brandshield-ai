import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveAuthenticatedUser, isValidUUID } from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

const acceptSchema = z.object({
  token: z.string().min(10, "Valid invitation token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required to accept an invitation. Please sign in." },
        { status: 401 }
      );
    }

    if (!isValidUUID(user.id)) {
      console.error(`[POST /api/workspaces/invitations/accept] Rejected non-UUID user id: "${user.id}"`);
      return NextResponse.json(
        { success: false, error: "A valid authenticated user account is required to accept an invitation." },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = acceptSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ success: false, error: "Invitation token is required" }, { status: 400 });
    }

    const { token } = validated.data;
    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex");

    // Query invitation by token hash
    const inviteRes = await query<{
      id: string;
      workspace_id: string;
      email: string;
      role: string;
      status: string;
      expires_at: string;
      workspace_name: string;
      workspace_slug: string;
    }>(
      `SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.status, wi.expires_at, w.name as workspace_name, w.slug as workspace_slug
       FROM workspace_invitations wi
       JOIN workspaces w ON wi.workspace_id = w.id
       WHERE wi.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (inviteRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or unknown invitation token." },
        { status: 404 }
      );
    }

    const invite = inviteRes.rows[0];

    // Check status
    if (invite.status === "accepted") {
      return NextResponse.json(
        { success: false, error: "This invitation has already been used and accepted." },
        { status: 400 }
      );
    }

    if (invite.status === "revoked") {
      return NextResponse.json(
        { success: false, error: "This invitation has been revoked by a workspace administrator." },
        { status: 400 }
      );
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      await query(`UPDATE workspace_invitations SET status = 'expired', updated_at = now() WHERE id = $1`, [invite.id]);
      return NextResponse.json(
        { success: false, error: "This invitation link has expired. Please request a new invitation." },
        { status: 410 }
      );
    }

    // In a transaction, mark invitation accepted and insert active membership
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE workspace_invitations
         SET status = 'accepted', accepted_at = now(), accepted_by = $1, updated_at = now()
         WHERE id = $2`,
        [user.id, invite.id]
      );

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (workspace_id, user_id) 
         DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()`,
        [invite.workspace_id, user.id, invite.role]
      );
    });

    try {
      await AuditService.recordEvent({
        workspaceId: invite.workspace_id,
        actorId: user.id,
        actorRole: invite.role,
        actorName: user.name,
        actorEmail: user.email,
        entityType: "workspace",
        entityId: invite.id,
        action: "invitation_accepted",
        afterState: { acceptedBy: user.id, role: invite.role },
      });
    } catch (auditErr) {
      console.error("[POST /api/workspaces/invitations/accept] Audit warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `You have successfully joined ${invite.workspace_name}!`,
      workspace: {
        id: invite.workspace_id,
        name: invite.workspace_name,
        slug: invite.workspace_slug,
        role: invite.role,
      },
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/invitations/accept Error] [CorrelationId: ${correlationId}]:`, err);

    return NextResponse.json(
      { success: false, error: "Failed to accept invitation. An unexpected error occurred.", correlationId },
      { status: 500 }
    );
  }
}
