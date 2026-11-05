import { NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";

export async function GET() {
  try {
    // 1. Core metric counts from PostgreSQL
    const statsRes = await query(`
      SELECT 
        (SELECT COUNT(*)::int FROM products p JOIN workspaces w ON p.workspace_id = w.id WHERE w.slug = 'dermaglow') as total_products,
        (SELECT COUNT(*)::int FROM approved_facts af JOIN products p ON af.product_id = p.id JOIN workspaces w ON p.workspace_id = w.id WHERE w.slug = 'dermaglow') as approved_facts,
        (SELECT COUNT(*)::int FROM source_documents sd JOIN workspaces w ON sd.workspace_id = w.id WHERE w.slug = 'dermaglow') as source_documents,
        (SELECT COUNT(*)::int FROM submissions s JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow') as total_submissions,
        (SELECT COUNT(*)::int FROM submissions s JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow' AND s.status = 'draft') as draft_submissions,
        (SELECT COUNT(*)::int FROM submissions s JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow' AND s.status != 'draft') as submitted_content,
        (SELECT COUNT(*)::int FROM claims c JOIN submissions s ON c.submission_id = s.id JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow') as total_claims,
        (SELECT COUNT(*)::int FROM claims c JOIN submissions s ON c.submission_id = s.id JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow' AND c.verification_status = 'supported') as supported_claims,
        (SELECT COUNT(*)::int FROM claims c JOIN submissions s ON c.submission_id = s.id JOIN workspaces w ON s.workspace_id = w.id WHERE w.slug = 'dermaglow' AND c.verification_status IN ('needs_review', 'contradicted', 'outdated')) as review_claims;
    `);

    // 2. Recent Live Submissions
    const recentSubsRes = await query(`
      SELECT 
        s.id,
        s.title,
        s.channel,
        s.status,
        s.submitted_by,
        s.created_at,
        p.name as product_name,
        COUNT(DISTINCT c.id)::int as total_claims,
        COUNT(DISTINCT CASE WHEN c.verification_status = 'supported' THEN c.id END)::int as supported_claims,
        COUNT(DISTINCT CASE WHEN c.verification_status IN ('needs_review', 'contradicted', 'outdated') THEN c.id END)::int as review_required_claims
      FROM submissions s
      JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN claims c ON s.id = c.submission_id
      WHERE w.slug = 'dermaglow'
      GROUP BY s.id, p.name
      ORDER BY s.created_at DESC
      LIMIT 5;
    `);

    // 3. Recent Live Audit Events
    const recentAuditsRes = await query(`
      SELECT 
        id,
        actor_id,
        entity_type,
        entity_id,
        action,
        after_state,
        created_at
      FROM audit_events ae
      JOIN workspaces w ON ae.workspace_id = w.id
      WHERE w.slug = 'dermaglow'
      ORDER BY ae.created_at DESC
      LIMIT 5;
    `);

    return NextResponse.json({
      success: true,
      workspace: "DermaGlow",
      isLiveDatabase: true,
      stats: statsRes.rows[0],
      recentSubmissions: recentSubsRes.rows,
      recentAuditEvents: recentAuditsRes.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard metrics";
    return NextResponse.json(
      { success: false, error: "Database error loading dashboard stats", details: message },
      { status: 500 }
    );
  }
}
