/**
 * BrandShield AI — Document Ingestion Service
 * Phase 7: Evidence Intelligence and RAG
 *
 * Master orchestrator for multi-format document text extraction with
 * provenance preservation, section boundaries, and strict validation.
 */

import { ParsedDocument, SupportedDocumentFormat } from "../types";
import { DocumentParser, UnsupportedFormatError, DocumentEmptyError } from "./parser-interface";
import { TextDocumentParser } from "./text-parser";
import { DocxDocumentParser } from "./docx-parser";
import { PdfDocumentParser } from "./pdf-parser";

export class DocumentIngestionService {
  private static parsers: DocumentParser[] = [
    new TextDocumentParser(),
    new DocxDocumentParser(),
    new PdfDocumentParser(),
  ];

  /**
   * Detects document format from file extension, mime type, or explicit hint.
   */
  public static detectFormat(formatHint?: string, filename?: string): SupportedDocumentFormat {
    if (formatHint) {
      const normalized = formatHint.toLowerCase().trim().replace(/^\./, "");
      if (normalized === "pdf") return "pdf";
      if (normalized === "docx") return "docx";
      if (normalized === "txt" || normalized === "text/plain") return "txt";
      if (normalized === "md" || normalized === "markdown" || normalized === "text/markdown") return "md";
    }

    if (filename) {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext === "pdf") return "pdf";
      if (ext === "docx") return "docx";
      if (ext === "txt") return "txt";
      if (ext === "md" || ext === "markdown") return "md";
    }

    throw new UnsupportedFormatError(formatHint || filename || "unknown");
  }

  /**
   * Ingests and parses a document buffer or text into a structured, provenance-rich ParsedDocument.
   */
  public static async ingestDocument(
    content: Buffer | string,
    metadata: {
      title: string;
      documentType: string;
      format?: string;
      filename?: string;
      sourceDocumentId?: string;
      versionNumber?: number;
      [key: string]: unknown;
    }
  ): Promise<ParsedDocument> {
    const format = this.detectFormat(metadata.format, metadata.filename);

    const parser = this.parsers.find((p) => p.canParse(format, metadata.filename));
    if (!parser) {
      throw new UnsupportedFormatError(format);
    }

    const parsed = await parser.parse(content, {
      ...metadata,
      format,
    });

    if (parsed.totalCharacters === 0 || parsed.rawText.trim().length === 0) {
      throw new DocumentEmptyError(
        `Document "${metadata.title || metadata.filename || "file"}" yielded zero readable characters.`
      );
    }

    return parsed;
  }
}

