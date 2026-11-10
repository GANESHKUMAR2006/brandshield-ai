import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db/server-db";
import { z } from "zod";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const createSubmissionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().min(5, "Content must be at least 5 characters"),
  channel: z.string().min(2, "Channel must be specified"),
  productId: z.string().regex(uuidRegex, "Invalid product ID").nullable().optional(),
});

// GET /api/submissions
export async function GET() {
  try {
    const session = await resolveServerSession();

    const submissionsRes = await query(`
      SELECT 
        s.id,
        s.workspace_id,
        s.product_id,
        p.name as product_name,
        p.sku as product_sku,
        s.title,
        s.content,
        s.channel,
        s.status,
        s.submitted_by,
        s.submission_date,
        s.created_at,
        s.updated_at,
        COALESCE(MAX(sv.version_number), 1) as current_version_number,
        COUNT(DISTINCT sv.id)::int as total_versions_count,
        COUNT(DISTINCT c.id)::int as total_claims_count,
        COUNT(DISTINCT CASE WHEN c.verification_status = 'supported' THEN c.id END)::int as supported_claims_count,
        COUNT(DISTINCT CASE WHEN c.verification_status IN ('needs_review', 'contradicted', 'outdated') THEN c.id END)::int as review_claims_count
      FROM submissions s
      JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN submission_versions sv ON s.id = sv.submission_id
      LEFT JOIN claims c ON s.id = c.submission_id
      WHERE w.slug = $1
      GROUP BY s.id, p.name, p.sku
      ORDER BY s.created_at DESC;
    `, [session.workspaceSlug]);

    return NextResponse.json({
      success: true,
      workspace: session.workspaceSlug,
      data: submissionsRes.rows,
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Authentication required", details: error.message },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { success: false, error: "Forbidden", details: error.message },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to retrieve submissions";
    return NextResponse.json(
      { success: false, error: "Database error retrieving submissions", details: message },
      { status: 500 }
    );
  }
}

// POST /api/submissions
export async function POST(request: Request) {
  try {
    const session = await resolveServerSession();

    const body = await request.json();
    const validated = createSubmissionSchema.safeParse(body);

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

    const { title, content, channel, productId } = validated.data;
    const authorName = session.userName;

    const result = await withTransaction(async (client) => {
      // 1. Resolve workspace ID from authenticated session
      const wsRes = await client.query(
        "SELECT id FROM workspaces WHERE slug = $1 LIMIT 1;",
        [session.workspaceSlug]
      );
      if (wsRes.rows.length === 0) {
        throw new Error(`Workspace "${session.workspaceSlug}" not found.`);
      }
      const workspaceId = wsRes.rows[0].id;

      if (productId) {
        const prodCheck = await client.query<{ id: string }>(
          `SELECT id FROM products WHERE id = $1 AND workspace_id = $2`,
          [productId, workspaceId]
        );
        if (prodCheck.rows.length === 0) {
          throw new Error(`Product "${productId}" not found or unauthorized in workspace.`);
        }
      }

      // 2. Insert master submission row with matched parameters
      const subRes = await client.query(
        `INSERT INTO submissions (workspace_id, product_id, title, content, channel, status, submitted_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6)
         RETURNING *;`,
        [workspaceId, productId || null, title, content, channel, authorName]
      );
      const newSubmission = subRes.rows[0];

      // 3. Insert initial version (version_number: 1)
      const verRes = await client.query(
        `INSERT INTO submission_versions (submission_id, version_number, content, created_by)
         VALUES ($1, 1, $2, $3)
         RETURNING *;`,
        [newSubmission.id, content, authorName]
      );
      const initialVersion = verRes.rows[0];

      // 4. Log immutable audit event
      await client.query(
        `INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
         VALUES ($1, $2, 'submission', $3, 'submission_created', $4);`,
        [
          workspaceId,
          authorName,
          newSubmission.id,
          JSON.stringify({
            title,
            channel,
            status: "draft",
            version: 1,
            product_id: productId || null,
          }),
        ]
      );

      return {
        submission: newSubmission,
        initialVersion,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: "Submission and initial version created successfully",
        data: {
          ...result.submission,
          current_version_number: 1,
          versions: [result.initialVersion],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Authentication required", details: error.message },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { success: false, error: "Forbidden", details: error.message },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create submission";
    return NextResponse.json(
      { success: false, error: "Database transaction failed", details: message },
      { status: 500 }
    );
  }
}
