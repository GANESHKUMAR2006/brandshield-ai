import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Valid corporate or professional email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const validated = registerSchema.safeParse(body);
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

    const { name, email, password } = validated.data;
    const normalizedEmail = email.toLowerCase().trim();

    const supabase = await getSupabaseServerClient();

    // Sign up with Supabase Auth
    // Note: Do NOT auto-create any workspace memberships or assign privileged roles here
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: name.trim(),
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      // Check for user already registered
      if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("exists")) {
        return NextResponse.json(
          {
            success: false,
            error: "An account with this email address already exists. Please sign in instead.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: "Failed to create account. Please try again." },
        { status: 500 }
      );
    }

    // Auto sign-in if session was created, or user can sign in
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please join an organization to continue.",
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name.trim(),
        },
        requiresOrgOnboarding: true,
      },
      { status: 201 }
    );
  } catch (err) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/auth/register Error] [${correlationId}]:`, err);
    return NextResponse.json(
      { success: false, error: "Internal registration error", correlationId },
      { status: 500 }
    );
  }
}

