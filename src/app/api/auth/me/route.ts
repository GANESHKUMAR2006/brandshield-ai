import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthenticatedUser,
  resolveServerSession,
  AuthenticationRequiredError,
} from "@/lib/auth/server-session";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request?: NextRequest) {
  try {
    // 1. User must come strictly from a verified Supabase server session
    const authUser = await resolveAuthenticatedUser(request);
    if (!authUser || !authUser.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: No active authenticated session." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Resolve workspace authorization and tenant context (reusing authUser to eliminate duplicate Supabase Auth HTTP request)
    const session = await resolveServerSession(undefined, request, {
      allowNoWorkspace: true,
      authenticatedUser: authUser,
    });

    if (!session || !session.isAuthenticated || session.isDemoFallback) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated: No active authenticated session." },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
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
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated", details: err.message },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }
    const message = err instanceof Error ? err.message : "Session resolution failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
