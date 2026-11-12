/**
 * BrandShield AI — Source Document Content & Page Telemetry API Route
 * Phase 2: Multimodal Verification & Document Citation Viewer
 *
 * GET /api/sources/[id]/content
 * Serves structured document pages, version history, and provenance metadata
 * for interactive client-side citation rendering with strict multi-tenant authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";
import { resolveServerSession, AuthenticationRequiredError } from "@/lib/auth/server-session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    // 1. Query source document with workspace isolation
    const docRes = await query<{
      id: string;
      workspace_id: string;
      title: string;
      document_type: string;
      approval_status: string;
      current_version_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT sd.id, sd.workspace_id, sd.title, sd.document_type, 
              sd.approval_status, sd.current_version_id, sd.created_at, sd.updated_at
       FROM source_documents sd
       JOIN workspaces w ON sd.workspace_id = w.id
       WHERE sd.id = $1 AND w.slug = $2`,
      [id, session.workspaceSlug]
    );

    if (docRes.rows.length === 0) {
      return NextResponse.json(
        { error: `Source document "${id}" not found or unauthorized in workspace.` },
        { status: 404 }
      );
    }

    const doc = docRes.rows[0];

    // 2. Fetch versions for this document
    const versionsRes = await query<{
      id: string;
      version_number: number;
      storage_path: string;
      content_hash: string;
      approval_date: string | null;
      valid_from: string;
      valid_until: string | null;
      superseded_at: string | null;
      approval_status: string;
      extracted_pages: unknown;
      extraction_metadata: unknown;
    }>(
      `SELECT id, version_number, storage_path, content_hash, approval_date,
              valid_from, valid_until, superseded_at, approval_status,
              extracted_pages, extraction_metadata
       FROM document_versions
       WHERE source_document_id = $1
       ORDER BY version_number DESC`,
      [doc.id]
    );

    const targetVersion = versionsRes.rows[0];
    let pages: Array<{
      pageNumber: number;
      text: string;
      sections?: Array<{ heading?: string; text: string }>;
    }> = [];

    // Check if extracted_pages JSON is cached on version
    if (targetVersion && Array.isArray(targetVersion.extracted_pages) && targetVersion.extracted_pages.length > 0) {
      pages = targetVersion.extracted_pages as typeof pages;
    } else if (targetVersion) {
      // Reconstruct pages from document_chunks
      const chunksRes = await query<{
        chunk_index: number;
        content: string;
        metadata: { pageNumber?: number; sectionHeading?: string; [key: string]: unknown };
      }>(
        `SELECT chunk_index, content, metadata
         FROM document_chunks
         WHERE document_version_id = $1
         ORDER BY chunk_index ASC`,
        [targetVersion.id]
      );

      const pageMap = new Map<number, string[]>();
      for (const chunk of chunksRes.rows) {
        const pageNum = chunk.metadata?.pageNumber || 1;
        const existing = pageMap.get(pageNum) || [];
        existing.push(chunk.content);
        pageMap.set(pageNum, existing);
      }

      for (const [pageNum, textParts] of pageMap.entries()) {
        pages.push({
          pageNumber: pageNum,
          text: textParts.join("\n\n"),
        });
      }
      pages.sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // Fallback single page if document has no chunks yet
    if (pages.length === 0) {
      pages = [
        {
          pageNumber: 1,
          text: `Source document "${doc.title}" is archived. Click Discover Evidence to view linked excerpts.`,
        },
      ];
    }

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        documentType: doc.document_type,
        approvalStatus: doc.approval_status,
        createdAt: doc.created_at,
        currentVersion: targetVersion
          ? {
              id: targetVersion.id,
              versionNumber: targetVersion.version_number,
              approvalStatus: targetVersion.approval_status,
              validFrom: targetVersion.valid_from,
              validUntil: targetVersion.valid_until,
              supersededAt: targetVersion.superseded_at,
              contentHash: targetVersion.content_hash,
            }
          : null,
        totalPages: pages.length,
        pages,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required", details: err.message },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to load document content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
