import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { ReviewWorkflowService } from "@/lib/review/review-service";

const submitDecisionSchema = z.object({
  claimId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid claim UUID"),
  decision: z.enum(["approved", "rejected", "escalated", "modified"]),
  comments: z.string().max(1000).optional(),
  overrideReason: z.string().max(1000).optional(),
  escalationCategory: z
    .enum(["legal", "regulatory", "clinical", "brand_compliance", "evidence_conflict", "other"])
    .optional(),
  modifiedClaimText: z.string().min(3).max(1000).optional(),
});

// GET /api/reviews - Fetch prioritized review queue
export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);
    const { searchParams } = new URL(request.url);

    const riskLevel = searchParams.get("riskLevel") || undefined;
    const reviewStatus = searchParams.get("reviewStatus") || undefined;
    const claimType = searchParams.get("claimType") || undefined;
    const search = searchParams.get("search") || undefined;

    const queue = await ReviewWorkflowService.getReviewQueue(session, {
      riskLevel,
      reviewStatus,
      claimType,
      search,
    });

    return NextResponse.json({
      success: true,
      workspace: session.workspaceSlug,
      reviewer: {
        id: session.userId,
        name: session.userName,
        role: session.role,
      },
      count: queue.length,
      data: queue,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Authentication required", details: err.message },
        { status: 401 }
      );
    }
    if (err instanceof WorkspaceAccessError || err instanceof UnauthorizedRoleError) {
      return NextResponse.json(
        { success: false, error: "Forbidden", details: err.message },
        { status: 403 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to load review queue";
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes("not configured") ? 503 : 500 }
    );
  }
}

// POST /api/reviews - Submit human review decision
export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = submitDecisionSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const result = await ReviewWorkflowService.recordReviewDecision(
      session,
      validated.data
    );

    // If claim was modified, automatically trigger deterministic re-verification on the child claim
    if (result.childClaimId) {
      try {
        await ReviewWorkflowService.reverifyModifiedClaim(result.childClaimId, {
          workspaceId: session.workspaceId,
          workspaceSlug: session.workspaceSlug,
        });
      } catch (revErr) {
        console.warn("Child claim re-verification queued/pending:", revErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Review decision "${validated.data.decision}" recorded successfully.`,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    if (err instanceof WorkspaceAccessError || err instanceof UnauthorizedRoleError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to record review decision";
    const status = message.includes("Authentication required") || message.includes("authentication failure")
      ? 401
      : message.includes("Forbidden")
      ? 403
      : message.includes("Validation failed")
      ? 400
      : message.includes("not found")
      ? 404
      : message.includes("not configured")
      ? 503
      : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

