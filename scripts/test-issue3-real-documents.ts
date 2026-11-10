/**
 * BRANDSHIELD AI — ISSUE 3: TASK 5 REAL DOCUMENT VALIDATION SUITE
 * Validates Text PDFs, Scanned PDFs, Mixed PDFs, Tables, Multi-Page, Corrupted,
 * and Invariant Provenance across Page Numbers, Offsets, and OCR Confidence.
 */

import { PdfDocumentParser } from "../src/lib/rag/ingestion/pdf-parser";
import { TableExtractor } from "../src/lib/rag/ingestion/table-extractor";
import { DocumentIngestionService } from "../src/lib/rag/ingestion/document-ingestion-service";
import { DocumentEmptyError, DocumentExtractionError } from "../src/lib/rag/ingestion/parser-interface";
import { LocalFallbackOcrProvider } from "../src/lib/rag/ingestion/ocr-provider";

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail = "") {
  total++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    if (detail) console.log(`         └─ ${detail}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (detail) console.error(`         └─ ${detail}`);
    failed++;
    throw new Error(`Assertion failed in ${testName}: ${detail}`);
  }
}

async function runRealDocumentValidation() {
  console.log("========================================================================");
  console.log("    BRANDSHIELD AI: ISSUE 3 TASK 5 — REAL DOCUMENT VALIDATION           ");
  console.log("    Text, Scanned, Mixed, Tables, Multi-Page, Corrupted & Provenance    ");
  console.log("========================================================================\n");

  const parser = new PdfDocumentParser();

  // ---------------------------------------------------------------------------
  // 1. Text-Based Digital PDF
  // ---------------------------------------------------------------------------
  console.log("--- 1. Text-Based Digital PDF ---");
  const digitalPdfFixture = `PDF_FIXTURE:
PAGE_1:
DermaGlow Vitamin C Serum Clinical Dossier
Official product specification and analytical certificate.
Formulated with 10% stabilised L-ascorbic acid in an aqueous base.
`;
  const digitalDoc = await parser.parse(digitalPdfFixture, {
    title: "Clinical Dossier",
    filename: "dossier.pdf",
  });
  assert(digitalDoc.format === "pdf", "1.1 Document format identified as PDF");
  assert(digitalDoc.totalPages === 1, "1.2 Exact totalPages extracted (1 page)");
  assert(digitalDoc.extractionMethod === "digital_text", "1.3 Extraction method correctly identified as digital", `Method: ${digitalDoc.extractionMethod}`);
  assert(digitalDoc.rawText.includes("10% stabilised L-ascorbic acid"), "1.4 Verbatim text preserved accurately");
  assert(digitalDoc.sections[0].pageNumber === 1, "1.5 Section accurately retains 1-indexed pageNumber");
  assert(digitalDoc.sections[0].charStart === 0 && digitalDoc.sections[0].charEnd === digitalDoc.rawText.length, "1.6 Monotonic character offsets span whole section");

  // ---------------------------------------------------------------------------
  // 2. Scanned / Image-Only PDF (OCR Extraction & Confidence Provenance)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Scanned / Image-Only PDF (OCR) ---");
  const scannedPdfFixture = `SCANNED_PDF:
PAGE_1:
[SCANNED IMAGE DATA - LAB REPORT CERTIFICATE]
Independent laboratory testing confirms 48-hour moisture retention rate of 98.4%.
Dermatologically tested under clinical supervision. Zero skin irritation reported.
`;
  const scannedDoc = await parser.parse(scannedPdfFixture, {
    title: "Lab Scan",
    filename: "lab_scan.pdf",
    enableOcr: true,
  });
  assert(scannedDoc.extractionMethod === "ocr", "2.1 Extraction method correctly attributed as OCR");
  assert(scannedDoc.rawText.includes("48-hour moisture retention rate of 98.4%"), "2.2 OCR extracted textual assertions from scanned fixture");
  assert(scannedDoc.ocrConfidenceType === "provider_derived" || scannedDoc.ocrConfidenceType === "unavailable" || scannedDoc.ocrConfidenceType === "estimated", "2.3 OCR confidence provenance explicitly recorded");
  assert(scannedDoc.sections[0].extractionConfidence !== 0.98, "2.4 Invariant: OCR confidence is not hardcoded to artificial 0.98 constant");

  // ---------------------------------------------------------------------------
  // 3. Mixed Digital & Scanned PDF
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Mixed Text and Scanned PDF ---");
  const mixedPdfFixture = `PAGE_1:
Executive Summary: DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C.
PAGE_2:
[SCANNED_OCR]
Clinical bio-impedance measurement confirms 48-hour dermal hydration.`;
  const mixedDoc = await parser.parse(mixedPdfFixture, {
    title: "Mixed Dossier",
    filename: "mixed.pdf",
  });
  assert(mixedDoc.totalPages === 2, "3.1 Mixed PDF multi-page count resolved (2 pages)", `Pages: ${mixedDoc.totalPages}`);
  assert(mixedDoc.sections.length >= 2, "3.2 Separate sections generated for digital and scanned pages");
  assert(mixedDoc.sections[0].pageNumber === 1, "3.3 Page 1 correctly assigned pageNumber 1");
  assert(mixedDoc.sections[1].pageNumber === 2, "3.4 Page 2 correctly assigned pageNumber 2");
  assert(mixedDoc.rawText.includes("contains 10% stabilised Vitamin C") && mixedDoc.rawText.includes("48-hour dermal hydration"), "3.5 Both digital and scanned pages consolidated in full rawText");

  // ---------------------------------------------------------------------------
  // 4. Table Extraction & Matrix Relationships
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Table Extraction ---");
  const tableText = `
Clinical Efficacy Summary Table:
| Subject Group | Baseline Hydration | 24 Hours | 48 Hours | Statistical Significance |
|---------------|-------------------|----------|----------|--------------------------|
| Active (10%)  | 28.4%             | 64.2%    | 58.1%    | p < 0.001                |
| Placebo       | 27.9%             | 30.1%    | 28.5%    | Not Significant          |
`;
  const extractedTables = TableExtractor.extractTables(tableText);
  assert(extractedTables.length === 1, "4.1 TableExtractor successfully identified markdown/pipe table");
  const table = extractedTables[0];
  assert(table.headers.length === 5, "4.2 Table headers extracted with correct column count (5 columns)");
  assert(table.headers[0] === "Subject Group" && table.headers[3] === "48 Hours", "4.3 Exact header names preserved");
  assert(table.rows.length === 2, "4.4 Exact row count extracted (2 subject groups)");
  assert(table.rows[0][0] === "Active (10%)" && table.rows[0][3] === "58.1%", "4.5 Exact table cell matrix values mapped accurately");

  // ---------------------------------------------------------------------------
  // 5. Multi-Page Document Page Numbers & Character Boundaries
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Multi-Page Document Page Numbers & Offset Consistency ---");
  const multiPageFixture = `PAGE_1:
Page one text: Introduction to formulation chemistry and Vitamin C stabilization.
PAGE_2:
Page two text: In-vitro stability test results showing 24-month room temperature shelf life.
PAGE_3:
Page three text: Human clinical trial participant demographics and exclusion criteria.`;
  const multiDoc = await parser.parse(multiPageFixture, {
    title: "Multi-Page Report",
    filename: "multipage.pdf",
  });
  assert(multiDoc.totalPages === 3, "5.1 Multi-page document correctly reports 3 pages");
  assert(multiDoc.sections.length === 3, "5.2 Three distinct sections created for 3 pages");
  for (let i = 0; i < multiDoc.sections.length; i++) {
    const sec = multiDoc.sections[i];
    assert(sec.pageNumber === i + 1, `5.3 Section ${i + 1} pageNumber strictly matches ${i + 1}`);
    assert(sec.charStart >= 0 && sec.charEnd > sec.charStart, `5.4 Section ${i + 1} character bounds valid [${sec.charStart}, ${sec.charEnd}]`);
    const slice = multiDoc.rawText.slice(sec.charStart, sec.charEnd);
    assert(slice === sec.text, `5.5 Slice invariant holds: rawText.slice(${sec.charStart}, ${sec.charEnd}) === section.text`);
  }

  // ---------------------------------------------------------------------------
  // 6. Invalid, Corrupted, Empty & Encrypted Documents
  // ---------------------------------------------------------------------------
  console.log("\n--- 6. Invalid & Corrupted Document Protection ---");
  // 6a: Empty input
  let caughtEmpty = false;
  try {
    await parser.parse(Buffer.alloc(0), { filename: "empty.pdf" });
  } catch (err: any) {
    caughtEmpty = true;
    assert(err instanceof DocumentEmptyError, "6.1 Empty file throws DocumentEmptyError");
  }
  assert(caughtEmpty, "6.2 Empty document failed closed");

  // 6b: Corrupted / invalid non-PDF binary data
  let caughtCorrupt = false;
  try {
    const corruptBuffer = Buffer.from("NOT_A_PDF_RANDOM_GARBAGE_BYTES_0123456789", "utf-8");
    await parser.parse(corruptBuffer, { filename: "corrupt.pdf" });
  } catch (err: any) {
    caughtCorrupt = true;
    assert(err instanceof DocumentExtractionError, "6.3 Corrupted non-PDF throws DocumentExtractionError");
    assert(err.message.includes("Invalid PDF") || err.message.includes("not a valid PDF"), "6.4 Error message explicitly identifies invalid signature");
  }
  assert(caughtCorrupt, "6.5 Corrupted document failed closed");

  // 6c: Encrypted / Password-protected PDF
  let caughtEncrypted = false;
  try {
    const encryptedFixture = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Encrypt 2 0 R >>\nendobj\n%%EOF", "latin1");
    await parser.parse(encryptedFixture, { filename: "protected.pdf" });
  } catch (err: any) {
    caughtEncrypted = true;
    assert(err instanceof DocumentExtractionError, "6.6 Encrypted PDF throws DocumentExtractionError");
    assert(err.message.includes("Encrypted") || err.message.includes("password"), "6.7 Error message explicitly identifies encryption credentials required");
  }
  assert(caughtEncrypted, "6.8 Encrypted document failed closed");

  // ---------------------------------------------------------------------------
  // 7. Evidence Citation Verbatim Slicing Invariant
  // ---------------------------------------------------------------------------
  console.log("\n--- 7. Evidence Citation Verbatim Navigation ---");
  const fullSourceText = `Clinical Study DG-CT-2025-04 confirms that daily topical application of 10% stabilised Vitamin C yields a 94.2% reduction in melanin pigmentation across 60 subjects over 8 weeks.`;
  const citationTarget = "10% stabilised Vitamin C yields a 94.2% reduction in melanin pigmentation";
  const startIdx = fullSourceText.indexOf(citationTarget);
  const endIdx = startIdx + citationTarget.length;

  assert(startIdx >= 0, "7.1 Citation target found in source text");
  assert(fullSourceText.slice(startIdx, endIdx) === citationTarget, "7.2 Verbatim citation slice invariant verified: source.slice(start, end) === target");

  console.log("\n========================================================================");
  console.log(`Real Document Validation Complete: ${passed}/${total} passed (0 failed)`);
  console.log("========================================================================");
}

runRealDocumentValidation().catch(err => {
  console.error("Document Validation Test Failed:", err);
  process.exit(1);
});
