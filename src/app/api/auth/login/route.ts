import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { query } from "@/lib/db/server-db";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
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
    let supabase;
    try {
      supabase = await getSupabaseServerClient();
    } catch {
      return NextResponse.json(
        { success: false, error: "Authentication service currently unavailable" },
        { status: 503 }
      );
    }

    // 1. Session Isolation: Cleanly terminate any prior session before authenticating the new identity
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore if no prior session
    }

    // 2. Authenticate the new user credentials with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const user = data.user;

    // 3. Resolve workspaces and authoritative database role from active memberships for this specific user UUID
    let userWorkspaces: string[] = [];
    let primaryRole = "compliance_reviewer";
    let primaryWorkspaceId = "";
    let primaryWorkspaceSlug = "";

    try {
      const membershipsRes = await query<{
        slug: string;
        role: string;
        workspace_id: string;
        workspace_name: string;
      }>(
        `SELECT w.slug, wm.role, w.id as workspace_id, w.name as workspace_name
         FROM workspace_memberships wm
         JOIN workspaces w ON wm.workspace_id = w.id
         WHERE wm.user_id = $1 AND wm.status = 'active'
           AND (w.status IS NULL OR w.status != 'archived')
         ORDER BY wm.created_at ASC`,
        [user.id]
      );
      userWorkspaces = membershipsRes.rows.map((r) => r.slug);
      if (membershipsRes.rows.length > 0) {
        primaryRole = membershipsRes.rows[0].role;
        primaryWorkspaceId = membershipsRes.rows[0].workspace_id;
        primaryWorkspaceSlug = membershipsRes.rows[0].slug;
      }
    } catch {
      // Continue to app_metadata check
    }

    if (userWorkspaces.length === 0 && user.app_metadata?.workspaces) {
      userWorkspaces = Array.isArray(user.app_metadata.workspaces)
        ? user.app_metadata.workspaces
        : [user.app_metadata.workspaces];
    }
    if (primaryRole === "compliance_reviewer" && user.app_metadata?.role) {
      primaryRole = user.app_metadata.role;
    }

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split("@")[0] || "Verified Reviewer",
        role: primaryRole,
        workspaceId: primaryWorkspaceId,
        workspaceSlug: primaryWorkspaceSlug || userWorkspaces[0] || "dermaglow",
        workspaces: userWorkspaces,
      },
    });

    // 4. Multi-Tenant Hygiene: Clean up any stale workspace cookies from a prior account session
    response.cookies.delete("active_workspace_slug");
    response.cookies.delete("active_workspace_id");
    response.cookies.delete("workspace_slug");

    // If newly authenticated user has an active workspace, set active_workspace_slug
    if (userWorkspaces.length > 0) {
      response.cookies.set({
        name: "active_workspace_slug",
        value: userWorkspaces[0],
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
