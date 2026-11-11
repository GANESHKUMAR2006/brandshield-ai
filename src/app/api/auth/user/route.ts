import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedUser } from "@/lib/auth/server-session";

export async function GET(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json({ success: true, authenticated: false, user: null });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailConfirmed: user.emailConfirmed ?? true,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, authenticated: false, error: err instanceof Error ? err.message : "Auth check failed" },
      { status: 500 }
    );
  }
}
