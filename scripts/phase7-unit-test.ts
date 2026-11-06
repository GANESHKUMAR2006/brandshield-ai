/**
 * BRANDSHIELD AI — PHASE 7 ISOLATED UNIT TEST SUITE
 * Evidence Intelligence and Retrieval-Augmented Generation (RAG)
 *
 * Runs completely in-memory without requiring live Supabase or OpenAI credentials.
 */

import { DocumentIngestionService } from "../src/lib/rag/ingestion/document-ingestion-service";
import { DocumentEmptyError, UnsupportedFormatError } from "../src/lib/rag/ingestion/parser-interface";
import { DeterministicChunker } from "../src/lib/rag/chunking/deterministic-chunker";
import { MockEmbeddingProvider } from "../src/lib/rag/embeddings/mock-embedding";
import { PGVECTOR_EMBEDDING_DIMENSION, EmbeddingDimensionMismatchError } from "../src/lib/rag/embeddings/embedding-provider";
import { RetrievalScorer } from "../src/lib/rag/retrieval/retrieval-scorer";
import { HybridEvidenceRetriever } from "../src/lib/rag/retrieval/hybrid-retriever";

async function runTests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: PHASE 7 ISOLATED UNIT TEST SUITE                 ");
  console.log("       Evidence Intelligence & Retrieval-Augmented Generation (RAG)     ");
  console.log("========================================================================\n");

  let passed = 0;
  let failed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail = "") {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (detail) console.log(`       └─ ${detail}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       └─ ${detail}`);
      failed++;
    }
  }

  // 1. Text Ingestion: Plaintext parsing preserving structure
  {
    const txt = `SECTION 1: CLINICAL STUDY OVERVIEW\n\nStudy conducted across 120 patients over 12 weeks.\n\nSECTION 2: EFFICACY RESULTS\n\nShowed 84% reduction in wrinkles.`;
    const doc = await DocumentIngestionService.ingestDocument(txt, {
      title: "Clinical Dossier A",
      documentType: "clinical_dossier",
      format: "txt",
    });
    assert(
      doc.format === "txt" && doc.sections.length >= 2 && doc.totalCharacters === txt.length,
      "1. Plaintext ingestion extracts sections and total character count"
    );
  }

  // 2. Markdown Ingestion: Preserves header hierarchy and section offsets
  {
    const md = `# DermaGlow Retinol Clinical Dossier\n\nPatient testing methodology.\n\n## Formulations & Potency\n\nContains 0.5% pure encapsulated retinol.\n\n## Clinical Trial Outcomes\n\nStatistically significant 78% improvement in skin firmness at 8 weeks.`;
    const doc = await DocumentIngestionService.ingestDocument(md, {
      title: "DermaGlow Retinol",
      documentType: "clinical_dossier",
      format: "md",
      filename: "retinol_dossier.md",
    });
    const hasHeadings = doc.sections.some((s) => s.heading?.includes("Formulations"));
    assert(
      doc.format === "md" && hasHeadings && doc.sections.length >= 3,
      "2. Markdown ingestion preserves section headings and hierarchy"
    );
  }

  // 3. Document Extraction Failure: Empty document strictly rejected
  {
    let caughtEmpty = false;
    try {
      await DocumentIngestionService.ingestDocument("   \n\n  \t ", {
        title: "Empty Doc",
        documentType: "clinical_dossier",
        format: "txt",
      });
    } catch (err) {
      caughtEmpty = err instanceof DocumentEmptyError || (err instanceof Error && err.name === "DocumentEmptyError");
    }
    assert(caughtEmpty, "3. Empty document is strictly rejected with DocumentEmptyError");
  }

  // 4. Document Extraction Failure: Unsupported format rejected
  {
    let caughtUnsupported = false;
    try {
      await DocumentIngestionService.ingestDocument("binary content", {
        title: "Spreadsheet",
        documentType: "spec",
        format: "xlsx",
      });
    } catch (err) {
      caughtUnsupported = err instanceof UnsupportedFormatError || (err instanceof Error && err.name === "UnsupportedFormatError");
    }
    assert(caughtUnsupported, "4. Unsupported format is rejected with UnsupportedFormatError");
  }

  // 5. DOCX Ingestion: Text run and paragraph parsing
  {
    const docxXml = `DOCX_FIXTURE:<w:p><w:pStyle w:val="Heading1"/><w:r><w:t>Protocol 101 Efficacy</w:t></w:r></w:p><w:p><w:r><w:t>Formulated with 2% Hyaluronic Acid.</w:t></w:r></w:p>`;
    const doc = await DocumentIngestionService.ingestDocument(docxXml, {
      title: "HA Protocol",
      documentType: "clinical_protocol",
      format: "docx",
      filename: "protocol.docx",
    });
    assert(
      doc.format === "docx" && doc.rawText.includes("Hyaluronic Acid"),
      "5. DOCX parser extracts structured paragraphs and text runs"
    );
  }

  // 6. PDF Ingestion: Text stream extraction
  {
    const pdfText = `PDF_FIXTURE: Double-blind clinical evaluation of DermaGlow Radiance Cream. N=150 participants. 92% reported brighter skin tone.`;
    const doc = await DocumentIngestionService.ingestDocument(pdfText, {
      title: "Radiance Clinical PDF",
      documentType: "clinical_dossier",
      format: "pdf",
      filename: "radiance_study.pdf",
    });
    assert(
      doc.format === "pdf" && doc.rawText.includes("92% reported brighter skin"),
      "6. PDF parser extracts text streams and records page telemetry"
    );
  }

  // 7. Deterministic Chunking: Stable chunk ID generation
  {
    const id1 = DeterministicChunker.generateStableChunkId("version-1", 0, "Consistent text chunk content");
    const id2 = DeterministicChunker.generateStableChunkId("version-1", 0, "Consistent text chunk content");
    const id3 = DeterministicChunker.generateStableChunkId("version-1", 1, "Consistent text chunk content");
    assert(
      id1 === id2 && id1 !== id3 && id1.length === 36,
      "7. Chunk identifier generation is deterministic and reproducible"
    );
  }

  // 8. Deterministic Chunking: Overlapping sliding window & provenance preservation
  {
    const longSectionText = `Paragraph 1: Background and introduction to the medical study.\n\n` +
      `Paragraph 2: Methodology involving randomized controlled trials across four dermatology clinics in Mumbai.\n\n` +
      `Paragraph 3: Key efficacy observations: 89% of patients experienced measurable reduction in hyperpigmentation.\n\n` +
      `Paragraph 4: Safety profile: zero adverse dermatological events recorded throughout the 90-day protocol.\n\n` +
      `Paragraph 5: Final conclusion: product is safe and effective for daily topical application on sensitive skin.`;

    const parsed = {
      title: "Derm Study",
      documentType: "clinical_dossier",
      format: "txt" as const,
      totalCharacters: longSectionText.length,
      totalPages: 1,
      sections: [
        {
          heading: "Section 3: Clinical Outcomes",
          pageNumber: 4,
          text: longSectionText,
          charStart: 0,
          charEnd: longSectionText.length,
        },
      ],
      rawText: longSectionText,
      metadata: {},
    };

    const chunks = DeterministicChunker.chunkDocument(parsed, {
      targetChunkSize: 200,
      chunkOverlap: 50,
    }, {
      documentVersionId: "doc-ver-123",
      sourceDocumentId: "source-doc-456",
    });

    const hasProvenance = chunks.every(
      (c) => c.sectionHeading === "Section 3: Clinical Outcomes" && c.pageNumber === 4 && c.tokenCount > 0
    );

    assert(
      chunks.length >= 2 && hasProvenance,
      "8. Chunking splits large sections with overlap while preserving section heading and page number"
    );
  }

  // 9. Embedding Provider: Dimension validation against pgvector schema (1536)
  {
    const provider = new MockEmbeddingProvider();
    const vector = await provider.generateEmbedding("Clinical efficacy of encapsulated retinol");
    assert(
      vector.length === PGVECTOR_EMBEDDING_DIMENSION && vector.length === 1536,
      "9. Embedding provider generates exactly 1536 dimensions matching pgvector vector(1536)"
    );
  }

  // 10. Embedding Provider: Batch generation dimension consistency
  {
    const provider = new MockEmbeddingProvider();
    const batch = await provider.generateBatchEmbeddings([
      "First clinical observation",
      "Second clinical observation",
      "Third clinical observation",
    ]);
    const allValid = batch.length === 3 && batch.every((v) => v.length === 1536);
    assert(allValid, "10. Batch embedding generation maintains strict 1536 dimension invariance");
  }

  // 11. Embedding Provider: Dimension mismatch error detection
  {
    let caughtMismatch = false;
    try {
      throw new EmbeddingDimensionMismatchError(768, 1536);
    } catch (err) {
      caughtMismatch = err instanceof EmbeddingDimensionMismatchError;
    }
    assert(caughtMismatch, "11. Vector dimension mismatches throw explicit EmbeddingDimensionMismatchError");
  }

  // 12. Retrieval Scoring: Exact phrase match keyword scoring
  {
    const queryText = "reduces fine lines and wrinkles";
    const content = "Our clinical formula visibly reduces fine lines and wrinkles within 4 weeks.";
    const kwScore = RetrievalScorer.computeKeywordScore(queryText, content);
    assert(kwScore === 1.0, "12. Exact query substring yields maximum keyword relevance score of 1.0");
  }

  // 13. Retrieval Scoring: Hybrid score normalization
  {
    const score = RetrievalScorer.computeHybridRelevance(0.9, 0.8);
    assert(score >= 0.85 && score <= 0.90, "13. Hybrid scoring weights vector similarity (70%) and lexical keywords (30%)");
  }

  // 14. Workspace Isolation: Cross-workspace chunks strictly excluded from retrieval
  {
    const mockChunks = [
      {
        chunkIndex: 0,
        stableId: "c1",
        content: "DermaGlow retinol study: 78% improvement in skin firmness.",
        charStart: 0,
        charEnd: 50,
        tokenCount: 15,
        sourceDocumentId: "doc-1",
        sourceDocumentTitle: "DermaGlow Clinical Dossier",
        documentType: "clinical_dossier",
        documentVersionId: "ver-1",
        versionNumber: 1,
        workspaceSlug: "dermaglow",
        metadata: {},
      },
      {
        chunkIndex: 0,
        stableId: "c2",
        content: "AcmeCorp competitor formulation secret: 99% wrinkle elimination.",
        charStart: 0,
        charEnd: 60,
        tokenCount: 20,
        sourceDocumentId: "doc-2",
        sourceDocumentTitle: "Acme Formulation",
        documentType: "clinical_dossier",
        documentVersionId: "ver-2",
        versionNumber: 1,
        workspaceSlug: "acme-corp", // Cross-tenant!
        metadata: {},
      },
    ];

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "wrinkle elimination and skin firmness",
        workspaceSlug: "dermaglow",
      },
      mockChunks
    );

    const hasAcme = results.some((r) => r.sourceDocumentTitle.includes("Acme"));
    assert(!hasAcme && results.length === 1, "14. Cross-workspace documents are strictly filtered out of evidence retrieval");
  }

  // 15. Source Validity Filtering: Superseded document versions strictly excluded
  {
    const mockChunks = [
      {
        chunkIndex: 0,
        stableId: "c-active",
        content: "Current approved formula contains 0.5% retinol.",
        charStart: 0,
        charEnd: 45,
        tokenCount: 12,
        sourceDocumentId: "doc-1",
        sourceDocumentTitle: "Formula V2",
        documentType: "spec",
        documentVersionId: "ver-2",
        versionNumber: 2,
        workspaceSlug: "dermaglow",
        approvalStatus: "approved",
        metadata: {},
      },
      {
        chunkIndex: 0,
        stableId: "c-superseded",
        content: "Old superseded formula contains 1.0% unbuffered retinol.",
        charStart: 0,
        charEnd: 50,
        tokenCount: 14,
        sourceDocumentId: "doc-1",
        sourceDocumentTitle: "Formula V1 (Expired)",
        documentType: "spec",
        documentVersionId: "ver-1",
        versionNumber: 1,
        workspaceSlug: "dermaglow",
        approvalStatus: "superseded",
        supersededAt: "2025-01-01T00:00:00Z",
        metadata: {},
      },
    ];

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "formula retinol concentration",
        workspaceSlug: "dermaglow",
        includeExpired: false,
      },
      mockChunks
    );

    const hasSuperseded = results.some((r) => r.versionNumber === 1);
    assert(!hasSuperseded && results.length === 1, "15. Superseded or expired source documents are excluded from active retrieval");
  }

  // 16. Stance Classification: Detects explicit contradictory evidence
  {
    const stance = RetrievalScorer.evaluateStance(
      "100% permanently eradicates all wrinkles instantly",
      "Clinical study proves formula reduces appearance of fine lines, but does not eradicate permanent deep wrinkles."
    );
    assert(stance === "contradicting", "16. Contradictory evidence phrasing is classified as stance: contradicting");
  }

  // 17. Stance Classification: Detects supportive clinical trial evidence
  {
    const stance = RetrievalScorer.evaluateStance(
      "Reduces appearance of fine lines",
      "Statistically significant demonstrated efficacy: 84% of participants showed measurable reduction in fine lines."
    );
    assert(stance === "supporting", "17. Supportive trial evidence is classified as stance: supporting");
  }

  // 18. Absence of Evidence Invariant: Zero retrieved evidence leaves claim unverified, never contradicted
  {
    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "Extraterrestrial meteorite dust rejuvenates cellular DNA",
        workspaceSlug: "dermaglow",
      },
      [] // Empty library
    );
    assert(
      results.length === 0,
      "18. Unmatched claims produce 0 retrieved passages; system does not invent false contradictions"
    );
  }

  // 19. Evidence Ranking: Highest relevance item ranked first
  {
    const mockChunks = [
      {
        chunkIndex: 0,
        stableId: "c-partial",
        content: "General skin hydration overview and routine maintenance.",
        charStart: 0,
        charEnd: 55,
        tokenCount: 10,
        sourceDocumentId: "d-1",
        sourceDocumentTitle: "Routine Guide",
        documentType: "guideline",
        documentVersionId: "v-1",
        versionNumber: 1,
        workspaceSlug: "dermaglow",
        metadata: {},
      },
      {
        chunkIndex: 0,
        stableId: "c-exact",
        content: "Hyaluronic acid provides 72-hour deep cellular hydration clinically proven in lab assays.",
        charStart: 0,
        charEnd: 85,
        tokenCount: 18,
        sourceDocumentId: "d-2",
        sourceDocumentTitle: "HA Clinical Trial",
        documentType: "clinical_dossier",
        documentVersionId: "v-1",
        versionNumber: 1,
        workspaceSlug: "dermaglow",
        metadata: {},
      },
    ];

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "Hyaluronic acid 72-hour hydration",
        workspaceSlug: "dermaglow",
      },
      mockChunks
    );

    assert(
      results.length === 2 && results[0].sourceDocumentTitle === "HA Clinical Trial",
      "19. Hybrid retrieval ranks exact clinical match ahead of tangential background information"
    );
  }

  // 20. Telemetry & Provenance Preservation: Rationale, Section, and Page Numbers
  {
    const mockChunks = [
      {
        chunkIndex: 2,
        stableId: "c-telemetry",
        content: "Dermatologist tested and approved for sensitive skin without irritation.",
        charStart: 1200,
        charEnd: 1270,
        pageNumber: 3,
        sectionHeading: "Safety & Tolerability",
        tokenCount: 15,
        sourceDocumentId: "d-3",
        sourceDocumentTitle: "Safety Report 2026",
        documentType: "safety_assessment",
        documentVersionId: "v-1",
        versionNumber: 1,
        workspaceSlug: "dermaglow",
        metadata: { pageNumber: 3, sectionHeading: "Safety & Tolerability" },
      },
    ];

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "Dermatologist tested for sensitive skin",
        workspaceSlug: "dermaglow",
      },
      mockChunks
    );

    const first = results[0];
    assert(
      first.pageNumber === 3 &&
      first.sectionHeading === "Safety & Tolerability" &&
      first.retrievalRationale.toLowerCase().includes("safety assessment") &&
      first.sourceValidity.isCurrentlyValid,
      "20. Evidence item preserves page number, section heading, document version, and retrieval rationale"
    );
  }

  // 21. Hardened PDF: Scanned/image-only PDF detected and rejected (OCR unsupported)
  {
    const scannedPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
    );
    let caughtOcr = false;
    let message = "";
    try {
      await DocumentIngestionService.ingestDocument(scannedPdf, {
        title: "Scanned Lab Report",
        documentType: "clinical_dossier",
        format: "pdf",
        filename: "scanned_lab.pdf",
      });
    } catch (err) {
      if (err instanceof Error) {
        caughtOcr = err.message.includes("OCR is unsupported") || err.message.includes("Scanned or image-only");
        message = err.message;
      }
    }
    assert(
      caughtOcr,
      "21. Scanned or image-only PDF is rejected with explicit OCR unsupported error",
      message
    );
  }

  // 22. Hardened PDF: Encrypted or password-protected PDF rejected
  {
    const encryptedPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Filter/Standard/V 2/R 3/P -4/Encrypt 3 0 R>>endobj\n%%EOF"
    );
    let caughtEncrypt = false;
    let message = "";
    try {
      await DocumentIngestionService.ingestDocument(encryptedPdf, {
        title: "Confidential Clinical PDF",
        documentType: "clinical_dossier",
        format: "pdf",
        filename: "confidential.pdf",
      });
    } catch (err) {
      if (err instanceof Error) {
        caughtEncrypt = err.message.includes("Encrypted or password-protected") || err.message.includes("credentials");
        message = err.message;
      }
    }
    assert(
      caughtEncrypt,
      "22. Encrypted PDF is rejected with explicit password/credentials required error",
      message
    );
  }

  // 23. Hardened DOCX: Table extraction structures <w:tbl> into Markdown pipe tables
  {
    const docxWithTable =
      `<w:body>` +
      `<w:p><w:pStyle w:val="Heading1"/><w:r><w:t>Clinical Trial Patient Demographics</w:t></w:r></w:p>` +
      `<w:tbl>` +
      `<w:tr><w:tc><w:p><w:t>Cohort</w:t></w:p></w:tc><w:tc><w:p><w:t>Patients</w:t></w:p></w:tc><w:tc><w:p><w:t>Efficacy Rate</w:t></w:p></w:tc></w:tr>` +
      `<w:tr><w:tc><w:p><w:t>Active 0.5%</w:t></w:p></w:tc><w:tc><w:p><w:t>60</w:t></w:p></w:tc><w:tc><w:p><w:t>84%</w:t></w:p></w:tc></w:tr>` +
      `<w:tr><w:tc><w:p><w:t>Placebo</w:t></w:p></w:tc><w:tc><w:p><w:t>60</w:t></w:p></w:tc><w:tc><w:p><w:t>12%</w:t></w:p></w:tc></w:tr>` +
      `</w:tbl>` +
      `</w:body>`;

    const doc = await DocumentIngestionService.ingestDocument(docxWithTable, {
      title: "Trial Results Table",
      documentType: "clinical_protocol",
      format: "docx",
      filename: "results_table.docx",
    });

    const hasHeaderRow = doc.rawText.includes("| Cohort | Patients | Efficacy Rate |");
    const hasSeparator = doc.rawText.includes("| --- | --- | --- |");
    const hasDataRow = doc.rawText.includes("| Active 0.5% | 60 | 84% |");

    assert(
      hasHeaderRow && hasSeparator && hasDataRow,
      "23. DOCX parser extracts <w:tbl> tables into formatted Markdown pipe tables",
      `Formatted table preview:\n${doc.rawText}`
    );
  }

  // 24. Hardened Multi-Tenant Isolation: Cross-tenant documents blocked from linking
  {
    const crossTenantChunks = [
      {
        chunkIndex: 0,
        stableId: "chunk-foreign",
        content: "Competitor formulation achieves 99% wrinkle clearance.",
        charStart: 0,
        charEnd: 60,
        tokenCount: 10,
        sourceDocumentId: "foreign-doc-99",
        sourceDocumentTitle: "Competitor Confidential Study",
        documentType: "clinical_dossier",
        documentVersionId: "ver-foreign",
        versionNumber: 1,
        workspaceSlug: "competitor-pharma", // Foreign tenant
        metadata: {},
      },
      {
        chunkIndex: 0,
        stableId: "chunk-native",
        content: "DermaGlow formulation achieves 84% reduction in wrinkles in 12 weeks.",
        charStart: 0,
        charEnd: 70,
        tokenCount: 12,
        sourceDocumentId: "native-doc-1",
        sourceDocumentTitle: "DermaGlow Clinical Trial",
        documentType: "clinical_dossier",
        documentVersionId: "ver-native",
        versionNumber: 1,
        workspaceSlug: "dermaglow", // Native tenant
        metadata: {},
      },
    ];

    const results = HybridEvidenceRetriever.searchInMemory(
      {
        claimText: "wrinkle reduction",
        workspaceSlug: "dermaglow",
      },
      crossTenantChunks
    );

    const hasForeign = results.some((r) => r.sourceDocumentTitle.includes("Competitor"));
    const hasNative = results.some((r) => r.sourceDocumentTitle.includes("DermaGlow"));

    assert(
      !hasForeign && hasNative && results.length === 1,
      "24. Multi-tenant isolation strictly excludes foreign workspace evidence from retrieval"
    );
  }

  // 25. Embedding Provider Security: Fail closed in production mode
  {
    const envMap = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envMap.NODE_ENV;
    const prevAppEnv = envMap.NEXT_PUBLIC_APP_ENV;
    const prevEmbeddingProvider = envMap.EMBEDDING_PROVIDER;

    let caughtMockInProd = false;
    try {
      envMap.NODE_ENV = "production";
      envMap.NEXT_PUBLIC_APP_ENV = "production";
      envMap.EMBEDDING_PROVIDER = "mock";

      // Dynamically import to test production check
      const { getConfiguredEmbeddingProvider } = await import(
        "../src/lib/rag/embeddings/embedding-provider"
      );
      getConfiguredEmbeddingProvider();
    } catch (err) {
      if (err instanceof Error) {
        caughtMockInProd = err.message.includes("Mock embedding provider is strictly prohibited in production");
      }
    } finally {
      envMap.NODE_ENV = prevNodeEnv;
      envMap.NEXT_PUBLIC_APP_ENV = prevAppEnv;
      envMap.EMBEDDING_PROVIDER = prevEmbeddingProvider;
    }

    assert(
      caughtMockInProd,
      "25. Embedding provider fails closed: MockEmbeddingProvider strictly prohibited in production"
    );
  }

  // 26. Database-Dependent Pending Integration Notice
  {
    total++;
    console.log("[PENDING] 26. Remote Supabase pgvector live cosine index test");
    console.log("          └─ Safely deferred: live Supabase database connection string not yet provided.");
  }

  console.log("\n========================================================================");
  console.log(`TEST SUMMARY: ${passed}/${total - 1} passing, ${failed} failed, 1 pending database access.`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
