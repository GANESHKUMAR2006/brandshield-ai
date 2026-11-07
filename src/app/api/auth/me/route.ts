import { NextResponse } from "next/server";
import { resolveServerSession, AuthenticationRequiredError } from "@/lib/auth/server-session";

export async function GET() {
  try {
    const session = await resolveServerSession();

    return NextResponse.json({
      success: true,
      user: {
        userId: session.userId,
        userName: session.userName,
        userEmail: session.userEmail,
        role: session.role,
        workspaceId: session.workspaceId,
        workspaceSlug: session.workspaceSlug,
        isAuthenticated: session.isAuthenticated,
        isDemoFallback: session.isDemoFallback,
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
