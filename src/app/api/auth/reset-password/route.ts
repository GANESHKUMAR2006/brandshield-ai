import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password cannot exceed 128 characters"),
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

    const validated = resetPasswordSchema.safeParse(body);
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

    const { password } = validated.data;

    // Verify caller has an authenticated session (from recovery token exchange or active login)
    let user = null;
    let supabase = null;
    try {
      supabase = await getSupabaseServerClient();
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (!authError && authUser) {
        user = authUser;
      }
    } catch {
      user = null;
    }

    if (!user || !supabase) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication required. Your recovery session may have expired or is invalid.",
        },
        { status: 401 }
      );
    }

    // Submit password update to Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: updateError.message || "Failed to update password credentials.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Your password has been successfully updated. You may now sign in with your new credentials.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal error updating password";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
