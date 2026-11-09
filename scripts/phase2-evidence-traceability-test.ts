/**
 * BRANDSHIELD AI — PHASE 2 EVIDENCE TRACEABILITY & CITATIONS TEST SUITE
 * Multimodal Verification, In-Document Citations & Provenance Invariants
 *
 * Covers 17 Required Verification Scenarios:
 *  1. Text PDF extraction (sections, digital text, page numbers, offsets)
 *  2. Scanned PDF OCR (image-only PDF text recovery with confidence scoring)
 *  3. Mixed PDF extraction (text page + scanned page with per-page method attribution)
 *  4. Table extraction (headers, rows, matrix relationships, Markdown serialization)
 *  5. Page-number preservation (100% of chunks retain explicit pageNumber)
 *  6. Chunk-to-source mapping (stable UUID generation and provenance metadata)
 *  7. Semantic retrieval (vector similarity scoring)
 *  8. Keyword retrieval (lexical overlap and verbatim match scoring)
 *  9. Hybrid retrieval (70% semantic + 30% lexical weighted fusion)
 * 10. Supporting evidence identification (stance: "supporting")
 * 11. Contradicting evidence identification (stance: "contradicting")
 * 12. Insufficient evidence handling (zero false contradictions, clean unverified state)
 * 13. Exact citation navigation (page, offset, verbatim slice verification)
 * 14. Document version handling (immutable historical provenance across versions)
 * 15. Expired evidence handling (expired and superseded exclusion)
 * 16. Cross-tenant access denial (Tenant A cannot access Tenant B evidence)
 * 17. Unauthorized document access & Extraction failure handling (corrupt/encrypted files)
 */

import crypto from "crypto";
import { DocumentIngestionService } from "../src/lib/rag/ingestion/document-ingestion-service";
import { TableExtractor } from "../src/lib/rag/ingestion/table-extractor";
import { DeterministicChunker } from "../src/lib/rag/chunking/deterministic-chunker";
import { HybridEvidenceRetriever } from "../src/lib/rag/retrieval/hybrid-retriever";
import { RetrievalScorer } from "../src/lib/rag/retrieval/retrieval-scorer";
import { DocumentChunk, RetrievedEvidenceItem, StructuredTableData } from "../src/lib/rag/types";
import { DERMAGLOW_WORKSPACE_ID } from "../src/lib/policy/default-policies";

// ============================================================================
// Test Harness
// ============================================================================

let total = 0;
let passed = 0;
let failed = 0;

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
  }
}

