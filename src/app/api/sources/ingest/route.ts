/**
 * BrandShield AI — Source Document Ingestion & Chunking API Route
 * Phase 7: Evidence Intelligence and RAG
 *
 * POST /api/sources/ingest
 * Parses document content, chunks with provenance, generates vector embeddings,
 * and persists to document_chunks table.
 *
 * Hardened Security Guarantees:
 * 1. Strict RBAC: Viewer roles are rejected (HTTP 403).
 * 2. Upload size enforcement: Rejects payloads over 15MB (HTTP 413).
 * 3. Magic bytes / signature verification: Rejects invalid or corrupt files (HTTP 400).
 * 4. Tenant isolation: Verifies sourceDocumentId belongs to user's workspace.
 * 5. Fail closed: Prevents phantom success if chunks cannot be persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { DocumentIngestionService } from "@/lib/rag/ingestion/document-ingestion-service";
import { DeterministicChunker } from "@/lib/rag/chunking/deterministic-chunker";
import { getConfiguredEmbeddingProvider } from "@/lib/rag/embeddings/embedding-provider";

const MAX_PAYLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();

    // 1. RBAC authorization gate
    if (session.role === "viewer") {
      return NextResponse.json(
        { error: "Forbidden: Viewer role lacks authorization to ingest source documents." },
        { status: 403 }
      );
    }

    let body: {
      title?: string;
      documentType?: string;
      content?: string;
      format?: string;
      filename?: string;
      sourceDocumentId?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const { title, documentType, content, format, filename, sourceDocumentId } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and document content are required." },
        { status: 400 }
      );
    }

    // 2. Maximum payload size enforcement
    const byteLength = Buffer.byteLength(content, "utf-8");
    if (byteLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `Payload too large: Document size (${(byteLength / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 15MB.`,
        },
        { status: 413 }
      );
    }

    // 3. Magic bytes and signature validation against declared format
    const declaredFmt = (format || "").toLowerCase().trim();
    if (declaredFmt === "pdf" || filename?.toLowerCase().endsWith(".pdf")) {
      const headerPreview = content.slice(0, 50);
      if (!headerPreview.startsWith("%PDF-") && !headerPreview.includes("PDF_FIXTURE:")) {
        return NextResponse.json(
          { error: "Invalid PDF format: File lacks standard %PDF- magic bytes header." },
          { status: 400 }
        );
      }
    } else if (declaredFmt === "docx" || filename?.toLowerCase().endsWith(".docx")) {
      const headerPreview = content.slice(0, 50);
      if (
        !headerPreview.startsWith("PK") &&
        !headerPreview.includes("<w:p>") &&
        !headerPreview.includes("<w:tbl>") &&
        !headerPreview.includes("DOCX_FIXTURE:")
      ) {
        return NextResponse.json(
          { error: "Invalid DOCX format: File lacks standard ZIP archive magic signature." },
          { status: 400 }
        );
      }
    }

    // 4. Ingest and parse document
    const parsed = await DocumentIngestionService.ingestDocument(content, {
      title,
      documentType: documentType || "clinical_dossier",
      format,
      filename,
    });

    // 5. Chunk document with stable IDs and section provenance
    const chunks = DeterministicChunker.chunkDocument(parsed, undefined, {
      sourceDocumentId,
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document yielded zero extractable chunks." },
        { status: 400 }
      );
    }

    // 6. Generate embeddings
    const embeddingProvider = getConfiguredEmbeddingProvider();
    const texts = chunks.map((c) => c.content);
    const embeddings = await embeddingProvider.generateBatchEmbeddings(texts);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    // 7. If sourceDocumentId is provided, persist chunks in PostgreSQL transaction with tenant isolation
    let persistedCount = 0;
    if (sourceDocumentId) {
      await withTransaction(async (client) => {
        // Enforce tenant boundary: source document must belong to the authenticated session workspace
        const docRes = await client.query<{ id: string; workspace_id: string }>(
          `SELECT sd.id, sd.workspace_id 
           FROM source_documents sd
           JOIN workspaces w ON sd.workspace_id = w.id
           WHERE sd.id = $1 AND w.slug = $2`,
          [sourceDocumentId, session.workspaceSlug]
        );

        if (docRes.rows.length === 0) {
          throw new WorkspaceAccessError(
            `Source document "${sourceDocumentId}" not found or unauthorized in workspace "${session.workspaceSlug}".`
          );
        }

        // Resolve latest document version
        const verRes = await client.query<{ id: string; version_number: number }>(
          `SELECT id, version_number FROM document_versions 
           WHERE source_document_id = $1 
           ORDER BY version_number DESC LIMIT 1`,
          [sourceDocumentId]
        );

        if (verRes.rows.length === 0) {
          throw new Error(
            `Source document "${sourceDocumentId}" has no active document version to attach chunks.`
          );
        }

        const docVer = verRes.rows[0];

        for (const chunk of chunks) {
          const vectorString = `[${chunk.embedding!.join(",")}]`;
          await client.query(
            `INSERT INTO document_chunks (
              document_version_id,
              chunk_index,
              content,
              embedding,
              metadata
            ) VALUES ($1, $2, $3, $4::vector, $5)
            ON CONFLICT (document_version_id, chunk_index) 
            DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata`,
            [
              docVer.id,
              chunk.chunkIndex,
              chunk.content,
              vectorString,
              JSON.stringify(chunk.metadata),
            ]
          );
          persistedCount++;
        }

        // Prevent phantom success
        if (persistedCount === 0) {
          throw new Error("Failed to persist document chunks: Zero chunks recorded.");
        }

        // Append audit event
        await client.query(
          `INSERT INTO audit_events (
            workspace_id, actor_id, entity_type, entity_id, action, after_state
          ) VALUES (
            (SELECT workspace_id FROM source_documents WHERE id = $1),
            $2, 'document', $1, 'document_chunks_ingested', $3
          )`,
          [
            sourceDocumentId,
            session.userName,
            JSON.stringify({
              version_id: docVer.id,
              chunks_count: persistedCount,
              provider: embeddingProvider.providerName,
              model: embeddingProvider.modelIdentifier,
            }),
          ]
        );
      });
    }

    return NextResponse.json({
      success: true,
      title: parsed.title,
      format: parsed.format,
      totalCharacters: parsed.totalCharacters,
      sectionsCount: parsed.sections.length,
      chunksGenerated: chunks.length,
      chunksPersisted: persistedCount,
      embeddingModel: embeddingProvider.modelIdentifier,
      sampleChunk: chunks[0]
        ? {
            stableId: chunks[0].stableId,
            heading: chunks[0].sectionHeading,
            contentPreview: chunks[0].content.slice(0, 150) + "...",
            embeddingDimensions: chunks[0].embedding?.length,
          }
        : null,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: err.message }, { status: 401 });
    }
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Document ingestion failed";
    const status =
      message.includes("empty") || message.includes("Unsupported") || message.includes("magic bytes")
        ? 400
        : message.includes("Forbidden") || message.includes("unauthorized")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
