import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession, AuthenticationRequiredError } from "@/lib/auth/server-session";
import { ComplianceAnalyticsService } from "@/lib/analytics/analytics-service";

export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    const { searchParams } = new URL(request.url);

    const workspaceSlug = searchParams.get("workspaceSlug") || undefined;
    const insights = await ComplianceAnalyticsService.getComplianceInsights(session, workspaceSlug);

    return NextResponse.json({
      success: true,
      workspace: workspaceSlug || session.workspaceSlug,
      count: insights.length,
      data: insights,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ success: false, error: "Authentication required", details: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to load compliance insights";
    const status = message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

