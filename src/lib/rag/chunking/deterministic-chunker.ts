/**
 * BrandShield AI — Deterministic Document Chunker
 * Phase 7: Evidence Intelligence and RAG
 *
 * Slices parsed documents into section-aware, overlapping chunks with stable IDs,
 * page/heading provenance, and sentence-boundary protection.
 */

import crypto from "crypto";
import { ParsedDocument, DocumentChunk, ChunkingOptions } from "../types";

export const DEFAULT_CHUNK_SIZE = 600;
export const DEFAULT_CHUNK_OVERLAP = 120;

export class DeterministicChunker {
  /**
   * Generates a stable, reproducible UUID for a chunk based on its document version,
   * index, and content hash.
   */
  public static generateStableChunkId(
    documentVersionId: string,
    chunkIndex: number,
    content: string
  ): string {
    const raw = `${documentVersionId}:${chunkIndex}:${content.trim()}`;
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    // Format into standard UUID v4 shape (8-4-4-4-12)
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  /**
   * Chunks a parsed document into discrete, overlapping chunks preserving section
   * and page provenance.
   */
  public static chunkDocument(
    document: ParsedDocument,
    options?: ChunkingOptions,
    provenance?: {
      sourceDocumentId?: string;
      documentVersionId?: string;
    }
  ): DocumentChunk[] {
    const targetSize = options?.targetChunkSize || DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunkOverlap || DEFAULT_CHUNK_OVERLAP;

    const chunks: DocumentChunk[] = [];
    let globalChunkIndex = 0;
    const versionId = provenance?.documentVersionId || "00000000-0000-0000-0000-000000000000";

    for (const section of document.sections) {
      const sectionText = section.text.trim();
      if (!sectionText) continue;

      // If the section is small enough, keep it as a single chunk to preserve complete context
      if (sectionText.length <= targetSize + overlap) {
        const stableId = this.generateStableChunkId(versionId, globalChunkIndex, sectionText);
        chunks.push({
          chunkIndex: globalChunkIndex,
          stableId,
          content: sectionText,
          charStart: section.charStart,
          charEnd: section.charEnd,
          pageNumber: section.pageNumber,
          sectionHeading: section.heading,
          tokenCount: Math.ceil(sectionText.length / 4),
          metadata: {
            sourceDocumentId: provenance?.sourceDocumentId,
            documentVersionId: provenance?.documentVersionId,
            format: document.format,
            pageNumber: section.pageNumber,
            sectionHeading: section.heading,
            tokenCount: Math.ceil(sectionText.length / 4),
          },
        });
        globalChunkIndex++;
        continue;
      }

      // Split large section by paragraphs or sentences
      const paragraphs = sectionText.split(/\n\s*\n/);
      let currentChunkText = "";
      let currentChunkStart = section.charStart;
      let relativeOffset = 0;

      for (const paragraph of paragraphs) {
        const para = paragraph.trim();
        if (!para) continue;

        // If adding this paragraph exceeds target size and current chunk is non-empty, emit chunk
        if (currentChunkText.length + para.length > targetSize && currentChunkText.length > 0) {
          const finalChunk = currentChunkText.trim();
          const stableId = this.generateStableChunkId(versionId, globalChunkIndex, finalChunk);

          chunks.push({
            chunkIndex: globalChunkIndex,
            stableId,
            content: finalChunk,
            charStart: currentChunkStart,
            charEnd: currentChunkStart + finalChunk.length,
            pageNumber: section.pageNumber,
            sectionHeading: section.heading,
            tokenCount: Math.ceil(finalChunk.length / 4),
            metadata: {
              sourceDocumentId: provenance?.sourceDocumentId,
              documentVersionId: provenance?.documentVersionId,
              format: document.format,
              pageNumber: section.pageNumber,
              sectionHeading: section.heading,
              tokenCount: Math.ceil(finalChunk.length / 4),
            },
          });
          globalChunkIndex++;

          // Slide window with overlap: preserve last overlap characters from current chunk
          const overlapText = finalChunk.slice(Math.max(0, finalChunk.length - overlap));
          currentChunkText = overlapText + "\n\n" + para;
          currentChunkStart = section.charStart + relativeOffset - overlapText.length;
        } else {
          currentChunkText += (currentChunkText ? "\n\n" : "") + para;
        }

        relativeOffset += para.length + 2;
      }

      // Flush remaining text in section
      if (currentChunkText.trim().length > 0) {
        const finalChunk = currentChunkText.trim();
        const stableId = this.generateStableChunkId(versionId, globalChunkIndex, finalChunk);

        chunks.push({
          chunkIndex: globalChunkIndex,
          stableId,
          content: finalChunk,
          charStart: currentChunkStart,
          charEnd: currentChunkStart + finalChunk.length,
          pageNumber: section.pageNumber,
          sectionHeading: section.heading,
          tokenCount: Math.ceil(finalChunk.length / 4),
          metadata: {
            sourceDocumentId: provenance?.sourceDocumentId,
            documentVersionId: provenance?.documentVersionId,
            format: document.format,
            pageNumber: section.pageNumber,
            sectionHeading: section.heading,
            tokenCount: Math.ceil(finalChunk.length / 4),
          },
        });
        globalChunkIndex++;
      }
    }

    return chunks;
  }
}

