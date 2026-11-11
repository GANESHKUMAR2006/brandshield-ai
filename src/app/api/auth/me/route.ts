import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthenticatedUser,
  resolveServerSession,
  AuthenticationRequiredError,
} from "@/lib/auth/server-session";

export async function GET(request: NextRequest) {
  try {
    // 1. User must come strictly from a verified Supabase server session
    const authUser = await resolveAuthenticatedUser(request);
    if (!authUser || !authUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: No active authenticated session." },
        { status: 401 }
      );
    }

    // 2. Resolve workspace authorization and tenant context
    const session = await resolveServerSession(undefined, request, { allowNoWorkspace: true });

    if (!session || !session.isAuthenticated || session.isDemoFallback) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: No active authenticated session." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        userId: session.userId,
        userName: session.userName,
        userEmail: session.userEmail,
        role: session.role,
        workspaceId: session.workspaceId,
        workspaceSlug: session.workspaceSlug,
        isAuthenticated: true,
        isDemoFallback: false,
      },
    });
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated", details: err.message },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : "Session resolution failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
