/**
 * BrandShield AI — Claim Evidence Intelligence API Route
 * Phase 7: Evidence Intelligence and RAG
 *
 * GET /api/claims/[id]/evidence - Fetches linked evidence with full provenance
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
      document_title?: string;
      version_number?: number;
      approval_status?: string;
      valid_from?: string;
      valid_until?: string | null;
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
        sd.title as document_title,
        dv.version_number,
        dv.approval_status,
        dv.valid_from,
        dv.valid_until
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

// POST /api/claims/[id]/evidence - Discover and link evidence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    let body: { similarityThreshold?: number; limit?: number } = {};
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      // Default to empty body if body parse fails
    }

    const result = await EvidenceIntelligenceService.discoverAndLinkClaimEvidence(
      session,
      id,
      body
    );

    return NextResponse.json({
      success: true,
      message: `Retrieved and linked ${result.retrievedCount} evidence item(s).`,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Evidence discovery failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

