import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  canEditSubmissions,
  canForceReextract,
} from "@/lib/auth/server-session";
import { ExtractionService } from "@/lib/ai/extraction/extraction-service";

const ExtractRequestSchema = z.object({
  versionId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      "Invalid version UUID"
    )
    .optional(),
  forceReextract: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate caller and resolve workspace membership
    const session = await resolveServerSession(undefined, request);

    // 2. Validate submission ID
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    // 3. Parse and validate request body
    let body: z.infer<typeof ExtractRequestSchema> = { forceReextract: false };
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const json = JSON.parse(text);
        const parseResult = ExtractRequestSchema.safeParse(json);
        if (!parseResult.success) {
          return NextResponse.json(
            {
              error: "Invalid request payload",
              details: parseResult.error.issues,
            },
            { status: 400 }
          );
        }
        body = parseResult.data;
      }
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON body" },
        { status: 400 }
      );
    }

    // 4. Verify submission existence and workspace ownership (prevent IDOR)
    const subRes = await query<{ id: string }>(
      `SELECT s.id
       FROM submissions s
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE s.id = $1 AND (w.id::text = $2::text OR w.slug = $3::text)`,
      [id, session.workspaceId, session.workspaceSlug]
    );

    if (subRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // 5. Verify RBAC permissions for extraction
    if (!canEditSubmissions(session)) {
      return NextResponse.json(
        { error: "Forbidden", details: "You do not have permission to extract claims from submissions." },
        { status: 403 }
      );
    }

    // 6. Verify RBAC permissions for force re-extraction if requested
    if (body.forceReextract && !canForceReextract(session)) {
      return NextResponse.json(
        { error: "Forbidden", details: "Only workspace administrators and compliance reviewers can force re-extraction." },
        { status: 403 }
      );
    }

    // 7. Verify version ownership and existence if versionId was specified
    if (body.versionId) {
      const verRes = await query<{ id: string }>(
        `SELECT sv.id
         FROM submission_versions sv
         JOIN submissions s ON sv.submission_id = s.id
         JOIN workspaces w ON s.workspace_id = w.id
         WHERE sv.id = $1 AND sv.submission_id = $2 AND (w.id::text = $3::text OR w.slug = $4::text)`,
        [body.versionId, id, session.workspaceId, session.workspaceSlug]
      );

      if (verRes.rows.length === 0) {
        return NextResponse.json(
          { error: "Invalid version ID for this submission" },
          { status: 400 }
        );
      }
    }

    // 8. Execute claim extraction in caller workspace context
    const result = await ExtractionService.extractFromSubmissionVersion(id, {
      versionId: body.versionId,
      forceReextract: body.forceReextract,
      workspaceId: session.workspaceId,
      workspaceSlug: session.workspaceSlug,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required", details: err.message },
        { status: 401 }
      );
    }
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { error: "Forbidden", details: err.message },
        { status: 403 }
      );
    }
    const message = err instanceof Error ? err.message : "Internal extraction error";
    const status = message.includes("not found")
      ? 404
      : message.includes("validation failed") || message.includes("not configured")
      ? 400
      : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}
