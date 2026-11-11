import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { query } from "@/lib/db/server-db";
import { ComplianceAnalyticsService } from "@/lib/analytics/analytics-service";

export async function GET(request?: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    // 1. Fetch comprehensive compliance analytics
    const analytics = await ComplianceAnalyticsService.getWorkspaceAnalytics(session);

    // 2. Fetch actionable risk and operational insights
    const insights = await ComplianceAnalyticsService.getComplianceInsights(session);

    // 3. Recent Live Submissions within workspace
    let recentSubmissions: Array<Record<string, unknown>> = [];
    try {
      const recentSubsRes = await query(`
        SELECT 
          s.id,
          s.title,
          s.channel,
          s.status,
          s.publication_status,
          s.submitted_by,
          s.created_at,
          p.name as product_name,
          COUNT(DISTINCT c.id)::int as total_claims,
          COUNT(DISTINCT CASE WHEN c.is_active = true AND c.verification_status = 'supported' THEN c.id END)::int as supported_claims,
          COUNT(DISTINCT CASE WHEN c.is_active = true AND c.verification_status IN ('needs_review', 'contradicted', 'outdated', 'unverified') THEN c.id END)::int as review_required_claims
        FROM submissions s
        JOIN workspaces w ON s.workspace_id = w.id
        LEFT JOIN products p ON s.product_id = p.id
        LEFT JOIN claims c ON s.id = c.submission_id
        WHERE w.slug = $1
        GROUP BY s.id, p.name
        ORDER BY s.created_at DESC
        LIMIT 5;
      `, [session.workspaceSlug]);
      recentSubmissions = recentSubsRes.rows;
    } catch {
      recentSubmissions = [];
    }

    // 4. Recent Live Audit Events within workspace
    let recentAuditEvents: Array<Record<string, unknown>> = [];
    try {
      const recentAuditsRes = await query(`
        SELECT 
          ae.id,
          ae.actor_id,
          ae.entity_type,
          ae.entity_id,
          ae.action,
          ae.after_state,
          ae.created_at
        FROM audit_events ae
        JOIN workspaces w ON ae.workspace_id = w.id
        WHERE w.slug = $1
        ORDER BY ae.created_at DESC
        LIMIT 5;
      `, [session.workspaceSlug]);
      recentAuditEvents = recentAuditsRes.rows;
    } catch {
      recentAuditEvents = [];
    }

    // 5. Query live database counts for products and approved facts
    let totalProducts = 0;
    let approvedFacts = 0;
    try {
      const countsRes = await query<{
        total_products: number;
        approved_facts: number;
      }>(`
        SELECT 
          COUNT(DISTINCT p.id)::int as total_products,
          COUNT(DISTINCT af.id)::int as approved_facts
        FROM workspaces w
        LEFT JOIN products p ON p.workspace_id = w.id
        LEFT JOIN approved_facts af ON af.product_id = p.id AND af.approval_status = 'approved'
        WHERE w.slug = $1
      `, [session.workspaceSlug]);

      if (countsRes.rows.length > 0) {
        totalProducts = countsRes.rows[0].total_products;
        approvedFacts = countsRes.rows[0].approved_facts;
      }
    } catch {
      totalProducts = 0;
      approvedFacts = 0;
    }

    // Backwards-compatible legacy stats structure with live database counts
    const legacyStats = {
      total_products: totalProducts,
      approved_facts: approvedFacts,
      source_documents: analytics.sourceDocumentMetrics.totalApproved,
      total_submissions: analytics.totalSubmissions,
      draft_submissions: analytics.draftSubmissions,
      submitted_content: analytics.totalSubmissions - analytics.draftSubmissions,
      total_claims: analytics.totalExtractedClaims,
      supported_claims: analytics.claimsByVerificationStatus.supported,
      review_claims: analytics.claimsAwaitingReview,
    };

    return NextResponse.json({
      success: true,
      workspace: session.workspaceSlug,
      isLiveDatabase: true,
      stats: legacyStats,
      analytics,
      insights,
      recentSubmissions,
      recentAuditEvents,
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Authentication required", details: error.message },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json(
        { success: false, error: "Forbidden", details: error.message },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to load dashboard metrics";
    return NextResponse.json(
      { success: false, error: "Database error loading dashboard stats", details: message },
      { status: 500 }
    );
  }
}
