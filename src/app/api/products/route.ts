import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(200),
  sku: z.string().trim().min(2, "SKU must be at least 2 characters").max(50),
  category: z.string().trim().min(2, "Category must be specified").max(100),
  reference_price: z.coerce.number().min(0, "Reference price must be non-negative"),
  currency: z.string().trim().min(2).max(10).default("INR"),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

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

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    // RBAC: Viewers cannot create products
    if (session.role === "viewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Viewer role lacks authorization to register products." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const validated = createProductSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { name, sku, category, reference_price, currency, description, status } = validated.data;

    // Resolve workspace ID from database
    const wsRes = await query<{ id: string }>(
      `SELECT id FROM workspaces WHERE slug = $1 LIMIT 1`,
      [session.workspaceSlug]
    );

    if (wsRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: `Workspace "${session.workspaceSlug}" not found.` },
        { status: 404 }
      );
    }

    const workspaceId = wsRes.rows[0].id;

    // Check SKU uniqueness
    const existingSku = await query<{ id: string }>(
      `SELECT id FROM products WHERE LOWER(sku) = LOWER($1) LIMIT 1`,
      [sku]
    );

    if (existingSku.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Product with SKU "${sku}" already exists. Please choose a unique SKU.` },
        { status: 409 }
      );
    }

    // Insert new product
    const insertRes = await query<{
      id: string;
      workspace_id: string;
      name: string;
      sku: string;
      description: string | null;
      category: string;
      reference_price: string;
      currency: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO products (
        workspace_id, name, sku, description, category, reference_price, currency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, workspace_id, name, sku, description, category, reference_price, currency, status, created_at, updated_at`,
      [workspaceId, name, sku, description || null, category, reference_price, currency, status]
    );

    const product = insertRes.rows[0];

    // Audit event
    await AuditService.recordEvent({
      workspaceId,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "product",
      entityId: product.id,
      action: "product_created",
      afterState: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        reference_price: product.reference_price,
        currency: product.currency,
        status: product.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Product "${product.name}" created successfully.`,
        data: {
          ...product,
          reference_price: Number(product.reference_price),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
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
    if (error?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "A unique constraint violation occurred. Check if the SKU already exists." },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create product";
    return NextResponse.json(
      { success: false, error: "Database error creating product", details: message },
      { status: 500 }
    );
  }
}
