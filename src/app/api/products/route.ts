import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";

export async function GET(request?: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

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
      WHERE w.slug = $1
      GROUP BY p.id
      ORDER BY p.name ASC;
    `, [session.workspaceSlug]);

    return NextResponse.json({
      success: true,
      workspace: session.workspaceSlug,
      data: productsRes.rows,
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
    const message = error instanceof Error ? error.message : "Failed to retrieve products";
    return NextResponse.json(
      { success: false, error: "Database error retrieving products", details: message },
      { status: 500 }
    );
  }
}
