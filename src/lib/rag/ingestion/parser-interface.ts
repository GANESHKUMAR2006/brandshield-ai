/**
 * BrandShield AI — Document Parser Interface
 * Phase 7: Evidence Intelligence and RAG
 */

import { ParsedDocument, SupportedDocumentFormat } from "../types";

export class DocumentEmptyError extends Error {
  constructor(message = "Document is empty or contains only whitespace.") {
    super(message);
    this.name = "DocumentEmptyError";
  }
}

export class DocumentExtractionError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

export class UnsupportedFormatError extends Error {
  constructor(format: string) {
    super(`Unsupported document format "${format}". Supported formats: PDF, DOCX, TXT, Markdown.`);
    this.name = "UnsupportedFormatError";
  }
}

export interface DocumentParser {
  readonly supportedFormats: SupportedDocumentFormat[];
  canParse(format: string, filename?: string): boolean;
  parse(
    buffer: Buffer | string,
    metadata?: {
      title?: string;
      documentType?: string;
      filename?: string;
      [key: string]: unknown;
    }
  ): Promise<ParsedDocument>;
}

