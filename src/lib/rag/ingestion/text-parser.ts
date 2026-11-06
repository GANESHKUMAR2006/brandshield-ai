/**
 * BrandShield AI — TXT & Markdown Document Parser
 * Phase 7: Evidence Intelligence and RAG
 */

import { ParsedDocument, DocumentSection, SupportedDocumentFormat } from "../types";
import { DocumentParser, DocumentEmptyError, DocumentExtractionError } from "./parser-interface";

export class TextDocumentParser implements DocumentParser {
  public readonly supportedFormats: SupportedDocumentFormat[] = ["txt", "md", "markdown"];

  public canParse(format: string, filename?: string): boolean {
    const fmt = format.toLowerCase().trim();
    if (this.supportedFormats.includes(fmt as SupportedDocumentFormat)) {
      return true;
    }
    if (filename) {
      const ext = filename.split(".").pop()?.toLowerCase();
      return ext === "txt" || ext === "md" || ext === "markdown";
    }
    return false;
  }

  public async parse(
    input: Buffer | string,
    metadata?: {
      title?: string;
      documentType?: string;
      filename?: string;
      [key: string]: unknown;
    }
  ): Promise<ParsedDocument> {
    try {
      const rawText = typeof input === "string" ? input : input.toString("utf-8");

      if (!rawText || rawText.trim().length === 0) {
        throw new DocumentEmptyError(
          `Document "${metadata?.filename || metadata?.title || "text"}" contains no readable text.`
        );
      }

      const format: SupportedDocumentFormat = (
        metadata?.filename?.endsWith(".md") || metadata?.filename?.endsWith(".markdown")
          ? "md"
          : "txt"
      );

      const sections: DocumentSection[] = [];
      const lines = rawText.split("\n");

      let currentHeading = "Preamble / Introduction";
      let currentSectionText: string[] = [];
      let currentSectionStart = 0;
      let currentCharOffset = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Detect Markdown headings (# Header) or Uppercase Section headers (SECTION 1: ...)
        const isMarkdownHeading = /^#{1,4}\s+(.+)$/.test(trimmed);
        const isUppercaseHeading =
          /^(SECTION|PART|CHAPTER|STUDY|APPENDIX|PROTOCOL)\s+[0-9A-ZIVX]+[:.-]\s*(.+)$/i.test(trimmed) ||
          (/^[A-Z0-9\s,–—\-:]{5,60}$/.test(trimmed) && trimmed.length > 5 && !trimmed.endsWith("."));

        if ((isMarkdownHeading || isUppercaseHeading) && currentSectionText.length > 0) {
          // Flush previous section
          const sectionContent = currentSectionText.join("\n").trim();
          if (sectionContent.length > 0) {
            sections.push({
              heading: currentHeading,
              pageNumber: 1, // Plaintext defaults to page 1
              text: sectionContent,
              charStart: currentSectionStart,
              charEnd: currentSectionStart + sectionContent.length,
            });
          }

          currentHeading = isMarkdownHeading
            ? trimmed.replace(/^#{1,4}\s+/, "")
            : trimmed;
          currentSectionText = [];
          currentSectionStart = currentCharOffset;
        }

        currentSectionText.push(line);
        currentCharOffset += line.length + 1; // +1 for newline
      }

      // Flush final section
      if (currentSectionText.length > 0) {
        const finalContent = currentSectionText.join("\n").trim();
        if (finalContent.length > 0) {
          sections.push({
            heading: currentHeading,
            pageNumber: 1,
            text: finalContent,
            charStart: currentSectionStart,
            charEnd: currentSectionStart + finalContent.length,
          });
        }
      }

      // If no headings detected, wrap entire document in a single section
      if (sections.length === 0) {
        sections.push({
          heading: "Full Document Content",
          pageNumber: 1,
          text: rawText.trim(),
          charStart: 0,
          charEnd: rawText.trim().length,
        });
      }

      return {
        title: metadata?.title || metadata?.filename || "Untitled Document",
        documentType: metadata?.documentType || "general_source",
        format,
        totalCharacters: rawText.length,
        totalPages: 1,
        sections,
        rawText,
        metadata: {
          ...metadata,
          parsedAt: new Date().toISOString(),
          lineCount: lines.length,
        },
      };
    } catch (err) {
      if (err instanceof DocumentEmptyError) {
        throw err;
      }
      throw new DocumentExtractionError(
        `Failed to parse text document: ${err instanceof Error ? err.message : "Unknown error"}`,
        err
      );
    }
  }
}

