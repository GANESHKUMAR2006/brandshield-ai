import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    try {
      const supabase = await getSupabaseServerClient();
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Continue even if Supabase remote session invalidation was already completed or server client unavailable
    }

    const response = NextResponse.json({
      success: true,
      message: "Session terminated successfully",
    });

    // 1. Explicitly expire all Supabase authentication cookies and BrandShield workspace cookies
    const allCookies = request.cookies.getAll();
    allCookies.forEach((c) => {
      if (
        c.name.startsWith("sb-") ||
        c.name.includes("auth-token") ||
        c.name.includes("supabase") ||
        c.name.includes("workspace")
      ) {
        response.cookies.set({
          name: c.name,
          value: "",
          maxAge: 0,
          path: "/",
          expires: new Date(0),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        });
      }
    });

    // Ensure specific workspace context cookies are wiped
    const workspaceCookies = ["active_workspace_slug", "active_workspace_id", "workspace_slug"];
    workspaceCookies.forEach((name) => {
      response.cookies.set({
        name,
        value: "",
        maxAge: 0,
        path: "/",
        expires: new Date(0),
        sameSite: "lax",
      });
    });

    // 2. Clear Next.js server-side cookieStore
    try {
      const cookieStore = await cookies();
      allCookies.forEach((c) => {
        if (
          c.name.startsWith("sb-") ||
          c.name.includes("auth-token") ||
          c.name.includes("supabase") ||
          c.name.includes("workspace")
        ) {
          cookieStore.delete(c.name);
        }
      });
      workspaceCookies.forEach((name) => {
        cookieStore.delete(name);
      });
    } catch {
      // Ignore if called in context where cookieStore.delete is restricted
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error during sign out";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
