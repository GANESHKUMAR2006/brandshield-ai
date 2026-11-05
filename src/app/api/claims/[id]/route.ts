import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const claimRes = await query(
      `SELECT 
        c.id,
        c.submission_id,
        c.submission_version_id,
        c.extraction_run_id,
        c.claim_text,
        c.claim_type,
        c.text_start,
        c.text_end,
        c.product_id,
        c.extracted_entities,
        c.extraction_confidence,
        c.verification_status,
        c.risk_level,
        c.verified_at,
        c.evidence_sufficiency,
        c.explanation,
        c.suggested_correction,
        c.is_active,
        c.created_at,
        c.updated_at,
        p.name as product_name,
        p.sku as product_sku,
        s.title as submission_title,
        s.channel as submission_channel,
        sv.version_number,
        sv.content as version_content,
        er.provider as extraction_provider,
        er.model_identifier as extraction_model,
        er.prompt_version as extraction_prompt_version,
        er.created_at as extraction_timestamp
      FROM claims c
      JOIN submissions s ON c.submission_id = s.id
      JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN submission_versions sv ON c.submission_version_id = sv.id
      LEFT JOIN extraction_runs er ON c.extraction_run_id = er.id
      WHERE c.id = $1 AND w.slug = 'dermaglow'`,
      [id]
    );

    if (claimRes.rows.length === 0) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const claim = claimRes.rows[0];

    // Fetch attached evidence records
    const evidenceRes = await query(
      `SELECT 
        ce.id,
        ce.approved_fact_id,
        ce.document_version_id,
        ce.evidence_excerpt,
        ce.relevance_score,
        ce.evidence_type,
        af.fact_key,
        sd.title as document_title
       FROM claim_evidence ce
       LEFT JOIN approved_facts af ON ce.approved_fact_id = af.id
       LEFT JOIN document_versions dv ON ce.document_version_id = dv.id
       LEFT JOIN source_documents sd ON dv.source_document_id = sd.id
       WHERE ce.claim_id = $1
       ORDER BY ce.created_at DESC`,
      [id]
    );

    // Fetch verification runs history
    const runsRes = await query(
      `SELECT id, engine_version, verification_status, risk_level, explanation, evidence_snapshot, created_at
       FROM verification_runs
       WHERE claim_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json(
      {
        data: {
          ...claim,
          evidence: evidenceRes.rows,
          verification_history: runsRes.rows,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch claim";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
