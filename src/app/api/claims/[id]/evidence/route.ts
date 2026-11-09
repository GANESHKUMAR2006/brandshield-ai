/**
 * BrandShield AI — Claim Evidence Intelligence API Route
 * Phase 7 & Phase 2: Evidence Intelligence and RAG
 *
 * GET /api/claims/[id]/evidence - Fetches linked evidence with full citation & provenance metadata
 * POST /api/claims/[id]/evidence - Triggers hybrid retrieval and links discovered evidence
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";
import { resolveServerSession, AuthenticationRequiredError } from "@/lib/auth/server-session";
import { EvidenceIntelligenceService } from "@/lib/rag/linking/evidence-intelligence-service";

// GET /api/claims/[id]/evidence
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    const evidenceRes = await query<{
      id: string;
      claim_id: string;
      document_version_id: string | null;
      approved_fact_id: string | null;
      evidence_excerpt: string;
      relevance_score: number;
      evidence_type: string;
      created_at: string;
      stance?: string;
      retrieval_rationale?: string;
      section_reference?: string;
      page_number?: number;
      char_start?: number;
      char_end?: number;
      bounding_box?: unknown;
      extraction_method?: string;
      extraction_confidence?: number;
      source_document_id?: string;
      document_title?: string;
      version_number?: number;
      approval_status?: string;
      valid_from?: string;
      valid_until?: string | null;
      superseded_at?: string | null;
    }>(
      `SELECT 
        ce.id,
        ce.claim_id,
        ce.document_version_id,
        ce.approved_fact_id,
        ce.evidence_excerpt,
        ce.relevance_score,
        ce.evidence_type,
        ce.created_at,
        COALESCE(ce.stance, 'contextual') as stance,
        ce.retrieval_rationale,
        ce.section_reference,
        COALESCE(ce.page_number, 1) as page_number,
        ce.char_start,
        ce.char_end,
        ce.bounding_box,
        COALESCE(ce.extraction_method, 'digital_text') as extraction_method,
        COALESCE(ce.extraction_confidence, 1.0) as extraction_confidence,
        sd.id as source_document_id,
        sd.title as document_title,
        dv.version_number,
        dv.approval_status,
        dv.valid_from,
        dv.valid_until,
        dv.superseded_at
       FROM claim_evidence ce
       JOIN claims c ON ce.claim_id = c.id
       JOIN submissions s ON c.submission_id = s.id
       JOIN workspaces w ON s.workspace_id = w.id
       LEFT JOIN document_versions dv ON ce.document_version_id = dv.id
       LEFT JOIN source_documents sd ON dv.source_document_id = sd.id
       WHERE c.id = $1 AND w.slug = $2
       ORDER BY ce.relevance_score DESC`,
      [id, session.workspaceSlug]
    );

    return NextResponse.json({
      success: true,
      claimId: id,
      count: evidenceRes.rows.length,
      data: evidenceRes.rows,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch claim evidence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/claims/[id]/evidence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    let body: {
      similarityThreshold?: number;
      limit?: number;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable; defaults will be applied
    }

    const result = await EvidenceIntelligenceService.discoverAndLinkClaimEvidence(
      session,
      id,
      {
        similarityThreshold: body.similarityThreshold,
        limit: body.limit,
      }
    );

    return NextResponse.json({
      success: true,
      message: `Retrieved and linked ${result.retrievedCount} evidence items for claim "${id}".`,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Evidence linking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
