/**
 * BrandShield AI — Structured Table Extractor
 * Phase 2: Multimodal Verification & Document Citation Viewer
 *
 * Identifies, extracts, and serializes tabular evidence structures (Markdown pipe tables,
 * tab-delimited sheets, ASCII grids) with cell-level coordinate preservation.
 */

import { StructuredTableData } from "../types";

export class TableExtractor {
  /**
   * Tests whether a text block contains tabular relationships.
   */
  public static isTabularPassage(text: string): boolean {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;

    // 1. Check for Markdown table syntax: header line, separator line (|---|)
    const hasPipeTable = lines.some((l, idx) => {
      if (idx === 0) return false;
      const prev = lines[idx - 1];
      const isSep = /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(l);
      const prevHasPipes = prev.includes("|") && prev.split("|").length >= 3;
      return isSep && prevHasPipes;
    });
    if (hasPipeTable) return true;

    // 2. Check for tab-delimited rows (at least 2 consecutive rows with 2+ tabs)
    let consecutiveTabRows = 0;
    for (const l of lines) {
      if (l.split("\t").length >= 3) {
        consecutiveTabRows++;
        if (consecutiveTabRows >= 2) return true;
      } else {
        consecutiveTabRows = 0;
      }
    }

    return false;
  }

  /**
   * Discovers and parses all structured tables within a document's text.
   */
  public static extractTables(text: string): StructuredTableData[] {
    const tables: StructuredTableData[] = [];
    const lines = text.split("\n");

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Check for Markdown pipe table start
      if (
        i + 1 < lines.length &&
        line.includes("|") &&
        /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(lines[i + 1].trim())
      ) {
        const headerLine = line;
        const headers = headerLine
          .split("|")
          .map((h) => h.trim())
          .filter((_, idx, arr) => (headerLine.startsWith("|") ? idx > 0 : true) && (headerLine.endsWith("|") ? idx < arr.length - 1 : true));

        i += 2; // skip header and separator
        const rows: string[][] = [];

        while (i < lines.length && lines[i].trim().includes("|")) {
          const rowLine = lines[i].trim();
          if (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(rowLine)) {
            i++;
            continue;
          }
          const rowCells = rowLine
            .split("|")
            .map((c) => c.trim())
            .filter((_, idx, arr) => (rowLine.startsWith("|") ? idx > 0 : true) && (rowLine.endsWith("|") ? idx < arr.length - 1 : true));

          if (rowCells.length > 0) {
            rows.push(rowCells);
          }
          i++;
        }

        if (headers.length > 0 && rows.length > 0) {
          tables.push({
            headers,
            rows,
            rowCount: rows.length,
            colCount: headers.length,
          });
        }
        continue;
      }

      // Check for tab-delimited tables
      if (line.includes("\t") && line.split("\t").length >= 2) {
        const headers = line.split("\t").map((h) => h.trim());
        const rows: string[][] = [];
        i++;

        while (i < lines.length && lines[i].trim().includes("\t")) {
          const cells = lines[i].split("\t").map((c) => c.trim());
          if (cells.length > 0) {
            rows.push(cells);
          }
          i++;
        }

        if (headers.length > 0 && rows.length > 0) {
          tables.push({
            headers,
            rows,
            rowCount: rows.length,
            colCount: headers.length,
          });
        }
        continue;
      }

      i++;
    }

    return tables;
  }

  /**
   * Formats structured table data into a clean Markdown table string.
   */
  public static formatMarkdownTable(table: StructuredTableData): string {
    const colWidths = table.headers.map((h, colIdx) => {
      let max = h.length;
      for (const row of table.rows) {
        if (row[colIdx] && row[colIdx].length > max) {
          max = row[colIdx].length;
        }
      }
      return Math.max(3, max);
    });

    const headerStr =
      "| " +
      table.headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") +
      " |";
    const sepStr =
      "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
    const rowStrs = table.rows.map(
      (row) =>
        "| " +
        table.headers
          .map((_, i) => (row[i] || "").padEnd(colWidths[i]))
          .join(" | ") +
        " |"
    );

    return [headerStr, sepStr, ...rowStrs].join("\n");
  }
}
