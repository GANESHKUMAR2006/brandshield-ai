import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request?: NextRequest) {
  try {
    try {
      const supabase = await getSupabaseServerClient();
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {
        await supabase.auth.signOut();
      }
    } catch {
      // Continue even if Supabase remote session invalidation was already completed or server client unavailable
    }

    const response = NextResponse.json({
      success: true,
      message: "Session terminated successfully",
    });

    // 1. Explicitly expire all Supabase authentication cookies and BrandShield workspace cookies
    let allCookies: Array<{ name: string; value: string }> = [];
    if (request?.cookies) {
      allCookies = request.cookies.getAll();
    } else {
      try {
        const cookieStore = await cookies();
        allCookies = cookieStore.getAll();
      } catch {
        // Outside Next.js request context
      }
    }

    allCookies.forEach((c) => {
      const lower = c.name.toLowerCase();
      if (
        lower.startsWith("sb-") ||
        lower.includes("auth-token") ||
        lower.includes("supabase") ||
        lower.includes("session") ||
        lower.includes("workspace")
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
        const lower = c.name.toLowerCase();
        if (
          lower.startsWith("sb-") ||
          lower.includes("auth-token") ||
          lower.includes("supabase") ||
          lower.includes("session") ||
          lower.includes("workspace")
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

    // 3. Set anti-caching headers so client browsers never serve stale auth states
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error during sign out";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
