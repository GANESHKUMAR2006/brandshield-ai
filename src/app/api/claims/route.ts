import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";

export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get("submissionId");
    const claimType = searchParams.get("claimType");
    const status = searchParams.get("status");
    const riskLevel = searchParams.get("riskLevel");
    const reviewStatus = searchParams.get("reviewStatus");
    const productId = searchParams.get("productId");
    const search = searchParams.get("search");
    const includeInactive = searchParams.get("includeInactive") === "true";

    let sql = `
      SELECT 
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
        c.review_status,
        c.assigned_reviewer,
        c.last_reviewed_at,
        c.review_notes,
        c.original_claim_id,
        c.is_active,
        c.created_at,
        c.updated_at,
        p.name as product_name,
        p.sku as product_sku,
        s.title as submission_title,
        sv.version_number,
        er.provider as extraction_provider,
        er.model_identifier as extraction_model,
        (SELECT count(*) FROM claim_evidence ce WHERE ce.claim_id = c.id) as evidence_count
      FROM claims c
      JOIN submissions s ON c.submission_id = s.id
      JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN submission_versions sv ON c.submission_version_id = sv.id
      LEFT JOIN extraction_runs er ON c.extraction_run_id = er.id
      WHERE w.slug = $1
    `;

    const params: unknown[] = [session.workspaceSlug];
    let paramIndex = 2;

    if (!includeInactive) {
      sql += ` AND c.is_active = true`;
    }

    if (submissionId) {
      sql += ` AND c.submission_id = $${paramIndex++}`;
      params.push(submissionId);
    }

    if (claimType && claimType !== "all") {
      sql += ` AND c.claim_type = $${paramIndex++}`;
      params.push(claimType);
    }

    if (status && status !== "all") {
      sql += ` AND c.verification_status = $${paramIndex++}`;
      params.push(status);
    }

    if (riskLevel && riskLevel !== "all") {
      sql += ` AND c.risk_level = $${paramIndex++}`;
      params.push(riskLevel);
    }

    if (reviewStatus && reviewStatus !== "all") {
      sql += ` AND c.review_status = $${paramIndex++}`;
      params.push(reviewStatus);
    }

    if (productId) {
      sql += ` AND c.product_id = $${paramIndex++}`;
      params.push(productId);
    }

    if (search && search.trim().length > 0) {
      sql += ` AND (c.claim_text ILIKE $${paramIndex++} OR s.title ILIKE $${paramIndex++})`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT 100`;

    const result = await query(sql, params);

    return NextResponse.json({ data: result.rows }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: err.message }, { status: 401 });
    }
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: "Forbidden", details: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to fetch claims";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
