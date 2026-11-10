/**
 * BrandShield AI — Evidence Intelligence & Linking Service
 * Phase 7 & Phase 2: Evidence Intelligence and RAG
 *
 * Discovers relevant evidence for claims, persists chunk linkage, character offsets,
 * bounding boxes, stance, and extraction methods with strict multi-tenant workspace isolation.
 */

import { query, withTransaction } from "@/lib/db/server-db";
import { ServerSessionIdentity } from "@/lib/auth/server-session";
import {
  EvidenceRetrievalQuery,
  ClaimEvidenceLinkingResult,
  RetrievedEvidenceItem,
  ExtractionMethod,
} from "../types";
import { HybridEvidenceRetriever } from "../retrieval/hybrid-retriever";

export class EvidenceIntelligenceService {
  /**
   * Retrieves relevant source passages for a claim and records traceable evidence links.
   * Strictly enforces workspace boundaries to prevent cross-tenant evidence leakage.
   */
  public static async discoverAndLinkClaimEvidence(
    session: ServerSessionIdentity,
    claimId: string,
    options?: {
      similarityThreshold?: number;
      limit?: number;
    }
  ): Promise<ClaimEvidenceLinkingResult> {
    // 1. Fetch target claim details with workspace verification
    const claimRes = await query<{
      id: string;
      submission_id: string;
      submission_version_id: string;
      claim_text: string;
      claim_type: string;
      product_id: string | null;
      workspace_id: string;
    }>(
      `SELECT c.id, c.submission_id, c.submission_version_id, c.claim_text, c.claim_type, c.product_id, s.workspace_id
       FROM claims c
       JOIN submissions s ON c.submission_id = s.id
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE c.id = $1 AND w.slug = $2`,
      [claimId, session.workspaceSlug]
    );

    if (claimRes.rows.length === 0) {
      throw new Error(`Claim "${claimId}" not found or unauthorized in workspace.`);
    }

    const claim = claimRes.rows[0];

    // 2. Execute hybrid retrieval query
    const retrievalQuery: EvidenceRetrievalQuery = {
      claimText: claim.claim_text,
      claimType: claim.claim_type,
      workspaceSlug: session.workspaceSlug,
      productId: claim.product_id,
      similarityThreshold: options?.similarityThreshold || 0.45,
      limit: options?.limit || 5,
    };

    const retrievedItems = await HybridEvidenceRetriever.retrieveEvidence(retrievalQuery);

    // 3. Persist evidence links transactionally in PostgreSQL with tenant isolation verification
    if (retrievedItems.length > 0) {
      await withTransaction(async (client) => {
        let actuallyLinked = 0;

        for (const item of retrievedItems) {
          // Strictly verify that the source document version belongs to the SAME workspace
          const docTenantCheck = await client.query<{ id: string }>(
            `SELECT dv.id 
             FROM document_versions dv
             JOIN source_documents sd ON dv.source_document_id = sd.id
             WHERE dv.id = $1 AND sd.workspace_id = $2`,
            [item.documentVersionId, claim.workspace_id]
          );

          if (docTenantCheck.rows.length === 0) {
            // Reject cross-workspace document evidence insertion
            continue;
          }

          // Check if link already exists to avoid duplication
          const existing = await client.query(
            `SELECT id FROM claim_evidence 
             WHERE claim_id = $1 AND document_version_id = $2 AND evidence_excerpt = $3 LIMIT 1`,
            [claim.id, item.documentVersionId, item.content]
          );

          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO claim_evidence (
                claim_id,
                document_version_id,
                document_chunk_id,
                evidence_excerpt,
                relevance_score,
                evidence_type,
                stance,
                retrieval_rationale,
                section_reference,
                page_number,
                char_start,
                char_end,
                bounding_box,
                extraction_method,
                extraction_confidence
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
              [
                claim.id,
                item.documentVersionId,
                item.chunkId || null,
                item.content,
                item.relevanceScore,
                item.documentType,
                item.stance || "contextual",
                item.retrievalRationale || null,
                item.sectionHeading || null,
                item.pageNumber || 1,
                item.charStart || null,
                item.charEnd || null,
                item.boundingBox ? JSON.stringify(item.boundingBox) : null,
                item.extractionMethod || "digital_text",
                item.extractionConfidence || 1.0,
              ]
            );
            actuallyLinked++;
          }
        }

        // 4. Log append-only audit event if evidence was linked
        if (actuallyLinked > 0) {
          await client.query(
            `INSERT INTO audit_events (
              workspace_id,
              actor_id,
              entity_type,
              entity_id,
              action,
              after_state
            ) VALUES ($1, $2, 'claim', $3, 'claim_evidence_linked', $4)`,
            [
              claim.workspace_id,
              (session.userId || session.userName || 'system'),
              claim.id,
              JSON.stringify({
                claim_id: claim.id,
                linked_count: actuallyLinked,
                evidence_types: Array.from(new Set(retrievedItems.map((r) => r.documentType))),
                linked_by: session.userName,
              }),
            ]
          );
        }
      });
    }

