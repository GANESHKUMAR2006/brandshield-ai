/**
 * BrandShield AI — Evidence Intelligence & Linking Service
 * Phase 7: Evidence Intelligence and RAG
 *
 * Discovers relevant evidence for claims, persists chunk linkage and stance,
 * enforces multi-tenant workspace isolation at the application tier,
 * and builds immutable snapshot dossiers for audit trails.
 */

import { query, withTransaction } from "@/lib/db/server-db";
import { ServerSessionIdentity } from "@/lib/auth/server-session";
import {
  EvidenceRetrievalQuery,
  ClaimEvidenceLinkingResult,
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
                page_number
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
                item.pageNumber || null,
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
              session.userName,
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
        pageNumber: item.pageNumber,
        section: item.sectionHeading,
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
}
