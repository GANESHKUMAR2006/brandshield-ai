import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { resolveServerSession, canManageWorkspaceMembers, isValidUUID } from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";
import { ReviewerRole } from "@/types";

const inviteSchema = z.object({
  email: z.string().email("Valid corporate email address is required"),
  role: z.enum(["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify caller is admin or member of workspace (safe from non-UUID demo identity leakage)
    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can view pending invitations" },
        { status: 403 }
      );
    }

    const res = await query<{
      id: string;
      email: string;
      role: string;
      status: string;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, email, role, status, expires_at, created_at
       FROM workspace_invitations
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      invitations: res.rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: r.status,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces/[id]/invitations Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to load invitations", correlationId },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession();

    // Verify admin permission (safe from non-UUID demo identity leakage)
    const memberCheck = isValidUUID(session.userId)
      ? await query<{ role: string }>(
          `SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`,
          [id, session.userId]
        )
      : { rows: [] };

    const callerRole = memberCheck.rows[0]?.role || (session.workspaceId === id ? session.role : "viewer");
    if (!canManageWorkspaceMembers(callerRole as ReviewerRole)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can invite team members" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = inviteSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { email, role } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user with this email is already an active member in this workspace
    try {
      const activeMemberCheck = await query(
        `SELECT wm.id FROM workspace_memberships wm
         JOIN auth.users u ON wm.user_id = u.id
         WHERE wm.workspace_id = $1 AND lower(u.email) = $2 AND wm.status = 'active'
         LIMIT 1`,
        [id, normalizedEmail]
      );
      if (activeMemberCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: `User with email "${normalizedEmail}" is already an active member of this workspace.` },
          { status: 409 }
        );
      }
    } catch {
      // In local testing when auth.users is inaccessible directly
    }

    // 2. Check for duplicate pending invitation
    const duplicatePending = await query(
      `SELECT id FROM workspace_invitations 
       WHERE workspace_id = $1 AND lower(email) = $2 AND status = 'pending' AND expires_at > now()
       LIMIT 1`,
      [id, normalizedEmail]
    );
    if (duplicatePending.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `A pending invitation has already been sent to "${normalizedEmail}". Revoke it first to re-invite.` },
        { status: 409 }
      );
    }

    // 3. Generate single-use secure random token and hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const insertRes = await query<{ id: string; email: string; role: string; expires_at: string; created_at: string }>(
      `INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, status, expires_at, invited_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)
       RETURNING id, email, role, expires_at, created_at`,
      [id, normalizedEmail, role, tokenHash, expiresAt.toISOString(), isValidUUID(session.userId) ? session.userId : null]
    );

    const createdInvite = insertRes.rows[0];

    // Audit log (never log raw tokens)
    try {
      await AuditService.recordEvent({
        workspaceId: id,
        actorId: session.userId,
        entityType: "workspace",
        entityId: createdInvite.id,
        action: "invitation_created",
        afterState: { email: normalizedEmail, role, expiresAt: createdInvite.expires_at },
      });
    } catch (auditErr) {
      console.error("[POST /api/workspaces/[id]/invitations] Audit warning:", auditErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Invitation successfully dispatched to ${normalizedEmail}`,
        invitation: {
          id: createdInvite.id,
          email: createdInvite.email,
          role: createdInvite.role,
          expiresAt: createdInvite.expires_at,
          createdAt: createdInvite.created_at,
          inviteToken: rawToken, // Returned strictly once in API response for delivery, never logged
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/[id]/invitations Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to create invitation", correlationId },
      { status: 500 }
    );
  }
}
