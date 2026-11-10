/**
 * BrandShield AI — Verification Context Loader
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Retrieves the full context from Supabase PostgreSQL (submission, product,
 * approved facts, promotions, and current source documents) required for deterministic evaluation.
 */

import { query } from "@/lib/db/server-db";
import {
  ContextApprovedFact,
  ContextProduct,
  ContextPromotion,
  ContextSourceDocument,
  VerificationContext,
} from "./types";

export class VerificationContextLoader {
  public static async loadContextForClaim(
    claimId: string,
    workspaceContext?: { workspaceId?: string; workspaceSlug?: string }
  ): Promise<VerificationContext> {
    // 1. Fetch claim, submission, and submission version
    const claimRes = await query<{
      claim_id: string;
      claim_text: string;
      claim_type: string;
      text_start: number | null;
      text_end: number | null;
      claim_product_id: string | null;
      extracted_entities: Record<string, unknown>;
      extraction_confidence: number;
      submission_id: string;
      submission_title: string;
      submission_channel: string;
      submission_product_id: string | null;
      submission_date: string;
      submission_created_at: string;
      workspace_id: string;
      version_id: string;
      version_number: number;
      version_content: string;
    }>(
      `SELECT 
        c.id as claim_id,
        c.claim_text,
        c.claim_type,
        c.text_start,
        c.text_end,
        c.product_id as claim_product_id,
        c.extracted_entities,
        c.extraction_confidence,
        s.id as submission_id,
        s.title as submission_title,
        s.channel as submission_channel,
        s.product_id as submission_product_id,
        s.submission_date,
        s.created_at as submission_created_at,
        s.workspace_id,
        sv.id as version_id,
        sv.version_number,
        sv.content as version_content
      FROM claims c
      JOIN submissions s ON c.submission_id = s.id
      JOIN submission_versions sv ON c.submission_version_id = sv.id
      JOIN workspaces w ON s.workspace_id = w.id
      WHERE c.id = $1 AND (
        ( ($2::text IS NOT NULL AND w.id::text = $2::text) OR ($3::text IS NOT NULL AND w.slug = $3::text) )
        OR ($2::text IS NULL AND $3::text IS NULL AND w.slug = 'dermaglow')
      )`,
      [claimId, workspaceContext?.workspaceId || null, workspaceContext?.workspaceSlug || null]
    );

    if (claimRes.rows.length === 0) {
      throw new Error(`Active claim "${claimId}" not found in authorized workspace.`);
    }

    const row = claimRes.rows[0];

    // 2. Resolve target product ID (claim-level override takes precedence over submission product)
    const targetProductId = row.claim_product_id || row.submission_product_id;

    let product: ContextProduct | null = null;
    let approvedFacts: ContextApprovedFact[] = [];
    let promotions: ContextPromotion[] = [];

    // 3. Load product catalog entry if associated
    if (targetProductId) {
      const prodRes = await query<ContextProduct>(
        `SELECT id, name, sku, reference_price, currency, status
         FROM products
         WHERE id = $1`,
        [targetProductId]
      );
      if (prodRes.rows.length > 0) {
        product = prodRes.rows[0];
      }

      // 4. Load approved facts for this product
      const factsRes = await query<ContextApprovedFact>(
        `SELECT id, product_id, fact_key, fact_value, fact_type, approval_status, 
                source_document_id, valid_from, valid_until
         FROM approved_facts
         WHERE product_id = $1 AND approval_status = 'approved'`,
        [targetProductId]
      );
      approvedFacts = factsRes.rows;

      // 5. Load promotions for this product
      const promoRes = await query<ContextPromotion>(
        `SELECT id, product_id, promotion_name, discount_type, discount_value, 
                resulting_price, currency, start_date, end_date, applicable_channels, terms, status
         FROM promotions
         WHERE product_id = $1`,
        [targetProductId]
      );
      promotions = promoRes.rows;
    }

    // 6. Load source documents with their current approved versions
    const docRes = await query<ContextSourceDocument>(
      `SELECT 
        sd.id,
        sd.title,
        sd.document_type,
        sd.current_version_id,
        dv.version_number as current_version_number,
        sd.approval_status,
        dv.valid_from,
        dv.valid_until
       FROM source_documents sd
       LEFT JOIN document_versions dv ON sd.current_version_id = dv.id
       WHERE sd.workspace_id = $1`,
      [row.workspace_id]
    );

    const effectiveDate = new Date(row.submission_date || row.submission_created_at || Date.now());

    return {
      claim: {
        id: row.claim_id,
        claim_text: row.claim_text,
        claim_type: row.claim_type,
        text_start: row.text_start,
        text_end: row.text_end,
        product_id: targetProductId,
        extracted_entities: row.extracted_entities || {},
        extraction_confidence: row.extraction_confidence,
      },
      submission: {
        id: row.submission_id,
        workspace_id: row.workspace_id,
        title: row.submission_title,
        channel: row.submission_channel,
        product_id: row.submission_product_id,
        submission_date: row.submission_date,
        created_at: row.submission_created_at,
      },
      submissionVersion: {
        id: row.version_id,
        version_number: row.version_number,
        content: row.version_content,
      },
      product,
      approvedFacts,
      promotions,
      sourceDocuments: docRes.rows,
      effectiveDate,
      channel: row.submission_channel,
    };
  }
}
