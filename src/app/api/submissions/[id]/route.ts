import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db/server-db";
import { z } from "zod";

const updateSubmissionSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(5).optional(), // Content modification creates a new version!
  channel: z.string().min(2).optional(),
  status: z
    .enum([
      "draft",
      "submitted",
      "processing",
      "under_review",
      "in_review",
      "approved",
      "rejected",
      "changes_requested",
    ])
    .optional(),
  productId: z.string().uuid().nullable().optional(),
  actor: z.string().default("Dr. Elena Vance"),
});

// GET /api/submissions/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch submission with product details
    const subRes = await query(
      `SELECT 
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
        s.updated_at
       FROM submissions s
       JOIN workspaces w ON s.workspace_id = w.id
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.id = $1 AND w.slug = 'dermaglow';`,
      [id]
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Submission not found" },
        { status: 404 }
      );
    }

    const submission = subRes.rows[0];

    // 2. Fetch all historical versions
    const versionsRes = await query(
      `SELECT id, version_number, content, created_at, created_by
       FROM submission_versions
       WHERE submission_id = $1
       ORDER BY version_number ASC;`,
      [id]
    );

    const latestVersion = versionsRes.rows[versionsRes.rows.length - 1];

    // 3. Fetch associated active claims and evidence
    const claimsRes = await query(
      `SELECT 
        c.id,
        c.submission_version_id,
        c.claim_text,
        c.claim_type,
        c.text_start,
        c.text_end,
        c.product_id,
        c.extracted_entities,
        c.extraction_confidence,
        c.verification_status,
        c.risk_level,
        c.verified_at,
        c.evidence_sufficiency,
        c.explanation,
        c.suggested_correction,
        c.created_at
       FROM claims c
       WHERE c.submission_id = $1 AND c.is_active = true
       ORDER BY c.created_at ASC;`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...submission,
        current_version_id: latestVersion?.id || null,
        current_version_number: latestVersion?.version_number || 1,
        versions: versionsRes.rows,
        claims: claimsRes.rows,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve submission";
    return NextResponse.json(
      { success: false, error: "Database error retrieving submission", details: message },
      { status: 500 }
    );
  }
}

// PATCH /api/submissions/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateSubmissionSchema.safeParse(body);

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

    const { title, content, channel, status, productId, actor } = validated.data;

    const result = await withTransaction(async (client) => {
      // 1. Fetch current submission state
      const currentRes = await client.query(
        `SELECT s.*, w.slug
         FROM submissions s
         JOIN workspaces w ON s.workspace_id = w.id
         WHERE s.id = $1 AND w.slug = 'dermaglow'
         FOR UPDATE;`,
        [id]
      );

      if (currentRes.rows.length === 0) {
        throw new Error("Submission not found or unauthorized.");
      }
      const current = currentRes.rows[0];

      // 2. Fetch current maximum version number
      const maxVerRes = await client.query(
        `SELECT COALESCE(MAX(version_number), 1) as max_version
         FROM submission_versions
         WHERE submission_id = $1;`,
        [id]
      );
      const currentMaxVer = Number(maxVerRes.rows[0].max_version);

      let newVersionCreated = false;
      let newVersionNumber = currentMaxVer;

      // 3. If content was modified, create a new immutable version
      if (content !== undefined && content.trim() !== current.content.trim()) {
        newVersionNumber = currentMaxVer + 1;
        await client.query(
          `INSERT INTO submission_versions (submission_id, version_number, content, created_by)
           VALUES ($1, $2, $3, $4);`,
          [id, newVersionNumber, content, actor]
        );
        newVersionCreated = true;
      }

      // 4. Update the master submissions record
      const updatedTitle = title !== undefined ? title : current.title;
      const updatedContent = content !== undefined ? content : current.content;
      const updatedChannel = channel !== undefined ? channel : current.channel;
      const updatedStatus = status !== undefined ? status : current.status;
      const updatedProductId = productId !== undefined ? productId : current.product_id;

      const updateRes = await client.query(
        `UPDATE submissions
         SET title = $1,
             content = $2,
             channel = $3,
             status = $4,
             product_id = $5,
             updated_at = now()
         WHERE id = $6
         RETURNING *;`,
        [updatedTitle, updatedContent, updatedChannel, updatedStatus, updatedProductId, id]
      );
      const updatedSubmission = updateRes.rows[0];

      // 5. Append immutable audit event
      await client.query(
        `INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, before_state, after_state)
         VALUES ($1, $2, 'submission', $3, $4, $5, $6);`,
        [
          current.workspace_id,
          actor,
          id,
          newVersionCreated ? "submission_content_revised" : "submission_metadata_updated",
          JSON.stringify({
            title: current.title,
            status: current.status,
            channel: current.channel,
            version: currentMaxVer,
          }),
          JSON.stringify({
            title: updatedTitle,
            status: updatedStatus,
            channel: updatedChannel,
            version: newVersionNumber,
            version_incremented: newVersionCreated,
          }),
        ]
      );

      return {
        submission: updatedSubmission,
        versionNumber: newVersionNumber,
        newVersionCreated,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.newVersionCreated
        ? `Submission updated and Version ${result.versionNumber} created`
        : "Submission metadata updated successfully",
      data: result.submission,
      current_version_number: result.versionNumber,
      version_created: result.newVersionCreated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update submission";
    const statusCode = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { success: false, error: "Database transaction failed", details: message },
      { status: statusCode }
    );
  }
}
