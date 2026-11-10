import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  canReviewClaims,
} from "@/lib/auth/server-session";
import { VerificationEngine } from "@/lib/verification/verification-engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate caller and resolve workspace membership
    const session = await resolveServerSession(undefined, _request);

    // 2. Validate input parameters
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      );
    }

    // 3. Verify resource existence and workspace ownership (prevent IDOR)
    const claimRes = await query<{ id: string }>(
      `SELECT c.id
       FROM claims c
       JOIN submissions s ON c.submission_id = s.id
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE c.id = $1 AND (w.id::text = $2::text OR w.slug = $3::text)`,
      [id, session.workspaceId, session.workspaceSlug]
    );

    if (claimRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    // 4. Verify RBAC permissions for claim verification
    if (!canReviewClaims(session)) {
      return NextResponse.json(
        { error: "Forbidden", details: "You do not have permission to verify claims." },
        { status: 403 }
      );
    }

    // 5. Execute claim verification in caller workspace context
    const result = await VerificationEngine.verifyClaim(id, {
      workspaceId: session.workspaceId,
      workspaceSlug: session.workspaceSlug,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required", details: err.message },
        { status: 401 }
      );
    }
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { error: "Forbidden", details: err.message },
        { status: 403 }
      );
    }
    const message = err instanceof Error ? err.message : "Internal verification error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}
