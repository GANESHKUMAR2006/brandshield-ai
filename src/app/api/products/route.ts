import { NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";

export async function GET() {
  try {
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
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', af.id,
              'fact_key', af.fact_key,
              'fact_value', af.fact_value,
              'fact_type', af.fact_type,
              'approval_status', af.approval_status,
              'valid_from', af.valid_from,
              'valid_until', af.valid_until
            )
          ) FILTER (WHERE af.id IS NOT NULL), '[]'::json
        ) as approved_facts
      FROM products p
      JOIN workspaces w ON p.workspace_id = w.id
      LEFT JOIN approved_facts af ON p.id = af.product_id
      WHERE w.slug = 'dermaglow'
      GROUP BY p.id
      ORDER BY p.name ASC;
    `);

    return NextResponse.json({
      success: true,
      workspace: "DermaGlow",
      data: productsRes.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve products";
    return NextResponse.json(
      { success: false, error: "Database error retrieving products", details: message },
      { status: 500 }
    );
  }
}
