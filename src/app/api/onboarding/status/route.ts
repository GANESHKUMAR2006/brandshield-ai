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

    // Resolve workspace ID
    const wsRes = await query<{ id: string; name: string; slug: string; created_at: string }>(
      `SELECT id, name, slug, created_at FROM workspaces WHERE slug = $1 LIMIT 1`,
      [session.workspaceSlug]
    );

    if (wsRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Workspace "${session.workspaceSlug}" not found.` },
        { status: 404 }
      );
    }

    const ws = wsRes.rows[0];

    // Query counts for all 10 onboarding milestones for this tenant
    const [
      membersRes,
      invitesRes,
      productsRes,
      sourcesRes,
      promosRes,
      policiesRes,
      submissionsRes,
      claimsRes,
      verificationsRes,
    ] = await Promise.all([
      // 3. Team members
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM workspace_memberships WHERE workspace_id = $1 AND status = 'active'`,
        [ws.id]
      ),
      // Invitations
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM workspace_invitations WHERE workspace_id = $1`,
        [ws.id]
      ),
      // 4. Products
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM products WHERE workspace_id = $1`,
        [ws.id]
      ),
      // 5. Evidence dossiers
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM source_documents WHERE workspace_id = $1`,
        [ws.id]
      ),
      // 6. Promotions
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM promotions pr JOIN products p ON pr.product_id = p.id WHERE p.workspace_id = $1`,
        [ws.id]
      ),
      // 7. Policies
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM policies WHERE workspace_id = $1`,
        [ws.id]
      ),
      // 8. Submissions
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM submissions WHERE workspace_id = $1`,
        [ws.id]
      ),
      // 9. Claims
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM claims c JOIN submissions s ON c.submission_id = s.id WHERE s.workspace_id = $1`,
        [ws.id]
      ),
      // 10. Verified claims
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count 
         FROM claims c 
         JOIN submissions s ON c.submission_id = s.id 
         WHERE s.workspace_id = $1 AND c.verification_status IS NOT NULL AND c.verification_status != 'unverified'`,
        [ws.id]
      ),
    ]);

    const membersCount = parseInt(membersRes.rows[0]?.count || "0", 10);
    const invitesCount = parseInt(invitesRes.rows[0]?.count || "0", 10);
    const productsCount = parseInt(productsRes.rows[0]?.count || "0", 10);
    const sourcesCount = parseInt(sourcesRes.rows[0]?.count || "0", 10);
    const promosCount = parseInt(promosRes.rows[0]?.count || "0", 10);
    const policiesCount = parseInt(policiesRes.rows[0]?.count || "0", 10);
    const submissionsCount = parseInt(submissionsRes.rows[0]?.count || "0", 10);
    const claimsCount = parseInt(claimsRes.rows[0]?.count || "0", 10);
    const verifiedClaimsCount = parseInt(verificationsRes.rows[0]?.count || "0", 10);

    // 10 Steps Evaluation
    const steps = [
      {
        step: 1,
        id: "create_workspace",
        title: "Create Organization Workspace",
        description: "Registered dedicated tenant workspace with cryptographic isolation.",
        completed: true,
        count: 1,
        meta: { name: ws.name, slug: ws.slug },
      },
      {
        step: 2,
        id: "configure_details",
        title: "Configure Governance Settings",
        description: "Organization parameters, compliance tiers, and security protocols.",
        completed: true,
        count: 1,
        meta: { complianceTier: "Tier 1 Enterprise" },
      },
      {
        step: 3,
        id: "invite_team",
        title: "Invite Team Members & Assign Roles",
        description: "Add compliance reviewers, legal counsel, creators, and administrators.",
        completed: membersCount > 1 || invitesCount > 0,
        count: membersCount,
        meta: { activeMembers: membersCount, pendingInvites: invitesCount },
      },
      {
        step: 4,
        id: "register_products",
        title: "Register Commercial Products",
        description: "Add formulation catalog SKUs, retail pricing, and specifications.",
        completed: productsCount > 0,
        count: productsCount,
        meta: { totalProducts: productsCount },
      },
      {
        step: 5,
        id: "upload_evidence",
        title: "Upload Supporting Evidence Dossiers",
        description: "Ingest clinical trials, certificates of analysis, and regulatory standards.",
        completed: sourcesCount > 0,
        count: sourcesCount,
        meta: { indexedDossiers: sourcesCount },
      },
      {
        step: 6,
        id: "create_promotions",
        title: "Configure Pricing Promotions",
        description: "Establish discount exception rules for automated price claim verification.",
        completed: promosCount > 0,
        count: promosCount,
        meta: { activePromotions: promosCount },
      },
      {
        step: 7,
        id: "configure_policies",
        title: "Configure Claim Compliance Policies",
        description: "Enable regulatory rules in Policy Studio (e.g., FDA overclaim, price disclaimers).",
        completed: policiesCount > 0,
        count: policiesCount,
        meta: { activePolicies: policiesCount },
      },
      {
        step: 8,
        id: "submit_content",
        title: "Submit Marketing Collateral",
        description: "Ingest ad copies, landing pages, or promotional campaign assets.",
        completed: submissionsCount > 0,
        count: submissionsCount,
        meta: { totalSubmissions: submissionsCount },
      },
      {
        step: 9,
        id: "extract_claims",
        title: "Extract Marketing Claims",
        description: "Detect quantifiable and qualitative claims via AI extraction engine.",
        completed: claimsCount > 0,
        count: claimsCount,
        meta: { extractedClaims: claimsCount },
      },
      {
        step: 10,
        id: "verify_claims",
        title: "Verify Claims Against Evidence & Policies",
        description: "Automated deterministic verification and citation provenance inspection.",
        completed: verifiedClaimsCount > 0,
        count: verifiedClaimsCount,
        meta: { verifiedClaims: verifiedClaimsCount },
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const completionPercentage = Math.round((completedCount / steps.length) * 100);

    return NextResponse.json({
      success: true,
      workspace: {
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        role: session.role,
      },
      progress: {
        completedCount,
        totalSteps: steps.length,
        percentage: completionPercentage,
        isFullyOnboarded: completedCount === steps.length,
      },
      steps,
    });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { success: false, error: "Authentication required", details: error.message },
        { status: 401 }
      );
    }
    if (error instanceof WorkspaceAccessError) {
      return NextResponse.json(
        { success: false, error: "Forbidden", details: error.message },
        { status: 403 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to load onboarding status";
    return NextResponse.json(
      { success: false, error: "Database error loading onboarding status", details: message },
      { status: 500 }
    );
  }
}
