import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/reset-password";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Determine application origin safely
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    requestUrl.origin;

  if (error || errorDescription) {
    const errorMsg = encodeURIComponent(errorDescription || error || "Recovery verification failed");
    return NextResponse.redirect(`${origin}/login?error=${errorMsg}`);
  }

  if (code) {
    try {
      const supabase = await getSupabaseServerClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (!exchangeError) {
        // Successfully exchanged auth code for an authenticated session.
        // Redirect to password update console
        return NextResponse.redirect(`${origin}${next}`);
      }

      const reason = encodeURIComponent(exchangeError.message || "Invalid or expired recovery code");
      return NextResponse.redirect(`${origin}/login?error=${reason}`);
    } catch {
      return NextResponse.redirect(`${origin}/login?error=Unable+to+verify+recovery+session`);
    }
  }

  // Fallback if accessed without code
  return NextResponse.redirect(`${origin}${next}`);
}
