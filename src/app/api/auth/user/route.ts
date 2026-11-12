import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedUser } from "@/lib/auth/server-session";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: true, authenticated: false, user: null },
        { headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailConfirmed: user.emailConfirmed ?? true,
        },
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, authenticated: false, error: err instanceof Error ? err.message : "Auth check failed" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
