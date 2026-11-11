import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  requireWorkspaceAccess,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

const switchSchema = z.object({
  workspaceId: z.string().optional(),
  workspaceSlug: z.string().optional(),
}).refine((data) => Boolean(data.workspaceId || data.workspaceSlug), {
  message: "Either workspaceId or workspaceSlug must be provided.",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseRes = switchSchema.safeParse(body);

    if (!parseRes.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload", details: parseRes.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, workspaceSlug } = parseRes.data;
    const target = workspaceId || workspaceSlug;

    // Verify user has active membership in the target workspace
    const verified = await requireWorkspaceAccess(target, undefined, request);

    // Record audit event for workspace switch
    try {
      await AuditService.recordEvent({
        workspaceId: verified.workspaceId,
        actorId: verified.userId,
        actorRole: verified.role,
        action: "workspace_switched",
        entityType: "workspace",
        entityId: verified.workspaceId,
        afterState: {
          previousWorkspaceSlug: request.cookies.get("active_workspace_slug")?.value || null,
          switchedToSlug: verified.workspaceSlug,
          switchedToName: verified.workspaceName,
        },
      });
    } catch {
      // Audit log failure should not block workspace switch
    }

    const response = NextResponse.json({
      success: true,
      workspace: {
        id: verified.workspaceId,
        name: verified.workspaceName,
        slug: verified.workspaceSlug,
        role: verified.role,
      },
    });

    // Set server cookies (30 days persistence, SameSite=Lax for top-level navigation)
    const cookieOptions = {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax" as const,
      httpOnly: false, // Accessible to client-side scripts to maintain sync
      secure: process.env.NODE_ENV === "production",
    };

    response.cookies.set("active_workspace_slug", verified.workspaceSlug, cookieOptions);
    response.cookies.set("active_workspace_id", verified.workspaceId, cookieOptions);

    return response;
  } catch (err: any) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 401 }
      );
    }
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: 403 }
      );
    }

    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces/switch Error] [CorrelationId: ${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Failed to switch workspace", correlationId },
      { status: 500 }
    );
  }
}
