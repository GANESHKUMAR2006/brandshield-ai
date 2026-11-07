import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/auth/server-session";
import { ReviewWorkflowService } from "@/lib/review/review-service";
import { query } from "@/lib/db/server-db";

// GET /api/submissions/[id]/publication-status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    // Fetch submission with workspace check
    const subRes = await query<{ id: string; status: string; publication_status: string; title: string }>(
      `SELECT s.id, s.status, s.publication_status, s.title
       FROM submissions s
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE s.id = $1 AND w.slug = $2`,
      [id, session.workspaceSlug]
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const claimsRes = await query<{
      id: string;
      review_status: string;
      verification_status: string;
      risk_level: string | null;
      is_active: boolean;
    }>(
      `SELECT id, review_status, verification_status, risk_level, is_active
       FROM claims
       WHERE submission_id = $1 AND is_active = true`,
      [id]
    );

    const eligibility = ReviewWorkflowService.evaluatePublicationEligibility(claimsRes.rows);

    return NextResponse.json({
      success: true,
      submissionId: id,
      title: subRes.rows[0].title,
      status: subRes.rows[0].status,
      publicationStatus: subRes.rows[0].publication_status,
      publication_status: subRes.rows[0].publication_status,
      eligibility: {
        ...eligibility,
        eligible: eligibility.isEligible,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve publication status";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("not configured") ? 503 : 500 }
    );
  }
}

// POST /api/submissions/[id]/publication-status - Publish submission
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    const result = await ReviewWorkflowService.publishSubmission(session, id);

    return NextResponse.json({
      success: true,
      message: `Submission "${result.title}" successfully approved and published.`,
      data: result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Publication failed";
    const status = message.includes("Authentication required") || message.includes("authentication failure")
      ? 401
      : message.includes("Forbidden")
      ? 403
      : message.includes("blocked")
      ? 422
      : message.includes("not found")
      ? 404
      : message.includes("not configured")
      ? 503
      : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

