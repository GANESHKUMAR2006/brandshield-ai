import { NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";

export async function GET() {
  try {
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
      WHERE w.slug = 'dermaglow'
      ORDER BY sd.created_at DESC;
    `);

    // 2. Fetch All Document Versions (for version inspection interface)
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
      WHERE w.slug = 'dermaglow'
      ORDER BY dv.source_document_id, dv.version_number DESC;
    `);

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
      WHERE w.slug = 'dermaglow'
      ORDER BY p.name ASC;
    `);

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
      WHERE w.slug = 'dermaglow'
      ORDER BY af.created_at ASC;
    `);

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
      WHERE w.slug = 'dermaglow'
      ORDER BY pr.start_date DESC;
    `);

    return NextResponse.json({
      success: true,
      workspace: "DermaGlow",
      data: {
        documents: docsRes.rows,
        documentVersions: versionsRes.rows,
        products: productsRes.rows,
        approvedFacts: factsRes.rows,
        promotions: promotionsRes.rows,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve source library data";
    return NextResponse.json(
      { success: false, error: "Database error retrieving source library", details: message },
      { status: 500 }
    );
  }
}
