import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid corporate email address"),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { email } = validated.data;
    const supabase = await getSupabaseServerClient();

    // Determine redirect origin for the recovery confirmation
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://brandshield-ai-1.onrender.com";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      const isRateLimit =
        error.message?.toLowerCase().includes("rate limit") ||
        error.status === 429;

      const userMessage = isRateLimit
        ? "Security rate limit: A recovery link was recently requested. Please wait 60 seconds before requesting another."
        : error.message || "Failed to dispatch recovery instructions.";

      return NextResponse.json(
        {
          success: false,
          error: userMessage,
          isRateLimit,
        },
        { status: isRateLimit ? 429 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Time-limited recovery instructions dispatched to your registered address.",
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Internal error processing password recovery";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
