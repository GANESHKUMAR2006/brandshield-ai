/**
 * BrandShield AI — Phase 7 & Phase 2: Evidence Intelligence and RAG Types
 */

export type SupportedDocumentFormat = "pdf" | "docx" | "txt" | "md" | "markdown";

export type EvidenceStance = "supporting" | "contradicting" | "inconclusive" | "contextual";

export type ExtractionMethod = "digital_text" | "ocr" | "hybrid_table" | "structured_fact";

export interface StructuredTableData {
  headers: string[];
  rows: string[][];
  rowCount: number;
  colCount: number;
  caption?: string;
}

export interface DocumentSection {
  heading?: string;
  pageNumber?: number;
  text: string;
  charStart: number;
  charEnd: number;
  extractionMethod?: ExtractionMethod;
  extractionConfidence?: number;
  tableData?: StructuredTableData;
}

export interface ParsedDocument {
  title: string;
  documentType: string;
  format: SupportedDocumentFormat;
  totalCharacters: number;
  totalPages?: number;
  sections: DocumentSection[];
  rawText: string;
  metadata: Record<string, unknown>;
  extractionMethod?: ExtractionMethod;
  extractionConfidence?: number;
  tables?: StructuredTableData[];
}

export interface DocumentChunk {
  id?: string;
  chunkIndex: number;
  stableId: string;
  content: string;
  charStart: number;
  charEnd: number;
  pageNumber?: number;
  sectionHeading?: string;
  tokenCount: number;
  embedding?: number[];
  extractionMethod?: ExtractionMethod;
  extractionConfidence?: number;
  tableData?: StructuredTableData;
  boundingBox?: number[];
  metadata: {
    sourceDocumentId?: string;
    documentVersionId?: string;
    format?: string;
    pageNumber?: number;
    sectionHeading?: string;
    tokenCount?: number;
    extractionMethod?: ExtractionMethod;
    extractionConfidence?: number;
    tableData?: StructuredTableData;
    [key: string]: unknown;
  };
}

export interface ChunkingOptions {
  targetChunkSize?: number; // Target characters per chunk (default 600)
  chunkOverlap?: number;    // Overlap characters between chunks (default 120)
  respectParagraphs?: boolean;
  respectHeadings?: boolean;
}

export interface EmbeddingProviderConfig {
  provider: "openai" | "mock";
  model: string;
  dimension: number;
}

export interface EvidenceRetrievalQuery {
  claimText: string;
  claimType?: string;
  workspaceSlug: string;
  productId?: string | null;
  effectiveDate?: Date;
  limit?: number;
  similarityThreshold?: number; // Minimum vector similarity (0.0 to 1.0)
  includeExpired?: boolean;
}

export interface RetrievedEvidenceItem {
  id: string; // chunk ID or evidence ID
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  documentType: string;
  documentVersionId: string;
  versionNumber: number;
  chunkId?: string;
  chunkIndex?: number;
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  charStart?: number;
  charEnd?: number;
  boundingBox?: number[];
  extractionMethod?: ExtractionMethod;
  extractionConfidence?: number;
  tableData?: StructuredTableData;
  relevanceScore: number; // 0.0 to 1.0
  vectorSimilarity?: number;
  keywordScore?: number;
  retrievalRationale: string;
  sourceValidity: {
    approvalStatus: string;
    validFrom: string;
    validUntil?: string | null;
    isCurrentlyValid: boolean;
    supersededAt?: string | null;
  };
  stance: EvidenceStance;
}

export interface ClaimEvidenceLinkingResult {
  claimId: string;
  submissionId: string;
  retrievedCount: number;
  linkedEvidence: RetrievedEvidenceItem[];
  snapshot: Record<string, unknown>;
  evaluatedAt: string;
}