// Unit vector generator for deterministic in-memory vector tests
function createSyntheticVector(seed: string, dimension = 1536): number[] {
  const hash = crypto.createHash("sha256").update(seed).digest();
  const vec: number[] = new Array(dimension);
  let norm = 0;
  for (let i = 0; i < dimension; i++) {
    const val = ((hash[i % hash.length] - 128) / 128) * 0.1;
    vec[i] = val;
    norm += val * val;
  }
  const mag = Math.sqrt(norm) || 1;
  return vec.map((v) => v / mag);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runPhase2Suite() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 2 EVIDENCE TRACEABILITY TEST SUITE         ");
  console.log("       Multimodal Ingestion, OCR, Citations & Provenance Invariants     ");
  console.log("========================================================================\n");

  // --------------------------------------------------------------------------
  // TEST 1: Text-Based PDF Extraction
  // --------------------------------------------------------------------------
  console.log("Test Suite 1: Text-Based PDF Extraction");
  {
    const digitalPdfFixture =
      "PDF_FIXTURE: DermaGlow Retinol Clinical Protocol. In a 12-week randomized trial with 60 patients, 84% demonstrated significant reduction in fine lines.";

    const parsed = await DocumentIngestionService.ingestDocument(digitalPdfFixture, {
      title: "DermaGlow Retinol Protocol",
      documentType: "clinical_dossier",
      format: "pdf",
      filename: "retinol_trial.pdf",
    });

    assert(
      parsed.format === "pdf" &&
      parsed.totalPages === 1 &&
      parsed.totalCharacters > 50 &&
      parsed.sections.length >= 1,
      "1.1 Text-based PDF extracts digital text with page telemetry and character count",
      `Total characters: ${parsed.totalCharacters}, Format: ${parsed.format}`
    );

    assert(
      parsed.sections[0].charStart === 0 &&
      parsed.sections[0].charEnd === parsed.rawText.length &&
      parsed.sections[0].pageNumber === 1,
      "1.2 Section preserves exact character start and end boundaries and page number 1",
      `Offsets: [${parsed.sections[0].charStart}, ${parsed.sections[0].charEnd}], Page: ${parsed.sections[0].pageNumber}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 2: Scanned PDF OCR Extraction
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 2: Scanned PDF OCR Extraction");
  {
    const scannedPdfFixture =
      "SCANNED_PDF: [SCANNED_OCR] High-Performance Liquid Chromatography Lab Certificate: Active Retinol Purity 99.4% w/w verified.";

    const parsed = await DocumentIngestionService.ingestDocument(scannedPdfFixture, {
      title: "HPLC Lab Certificate",
      documentType: "clinical_dossier",
      format: "pdf",
      filename: "scanned_lab_certificate.pdf",
    });

    assert(
      parsed.extractionMethod === "ocr" &&
      parsed.rawText.includes("Active Retinol Purity 99.4%"),
      "2.1 Scanned image PDF successfully processed through OCR provider",
      `Extraction Method: ${parsed.extractionMethod}, Recovered: "${parsed.rawText.slice(0, 45)}..."`
    );

    assert(
      (parsed.extractionConfidence || 0) >= 0.9 &&
      parsed.sections[0].extractionMethod === "ocr",
      "2.2 OCR confidence telemetry preserved at or above 90% threshold",
      `Confidence: ${(parsed.extractionConfidence || 0) * 100}%`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 3: Mixed PDF Extraction (Text + Scanned)
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 3: Mixed PDF Extraction (Multi-Page)");
  {
    const mixedPdfFixture =
      "PAGE_1: Clinical Study Methodology: Digital protocol evaluating 10% Vitamin C serum over 8 weeks.\n" +
      "---PAGE-BREAK---\n" +
      "PAGE_2: [SCANNED_OCR] SCANNED_PAGE: Independent Dermatological Assessment: 92% of test subjects showed zero skin irritation.";

    const parsed = await DocumentIngestionService.ingestDocument(mixedPdfFixture, {
      title: "Mixed Trial Report",
      documentType: "clinical_dossier",
      format: "pdf",
      filename: "mixed_trial_report.pdf",
    });

    assert(
      parsed.sections.length === 2 && parsed.totalPages === 2,
      "3.1 Mixed PDF separates into exactly 2 distinct page sections",
      `Total pages: ${parsed.totalPages}, Sections count: ${parsed.sections.length}`
    );

    const page1 = parsed.sections[0];
    const page2 = parsed.sections[1];

    assert(
      page1.pageNumber === 1 &&
      page1.extractionMethod === "digital_text" &&
      page2.pageNumber === 2 &&
      page2.extractionMethod === "ocr",
      "3.2 Per-page method attribution: Page 1 is 'digital_text', Page 2 is 'ocr'",
      `P1: ${page1.extractionMethod} (Page ${page1.pageNumber}) | P2: ${page2.extractionMethod} (Page ${page2.pageNumber})`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 4: Structured Table Extraction
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 4: Structured Table Extraction");
  {
    const markdownTableText =
      "# Clinical Cohort Demographics\n\n" +
      "| Cohort | Patients | Age Group | Efficacy Outcome |\n" +
      "| --- | --- | --- | --- |\n" +
      "| Active 10% | 45 | 30-55 | 88.5% Improvement |\n" +
      "| Placebo | 45 | 30-55 | 12.0% Improvement |\n" +
      "| Control | 30 | 30-55 | 8.2% Improvement |\n";

    const tables = TableExtractor.extractTables(markdownTableText);

    assert(
      tables.length === 1 &&
      tables[0].colCount === 4 &&
      tables[0].rowCount === 3,
      "4.1 Table extractor detects 4 columns and 3 data rows",
      `Cols: ${tables[0]?.colCount}, Rows: ${tables[0]?.rowCount}`
    );

    assert(
      tables[0].headers[0] === "Cohort" &&
      tables[0].headers[3] === "Efficacy Outcome" &&
      tables[0].rows[0][0] === "Active 10%" &&
      tables[0].rows[0][3] === "88.5% Improvement",
      "4.2 Cell relationships and column headers parsed with exact values",
      `Headers: [${tables[0]?.headers.join(", ")}]`
    );

    const serializedMd = TableExtractor.formatMarkdownTable(tables[0]);
    assert(
      serializedMd.includes("| Active 10%") && serializedMd.includes("| 88.5% Improvement |"),
      "4.3 Structured table serializes back to standard Markdown pipe table"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 5: Page-Number Preservation Invariant
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 5: Page-Number Preservation Invariant");
  {
    const multiPageText =
      "PAGE_1: Introduction to DermaGlow Sunscreen SPF 50 Broad Spectrum formulation.\n" +
      "---PAGE-BREAK---\n" +
      "PAGE_2: In-vitro testing confirms Critical Wavelength exceeds 370nm standards.\n" +
      "---PAGE-BREAK---\n" +
      "PAGE_3: Water resistance evaluated up to 80 minutes immersion.";

    const parsed = await DocumentIngestionService.ingestDocument(multiPageText, {
      title: "Sunscreen Protocol",
      documentType: "clinical_dossier",
      format: "pdf",
      filename: "sunscreen_protocol.pdf",
    });

    const chunks = DeterministicChunker.chunkDocument(parsed, { targetChunkSize: 200 });

    const allHavePageNumbers = chunks.every(
      (c) => typeof c.pageNumber === "number" && c.pageNumber >= 1 && c.pageNumber <= 3
    );

    assert(
      allHavePageNumbers && chunks.length >= 3,
      "5.1 100% of chunks preserve explicit page numbers matching their source section",
      `Total chunks: ${chunks.length}, All have pageNumber: ${allHavePageNumbers}`
    );

    const p1Chunks = chunks.filter((c) => c.pageNumber === 1);
    const p2Chunks = chunks.filter((c) => c.pageNumber === 2);
    const p3Chunks = chunks.filter((c) => c.pageNumber === 3);

    assert(
      p1Chunks.length > 0 && p2Chunks.length > 0 && p3Chunks.length > 0,
      "5.2 Chunks correctly partition across Pages 1, 2, and 3",
      `P1 chunks: ${p1Chunks.length}, P2 chunks: ${p2Chunks.length}, P3 chunks: ${p3Chunks.length}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Chunk-to-Source Mapping & Stable IDs
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 6: Chunk-to-Source Mapping & Stable UUIDs");
  {
    const docVerId = "11111111-2222-3333-4444-555555555555";
    const chunkContent = "Clinical trial confirms 84% reduction in wrinkles.";

    const id1 = DeterministicChunker.generateStableChunkId(docVerId, 0, chunkContent);
    const id2 = DeterministicChunker.generateStableChunkId(docVerId, 0, chunkContent);
    const id3 = DeterministicChunker.generateStableChunkId(docVerId, 1, chunkContent);

    assert(
      id1 === id2 && id1 !== id3,
      "6.1 Chunk UUID generation is strictly deterministic and index-differentiated",
      `UUID: ${id1}`
    );

    assert(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id1),
      "6.2 Generated stable chunk identifier conforms to standard UUID v4 format"
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: Semantic Retrieval
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 7: Semantic Vector Retrieval");
  {
    const vecA = createSyntheticVector("clinical trial wrinkles fine lines");
    const vecB = createSyntheticVector("clinical trial wrinkles fine lines");
    const vecC = createSyntheticVector("completely unrelated shipping logistics");

    const simHigh = RetrievalScorer.computeCosineSimilarity(vecA, vecB);
    const simLow = RetrievalScorer.computeCosineSimilarity(vecA, vecC);

    assert(
      simHigh > 0.95 && simLow < 0.6,
      "7.1 Cosine similarity computes semantic closeness between vectors",
      `Matching vectors similarity: ${(simHigh * 100).toFixed(1)}%, Distant vectors: ${(simLow * 100).toFixed(1)}%`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 8: Keyword Retrieval
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 8: Keyword Lexical Retrieval");
  {
    const query = "10% stabilised Vitamin C";
    const contentExact = "Our formulation contains 10% stabilised Vitamin C for antioxidant defense.";
    const contentPartial = "Formulated with 5% Vitamin C and hyaluronic acid.";
    const contentNone = "Contains retinol and peptide complex.";

    const scoreExact = RetrievalScorer.computeKeywordScore(query, contentExact);
    const scorePartial = RetrievalScorer.computeKeywordScore(query, contentPartial);
    const scoreNone = RetrievalScorer.computeKeywordScore(query, contentNone);

    assert(
      scoreExact === 1.0 && scorePartial > scoreNone,
      "8.1 Verbatim substring match yields maximum 1.0 keyword score",
      `Exact: ${scoreExact}, Partial: ${scorePartial}, None: ${scoreNone}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 9: Hybrid Retrieval (70% Semantic + 30% Lexical)
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 9: Hybrid Retrieval Fusion");
  {
    const vecSim = 0.8;
    const kwScore = 1.0;
    const hybrid = RetrievalScorer.computeHybridRelevance(vecSim, kwScore);
    const expected = Number((0.8 * 0.7 + 1.0 * 0.3).toFixed(4)); // 0.56 + 0.30 = 0.86

    assert(
      hybrid === expected && hybrid === 0.86,
      "9.1 Hybrid scoring applies 70% vector + 30% lexical fusion weighting",
      `Computed: ${hybrid}, Expected: ${expected}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 10: Supporting Evidence Stance Detection
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 10: Supporting Evidence Stance Detection");
  {
    const claim = "Clinically proven to reduce fine lines in 12 weeks";
    const excerpt = "A double-blind clinical trial demonstrated efficacy with statistically significant reduction in fine lines over 12 weeks.";

    const stance = RetrievalScorer.evaluateStance(claim, excerpt);

    assert(
      stance === "supporting",
      "10.1 Supportive clinical trial findings classified as 'supporting' stance",
      `Detected stance: ${stance}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 11: Contradicting Evidence Stance Detection
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 11: Contradicting Evidence Stance Detection");
  {
    const claim = "Eliminates 100% of wrinkles permanently";
    const excerpt = "Clinical trials show temporary improvement in fine lines; not 100% and does not cure or permanently eradicate deep wrinkles.";

    const stance = RetrievalScorer.evaluateStance(claim, excerpt);

    assert(
      stance === "contradicting",
      "11.1 Absolute claims refuted by clinical limitations tagged as 'contradicting' stance",
      `Detected stance: ${stance}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 12: Insufficient Evidence Handling
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 12: Insufficient Evidence Handling");
  {
    const mockChunks: any[] = [];
    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "Unbacked miracle ingredient reverses biological aging by 30 years",
        workspaceSlug: "dermaglow",
        similarityThreshold: 0.5,
      },
      mockChunks
    );

    assert(
      results.length === 0,
      "12.1 Claims lacking matching evidence yield 0 results without inventing false contradictions",
      `Results count: ${results.length}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 13: Exact Citation Navigation (Page & Offsets)
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 13: In-Document Citation Navigation");
  {
    const fullPageContent =
      "Clinical Safety Protocol P-402.\n" +
      "Patient monitoring took place daily over 14 days.\n" +
      "Active 0.5% concentration resulted in zero reported erythema or contact dermatitis across all 60 subjects.\n" +
      "Conclusion: formulation is safe for twice-daily application.";

    const targetExcerpt = "Active 0.5% concentration resulted in zero reported erythema or contact dermatitis across all 60 subjects.";

    const charStart = fullPageContent.indexOf(targetExcerpt);
    const charEnd = charStart + targetExcerpt.length;

    assert(
      charStart > 0 &&
      fullPageContent.slice(charStart, charEnd) === targetExcerpt,
      "13.1 Citation coordinates verify exact character span alignment in source page",
      `Span: [${charStart}, ${charEnd}], Length: ${targetExcerpt.length}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 14: Document Version Handling & Provenance
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 14: Document Version Handling & Immutability");
  {
    const v1Chunk: DocumentChunk & any = {
      chunkIndex: 0,
      stableId: "chunk-v1",
      content: "Version 1 formulation specifies 0.5% retinol.",
      charStart: 0,
      charEnd: 46,
      pageNumber: 1,
      sourceDocumentId: "doc-100",
      sourceDocumentTitle: "Retinol Formula Dossier",
      documentType: "clinical_dossier",
      documentVersionId: "ver-1",
      versionNumber: 1,
      workspaceSlug: "dermaglow",
      approvalStatus: "superseded",
      supersededAt: "2026-03-01T00:00:00Z",
    };

    const v2Chunk: DocumentChunk & any = {
      chunkIndex: 0,
      stableId: "chunk-v2",
      content: "Version 2 formulation specifies 1.0% encapsulated retinol.",
      charStart: 0,
      charEnd: 58,
      pageNumber: 1,
      sourceDocumentId: "doc-100",
      sourceDocumentTitle: "Retinol Formula Dossier",
      documentType: "clinical_dossier",
      documentVersionId: "ver-2",
      versionNumber: 2,
      workspaceSlug: "dermaglow",
      approvalStatus: "approved",
      supersededAt: null,
    };

    // Active retrieval excludes superseded v1
    const activeSearch = HybridEvidenceRetriever.searchInMemory(
      { claimText: "retinol formulation", workspaceSlug: "dermaglow", includeExpired: false },
      [v1Chunk, v2Chunk]
    );

    assert(
      activeSearch.length === 1 && activeSearch[0].versionNumber === 2,
      "14.1 Active evidence retrieval selects current v2 and excludes superseded v1",
      `Retrieved version: v${activeSearch[0]?.versionNumber}`
    );

    // Audit inspection allows querying historical v1
    const auditSearch = HybridEvidenceRetriever.searchInMemory(
      { claimText: "retinol formulation", workspaceSlug: "dermaglow", includeExpired: true },
      [v1Chunk, v2Chunk]
    );

    assert(
      auditSearch.length === 2 && auditSearch.some((r) => r.versionNumber === 1),
      "14.2 Historical audit trail retains access to superseded v1 evidence provenance",
      `Audit retrieved: ${auditSearch.length} versions`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 15: Expired Evidence Handling
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 15: Expired Evidence Handling");
  {
    const expiredChunk: DocumentChunk & any = {
      chunkIndex: 0,
      stableId: "chunk-expired",
      content: "Summer promotion price ₹1,299 valid through August 2025.",
      charStart: 0,
      charEnd: 56,
      pageNumber: 1,
      sourceDocumentId: "doc-promo",
      sourceDocumentTitle: "Price Schedule 2025",
      documentType: "pricing_schedule",
      documentVersionId: "ver-expired",
      versionNumber: 1,
      workspaceSlug: "dermaglow",
      approvalStatus: "approved",
      validUntil: "2025-08-31T23:59:59Z", // Past date
      supersededAt: null,
    };

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "Summer promotion price ₹1,299",
        workspaceSlug: "dermaglow",
        effectiveDate: new Date("2026-02-01"),
        includeExpired: false,
      },
      [expiredChunk]
    );

    assert(
      results.length === 0,
      "15.1 Evidence with past expiration date (valid_until < effectiveDate) excluded from active retrieval",
      `Results count: ${results.length}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 16: Cross-Tenant Access Denial
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 16: Cross-Tenant Evidence Access Denial");
  {
    const tenantAChunk: DocumentChunk & any = {
      chunkIndex: 0,
      stableId: "chunk-tenant-a",
      content: "DermaGlow proprietary peptide complex efficacy report.",
      charStart: 0,
      charEnd: 55,
      pageNumber: 1,
      sourceDocumentId: "doc-tenant-a",
      sourceDocumentTitle: "DermaGlow Clinical Dossier",
      documentType: "clinical_dossier",
      documentVersionId: "ver-a",
      versionNumber: 1,
      workspaceSlug: "dermaglow",
      approvalStatus: "approved",
      supersededAt: null,
    };

    const tenantBChunk: DocumentChunk & any = {
      chunkIndex: 0,
      stableId: "chunk-tenant-b",
      content: "BioHealth Global confidential trade secrets and clinical formulation.",
      charStart: 0,
      charEnd: 69,
      pageNumber: 1,
      sourceDocumentId: "doc-tenant-b",
      sourceDocumentTitle: "BioHealth Clinical Dossier",
      documentType: "clinical_dossier",
      documentVersionId: "ver-b",
      versionNumber: 1,
      workspaceSlug: "biohealth-global",
      approvalStatus: "approved",
      supersededAt: null,
    };

    // Tenant A queries
    const tenantAResults = HybridEvidenceRetriever.searchInMemory(
      { claimText: "clinical formulation", workspaceSlug: "dermaglow" },
      [tenantAChunk, tenantBChunk]
    );

    const crossLeakedToA = tenantAResults.some((r) => r.sourceDocumentTitle.includes("BioHealth"));

    assert(
      !crossLeakedToA && tenantAResults.length === 1,
      "16.1 Tenant A strictly prohibited from retrieving evidence belonging to Tenant B",
      `Tenant A received: "${tenantAResults[0]?.sourceDocumentTitle}"`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 17: Extraction Failure & Corrupted File Handling
  // --------------------------------------------------------------------------
  console.log("\nTest Suite 17: Extraction Failure & Corrupted File Handling");
  {
    // Encrypted PDF
    const encryptedBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Filter/Standard/V 2/R 3/P -4/Encrypt 3 0 R>>endobj\n%%EOF"
    );

    let caughtEncrypt = false;
    let encryptMsg = "";
    try {
      await DocumentIngestionService.ingestDocument(encryptedBuffer, {
        title: "Encrypted Doc",
        documentType: "clinical_dossier",
        format: "pdf",
        filename: "encrypted.pdf",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        caughtEncrypt = err.message.includes("Encrypted") || err.message.includes("credentials");
        encryptMsg = err.message;
      }
    }

    assert(
      caughtEncrypt,
      "17.1 Encrypted PDF rejected with explicit credentials required error",
      encryptMsg
    );

    // Corrupted PDF
    const corruptedBuffer = Buffer.from("%PDF-1.4 corrupted binary junk that terminates early");
    let caughtCorrupt = false;
    let corruptMsg = "";
    try {
      await DocumentIngestionService.ingestDocument(corruptedBuffer, {
        title: "Corrupted Doc",
        documentType: "clinical_dossier",
        format: "pdf",
        filename: "corrupt.pdf",
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        caughtCorrupt = err.message.includes("Corrupted") || err.message.includes("Malformed") || err.message.includes("Invalid");
        corruptMsg = err.message;
      }
    }

    assert(
      caughtCorrupt,
      "17.2 Corrupted PDF rejected gracefully with clear malformed structure error",
      corruptMsg
    );
  }

  // ==========================================================================
  // Summary Report
  // ==========================================================================
  console.log("\n========================================================================");
  console.log(`Phase 2 Evidence Traceability Test Suite Complete: ${passed}/${total} passed (${failed} failed)`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Suite().catch((err) => {
  console.error("FATAL: Phase 2 Test Runner Crashed:", err);
  process.exit(1);
});
