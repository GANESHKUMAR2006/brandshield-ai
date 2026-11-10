import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { query } from "@/lib/db/server-db";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
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

    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { email, password } = validated.data;
    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Invalid email or password. Please verify credentials.",
        },
        { status: 401 }
      );
    }

    const user = data.user;

    // Resolve workspaces from active database memberships
    let userWorkspaces: string[] = [];
    try {
      const membershipsRes = await query<{ slug: string }>(
        `SELECT w.slug
         FROM workspace_memberships wm
         JOIN workspaces w ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 AND wm.status = 'active'
         ORDER BY wm.created_at ASC`,
        [user.id]
      );
      userWorkspaces = membershipsRes.rows.map((r) => r.slug);
    } catch {
      // Continue to app_metadata check
    }

    if (userWorkspaces.length === 0 && user.app_metadata?.workspaces) {
      userWorkspaces = Array.isArray(user.app_metadata.workspaces)
        ? user.app_metadata.workspaces
        : [user.app_metadata.workspaces];
    }

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email || "Verified Reviewer",
        role: user.app_metadata?.role || "compliance_reviewer",
        workspaces: userWorkspaces,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
