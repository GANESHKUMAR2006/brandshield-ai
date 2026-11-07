import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  canReviewClaims,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { query, withTransaction } from "@/lib/db/server-db";
import { AuditService } from "@/lib/audit/audit-service";

export async function GET() {
  try {
    const session = await resolveServerSession();

    // 1. Fetch Source Documents with current version metadata
    const docsRes = await query(`
      SELECT 
        sd.id,
        sd.title,
        sd.document_type,
        sd.description,
        sd.approval_status,
        sd.created_at,
        sd.updated_at,
        sd.current_version_id,
        dv.version_number as current_version_number,
        dv.storage_path,
        dv.content_hash,
        dv.approval_date,
        dv.valid_from,
        dv.valid_until,
        (dv.valid_until IS NOT NULL AND dv.valid_until < now()) as is_expired,
        (dv.superseded_at IS NOT NULL OR dv.approval_status = 'superseded') as is_superseded
      FROM source_documents sd
      LEFT JOIN document_versions dv ON sd.current_version_id = dv.id
      JOIN workspaces w ON sd.workspace_id = w.id
      WHERE w.slug = $1
      ORDER BY sd.created_at DESC;
    `, [session.workspaceSlug]);

    // 2. Fetch All Document Versions
    const versionsRes = await query(`
      SELECT 
        dv.id,
        dv.source_document_id,
        dv.version_number,
        dv.storage_path,
        dv.content_hash,
        dv.approval_date,
        dv.valid_from,
        dv.valid_until,
        dv.superseded_at,
        dv.approval_status,
        dv.created_at,
        (dv.valid_until IS NOT NULL AND dv.valid_until < now()) as is_expired,
        (dv.superseded_at IS NOT NULL OR dv.approval_status = 'superseded') as is_superseded,
        (sd.current_version_id = dv.id) as is_current
      FROM document_versions dv
      JOIN source_documents sd ON dv.source_document_id = sd.id
      JOIN workspaces w ON sd.workspace_id = w.id
      WHERE w.slug = $1
      ORDER BY dv.source_document_id, dv.version_number DESC;
    `, [session.workspaceSlug]);

    // 3. Fetch Products
    const productsRes = await query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.description,
        p.category,
        p.reference_price,
        p.currency,
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.slug = $1
      ORDER BY p.name ASC;
    `, [session.workspaceSlug]);

    // 4. Fetch Approved Facts with associated product name
    const factsRes = await query(`
      SELECT 
        af.id,
        af.product_id,
        p.name as product_name,
        p.sku as product_sku,
        af.fact_key,
        af.fact_value,
        af.fact_type,
        af.approval_status,
        af.source_document_id,
        sd.title as source_document_title,
        af.valid_from,
        af.valid_until,
        (af.valid_until IS NOT NULL AND af.valid_until < now()) as is_expired,
        af.created_at
      FROM approved_facts af
      JOIN products p ON af.product_id = p.id
      JOIN workspaces w ON p.workspace_id = w.id
      LEFT JOIN source_documents sd ON af.source_document_id = sd.id
      WHERE w.slug = $1
      ORDER BY af.created_at ASC;
    `, [session.workspaceSlug]);

    // 5. Fetch Promotions
    const promotionsRes = await query(`
      SELECT 
        pr.id,
        pr.product_id,
        p.name as product_name,
        pr.promotion_name,
        pr.discount_type,
        pr.discount_value,
        pr.resulting_price,
        pr.currency,
        pr.start_date,
        pr.end_date,
        pr.applicable_channels,
        pr.terms,
        pr.status,
        (now() BETWEEN pr.start_date AND pr.end_date AND pr.status = 'active') as is_currently_active,
        pr.created_at
      FROM promotions pr
      JOIN products p ON pr.product_id = p.id
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.slug = $1
      ORDER BY pr.start_date DESC;
    `, [session.workspaceSlug]);

    return NextResponse.json({
      success: true,
      workspace: session.workspaceSlug,
      data: {
        documents: docsRes.rows,
        documentVersions: versionsRes.rows,
        products: productsRes.rows,
        approvedFacts: factsRes.rows,
        promotions: promotionsRes.rows,
      },
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
    const message = error instanceof Error ? error.message : "Failed to retrieve source library data";
    return NextResponse.json(
      { success: false, error: "Database error retrieving source library", details: message },
      { status: 500 }
    );
  }
}

// POST /api/sources - Manage source document lifecycle (upload, approve, reject, expire, supersede)
export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();

    if (!canReviewClaims(session.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Viewer role cannot modify source documents." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, documentId, title, documentType, description, versionId } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: "Action is required." }, { status: 400 });
    }

    const validActions = ["upload", "approve", "reject", "expire", "supersede"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: `Invalid action "${action}".` }, { status: 400 });
    }

    return await withTransaction(async (client) => {
      // 1. Upload new source document
      if (action === "upload") {
        if (!title || !documentType) {
          throw new Error("Title and documentType are required for source document upload.");
        }

        const wsRes = await client.query<{ id: string }>(
          `SELECT id FROM workspaces WHERE slug = $1`,
          [session.workspaceSlug]
        );
        const workspaceId = wsRes.rows[0]?.id;
        if (!workspaceId) throw new Error("Workspace not found.");

        const docRes = await client.query<{ id: string; title: string; document_type: string }>(
          `INSERT INTO source_documents (workspace_id, title, document_type, description, approval_status)
           VALUES ($1, $2, $3, $4, 'approved')
           RETURNING id, title, document_type`,
          [workspaceId, title, documentType, description || null]
        );
        const newDoc = docRes.rows[0];

        const verRes = await client.query<{ id: string; version_number: number }>(
          `INSERT INTO document_versions (source_document_id, version_number, approval_status, approval_date)
           VALUES ($1, 1, 'approved', now())
           RETURNING id, version_number`,
          [newDoc.id]
        );
        const newVer = verRes.rows[0];

        await client.query(
          `UPDATE source_documents SET current_version_id = $1 WHERE id = $2`,
          [newVer.id, newDoc.id]
        );

        // Append audit event
        await AuditService.recordEvent(
          {
            workspaceId,
            actorId: session.userName,
            actorRole: session.role,
            entityType: "source_document",
            entityId: newDoc.id,
            action: "document_uploaded",
            afterState: {
              document_id: newDoc.id,
              version_id: newVer.id,
              title: newDoc.title,
              document_type: newDoc.document_type,
            },
          },
          client
        );

        return NextResponse.json({
          success: true,
          message: `Source document "${newDoc.title}" uploaded successfully.`,
          data: { documentId: newDoc.id, versionId: newVer.id },
        });
      }

      // 2. Lifecycle transitions on existing document
      if (!documentId) {
        throw new Error("documentId is required for document lifecycle state changes.");
      }

      const existingDoc = await client.query<{
        id: string;
        title: string;
        workspace_id: string;
        approval_status: string;
        current_version_id: string;
      }>(
        `SELECT sd.id, sd.title, sd.workspace_id, sd.approval_status, sd.current_version_id
         FROM source_documents sd
         JOIN workspaces w ON sd.workspace_id = w.id
         WHERE sd.id = $1 AND w.slug = $2`,
        [documentId, session.workspaceSlug]
      );

      if (existingDoc.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: `Document "${documentId}" not found or unauthorized in workspace.` },
          { status: 404 }
        );
      }

      const doc = existingDoc.rows[0];
      const targetVersionId = versionId || doc.current_version_id;
      let newApprovalStatus = doc.approval_status;
      let auditAction = `document_${action}`;

      if (action === "approve") {
        newApprovalStatus = "approved";
        await client.query(
          `UPDATE source_documents SET approval_status = 'approved', updated_at = now() WHERE id = $1`,
          [doc.id]
        );
        if (targetVersionId) {
          await client.query(
            `UPDATE document_versions SET approval_status = 'approved', approval_date = now() WHERE id = $1`,
            [targetVersionId]
          );
        }
      } else if (action === "reject") {
        newApprovalStatus = "rejected";
        await client.query(
          `UPDATE source_documents SET approval_status = 'rejected', updated_at = now() WHERE id = $1`,
          [doc.id]
        );
        if (targetVersionId) {
          await client.query(
            `UPDATE document_versions SET approval_status = 'rejected' WHERE id = $1`,
            [targetVersionId]
          );
        }
      } else if (action === "supersede") {
        newApprovalStatus = "superseded";
        await client.query(
          `UPDATE source_documents SET approval_status = 'superseded', updated_at = now() WHERE id = $1`,
          [doc.id]
        );
        if (targetVersionId) {
          await client.query(
            `UPDATE document_versions SET approval_status = 'superseded', superseded_at = now() WHERE id = $1`,
            [targetVersionId]
          );
        }
      } else if (action === "expire") {
        auditAction = "document_expired";
        if (targetVersionId) {
          await client.query(
            `UPDATE document_versions SET valid_until = now() WHERE id = $1`,
            [targetVersionId]
          );
        }
      }

      // Log append-only audit event
      await AuditService.recordEvent(
        {
          workspaceId: doc.workspace_id,
          actorId: session.userName,
          actorRole: session.role,
          entityType: "source_document",
          entityId: doc.id,
          action: auditAction,
          beforeState: {
            approval_status: doc.approval_status,
          },
          afterState: {
            approval_status: newApprovalStatus,
            version_id: targetVersionId,
            action,
            updated_by: session.userName,
          },
        },
        client
      );

      return NextResponse.json({
        success: true,
        message: `Document action "${action}" executed successfully.`,
        data: {
          documentId: doc.id,
          versionId: targetVersionId,
          approvalStatus: newApprovalStatus,
        },
      });
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json({ success: false, error: "Authentication required", details: err.message }, { status: 401 });
    }
    if (err instanceof WorkspaceAccessError || err instanceof UnauthorizedRoleError) {
      return NextResponse.json({ success: false, error: "Forbidden", details: err.message }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to execute source document action";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
