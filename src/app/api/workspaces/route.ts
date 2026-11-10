import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveServerSession } from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  domain: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession();

    // Query all workspaces the authenticated user belongs to
    const res = await query<{
      id: string;
      name: string;
      slug: string;
      role: string;
      status: string;
      created_at: string;
      member_count: string;
    }>(
      `SELECT 
         w.id,
         w.name,
         w.slug,
         COALESCE(wm.role, 'compliance_reviewer') as role,
         COALESCE(wm.status, 'active') as status,
         w.created_at,
         (SELECT COUNT(*)::text FROM workspace_memberships WHERE workspace_id = w.id AND status = 'active') as member_count
       FROM workspaces w
       JOIN workspace_memberships wm ON w.id = wm.workspace_id
       WHERE wm.user_id = $1 AND wm.status = 'active'
       ORDER BY w.name ASC`,
      [session.userId]
    );

    return NextResponse.json({
      success: true,
      data: res.rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        memberCount: parseInt(row.member_count, 10) || 1,
      })),
    });
  } catch (err) {
    const status =
      err instanceof Error && err.name === "AuthenticationRequiredError"
        ? 401
        : 500;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to list workspaces" },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    if (!session.isAuthenticated && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Authentication required to create a workspace." },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = createWorkspaceSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }

    const { name, domain } = validated.data;
    const slug =
      validated.data.slug ||
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Check unique slug constraint
    const existing = await query("SELECT id FROM workspaces WHERE slug = $1 LIMIT 1", [slug]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Workspace slug "${slug}" is already in use. Please choose another.` },
        { status: 409 }
      );
    }

    // Insert workspace and assign creator as 'admin' in a transaction
    const result = await withTransaction(async (client) => {
      const wsInsert = await client.query<{ id: string; name: string; slug: string; created_at: string }>(
        `INSERT INTO workspaces (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug, created_at`,
        [name, slug]
      );
      const newWs = wsInsert.rows[0];

      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1, $2, 'admin', 'active')`,
        [newWs.id, session.userId]
      );

      return newWs;
    });

    // Record audit event
    await AuditService.recordEvent({
      workspaceId: result.id,
      actorId: session.userId,
      entityType: "workspace",
      entityId: result.id,
      action: "workspace_created",
      afterState: { name: result.name, slug: result.slug, createdBy: session.userId },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Organization created successfully",
        workspace: {
          id: result.id,
          name: result.name,
          slug: result.slug,
          role: "admin",
          createdAt: result.created_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create workspace" },
      { status: 500 }
    );
  }
}