    // 5. Build immutable evidence snapshot
    const snapshot = {
      claimId: claim.id,
      submissionId: claim.submission_id,
      submissionVersionId: claim.submission_version_id,
      queryText: claim.claim_text,
      claimType: claim.claim_type,
      retrievedCount: retrievedItems.length,
      evidence: retrievedItems.map((item) => ({
        documentId: item.sourceDocumentId,
        documentTitle: item.sourceDocumentTitle,
        versionId: item.documentVersionId,
        versionNumber: item.versionNumber,
        excerpt: item.content,
        relevanceScore: item.relevanceScore,
        rationale: item.retrievalRationale,
        stance: item.stance,
        pageNumber: item.pageNumber || 1,
        section: item.sectionHeading,
        charStart: item.charStart,
        charEnd: item.charEnd,
        extractionMethod: item.extractionMethod,
        extractionConfidence: item.extractionConfidence,
        tableData: item.tableData,
      })),
      evaluatedAt: new Date().toISOString(),
    };

    return {
      claimId: claim.id,
      submissionId: claim.submission_id,
      retrievedCount: retrievedItems.length,
      linkedEvidence: retrievedItems,
      snapshot,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches exact citation coordinates and in-document provenance for a claim.
   */
  public static async getClaimCitation(
    session: ServerSessionIdentity,
    claimId: string
  ) {
    const res = await query<{
      claim_id: string;
      claim_text: string;
      claim_type: string;
      verification_status: string;
      risk_level: string;
      evidence_id: string;
      evidence_excerpt: string;
      relevance_score: number;
      stance: string;
      page_number: number | null;
      section_reference: string | null;
      char_start: number | null;
      char_end: number | null;
      bounding_box: unknown;
      extraction_method: string | null;
      extraction_confidence: number | null;
      source_document_id: string;
      document_title: string;
      document_type: string;
      version_number: number;
      approval_status: string;
      valid_from: string;
      valid_until: string | null;
      superseded_at: string | null;
      extracted_pages: unknown;
    }>(
      `SELECT 
        c.id as claim_id,
        c.claim_text,
        c.claim_type,
        COALESCE(c.verification_status, 'unverified') as verification_status,
        COALESCE(c.risk_level, 'low') as risk_level,
        ce.id as evidence_id,
        ce.evidence_excerpt,
        ce.relevance_score,
        COALESCE(ce.stance, 'contextual') as stance,
        COALESCE(ce.page_number, 1) as page_number,
        ce.section_reference,
        ce.char_start,
        ce.char_end,
        ce.bounding_box,
        COALESCE(ce.extraction_method, 'digital_text') as extraction_method,
        COALESCE(ce.extraction_confidence, 1.0) as extraction_confidence,
        sd.id as source_document_id,
        sd.title as document_title,
        sd.document_type,
        dv.version_number,
        dv.approval_status,
        dv.valid_from,
        dv.valid_until,
        dv.superseded_at,
        dv.extracted_pages
       FROM claims c
       JOIN submissions s ON c.submission_id = s.id
       JOIN workspaces w ON s.workspace_id = w.id
       JOIN claim_evidence ce ON c.id = ce.claim_id
       LEFT JOIN document_versions dv ON ce.document_version_id = dv.id
       LEFT JOIN source_documents sd ON dv.source_document_id = sd.id
       WHERE c.id = $1 AND w.slug = $2
       ORDER BY ce.relevance_score DESC
       LIMIT 10`,
      [claimId, session.workspaceSlug]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const citations = res.rows.map((row) => ({
      evidenceId: row.evidence_id,
      claimId: row.claim_id,
      claimText: row.claim_text,
      claimType: row.claim_type,
      verificationStatus: row.verification_status,
      riskLevel: row.risk_level,
      sourceDocumentId: row.source_document_id,
      documentTitle: row.document_title || "Clinical Dossier",
      documentType: row.document_type || "clinical_protocol",
      versionNumber: row.version_number || 1,
      pageNumber: row.page_number || 1,
      sectionReference: row.section_reference || "Clinical Results",
      evidenceExcerpt: row.evidence_excerpt,
      stance: row.stance,
      relevanceScore: Number(row.relevance_score),
      charStart: row.char_start,
      charEnd: row.char_end,
      boundingBox: row.bounding_box,
      extractionMethod: (row.extraction_method as ExtractionMethod) || "digital_text",
      extractionConfidence: Number(row.extraction_confidence) || 1.0,
      sourceValidity: {
        approvalStatus: row.approval_status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        isCurrentlyValid: !row.superseded_at,
        supersededAt: row.superseded_at,
      },
      extractedPages: Array.isArray(row.extracted_pages) ? row.extracted_pages : [],
    }));

    return citations;
  }
}
