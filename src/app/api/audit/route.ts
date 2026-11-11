import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

// GET /api/audit - Live immutable audit log with full filtering
export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const actorId = searchParams.get("actorId") || undefined;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : 50;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : 0;
    const workspaceSlug = searchParams.get("workspaceSlug") || undefined;

    const result = await AuditService.getAuditTrail(session, {
      search,
      startDate,
      endDate,
      entityType,
      action,
      actorId,
      limit,
      offset,
      workspaceSlug,
    });

    return NextResponse.json({
      success: true,
      workspace: result.workspace,
      stats: result.stats,
      count: result.count,
      data: result.events,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ success: false, error: "Authentication required", details: err.message }, { status: 401 });
    }
    if (err instanceof WorkspaceAccessError || err instanceof UnauthorizedRoleError) {
      return NextResponse.json({ success: false, error: "Forbidden", details: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to load audit events";
    const status = message.includes("Forbidden") ? 403 : message.includes("not configured") ? 503 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
