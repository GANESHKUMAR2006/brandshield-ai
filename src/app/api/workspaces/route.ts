import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  resolveAuthenticatedUser,
  isValidUUID,
  DERMAGLOW_WORKSPACE_SLUG,
} from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  domain: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await resolveAuthenticatedUser(request);

    if (!user) {
      const isProduction =
        process.env.NODE_ENV === "production" ||
        process.env.NEXT_PUBLIC_APP_ENV === "production";

      const allowDemoAuth =
        process.env.ALLOW_DEMO_AUTH === "true" ||
        process.env.NEXT_PUBLIC_ALLOW_DEMO_AUTH === "true" ||
        process.env.NEXT_PUBLIC_APP_ENV === "demo" ||
        process.env.NEXT_PUBLIC_APP_ENV === "preview";

      if (isProduction && !allowDemoAuth) {
        return NextResponse.json(
          { success: false, error: "Authentication required to list workspaces." },
          { status: 401 }
        );
      }

      // Safe demo fallback: Return demo workspace without querying memberships with non-UUID demo string
      const demoWs = await query<{
        id: string;
        name: string;
        slug: string;
        created_at: string;
      }>(
        `SELECT id, name, slug, created_at
         FROM workspaces
         WHERE slug = $1 LIMIT 1`,
        [DERMAGLOW_WORKSPACE_SLUG]
      );

      return NextResponse.json({
        success: true,
        data: demoWs.rows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          role: "compliance_reviewer",
          status: "active",
          createdAt: row.created_at,
          memberCount: 1,
        })),
      });
    }

    // Strict safety check: Ensure user.id is a valid UUID before running SQL
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_APP_ENV === "production";

    if (isProduction && !isValidUUID(user.id)) {
      return NextResponse.json({ success: true, data: [] });
    }

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
      [user.id]
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
    const correlationId = crypto.randomUUID();
    console.error(`[GET /api/workspaces Error] [CorrelationId: ${correlationId}]:`, err);

    return NextResponse.json(
      { success: false, error: "Failed to list workspaces", correlationId },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve authenticated user exclusively via verified Supabase server session
    const user = await resolveAuthenticatedUser(request);
    if (!user || !user.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required to create a workspace." },
        { status: 401 }
      );
    }

    // 2. Strict UUID safety gate: Reject demo-style strings and invalid non-UUID identifiers
    if (!isValidUUID(user.id)) {
      console.error(`[POST /api/workspaces] Security rejection: Resolved identity is not a valid UUID: "${user.id}"`);
      return NextResponse.json(
        { success: false, error: "Authentication required: A valid authenticated user UUID session is required." },
        { status: 401 }
      );
    }

    // 3. Body parsing and schema validation
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    // Security: Request body cannot supply or override userId or creator identity
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
        .replace(/^-+|-+$/g, "");

    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { success: false, error: "Generated slug is too short. Please provide a valid organization name or slug." },
        { status: 400 }
      );
    }

    // 4. Check unique slug constraint
    const existing = await query("SELECT id FROM workspaces WHERE slug = $1 LIMIT 1", [slug]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Workspace slug "${slug}" is already in use. Please choose another.` },
        { status: 409 }
      );
    }

    // 5. Insert workspace and assign creator as 'admin' in an atomic transaction
    // If membership creation fails, the entire transaction rolls back preventing orphaned workspaces.
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
        [newWs.id, user.id]
      );

      return newWs;
    });

    // 6. Record append-only audit event (non-fatal if audit logging fails)
    try {
      await AuditService.recordEvent({
        workspaceId: result.id,
        actorId: user.id,
        entityType: "workspace",
        entityId: result.id,
        action: "workspace_created",
        afterState: { name: result.name, slug: result.slug, createdBy: user.id, email: user.email },
      });
    } catch (auditErr) {
      console.error("[POST /api/workspaces] Audit log warning:", auditErr);
    }

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
  } catch (err: any) {
    const correlationId = crypto.randomUUID();
    console.error(`[POST /api/workspaces Error] [CorrelationId: ${correlationId}]:`, err);

    // Handle race-condition duplicate slug caught by PostgreSQL unique constraint
    if (
      err?.code === "23505" ||
      err?.message?.includes("workspaces_slug_key") ||
      err?.message?.includes("duplicate key")
    ) {
      return NextResponse.json(
        { success: false, error: "Workspace slug is already in use. Please choose another." },
        { status: 409 }
      );
    }

    // Safe sanitized error response: never expose raw SQL, credentials, or internal schema
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workspace. An unexpected server error occurred.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
