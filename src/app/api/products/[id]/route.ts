import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

const updateProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(200).optional(),
  category: z.string().trim().min(2, "Category must be specified").max(100).optional(),
  reference_price: z.coerce.number().min(0, "Reference price must be non-negative").optional(),
  currency: z.string().trim().min(2).max(10).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession(undefined, request);

    const productRes = await query<{
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
      `SELECT p.id, p.workspace_id, p.name, p.sku, p.description, p.category, 
              p.reference_price, p.currency, p.status, p.created_at, p.updated_at
       FROM products p
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE p.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (productRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const p = productRes.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...p,
        reference_price: Number(p.reference_price),
      },
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
    const message = error instanceof Error ? error.message : "Failed to retrieve product";
    return NextResponse.json(
      { success: false, error: "Database error retrieving product", details: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession(undefined, request);

    if (session.role === "viewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Viewer role lacks authorization to modify products." },
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

    const validated = updateProductSchema.safeParse(body);
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

    // Verify product exists and belongs to active workspace
    const existingRes = await query<{ id: string; workspace_id: string; name: string }>(
      `SELECT p.id, p.workspace_id, p.name
       FROM products p
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE p.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const existingProduct = existingRes.rows[0];
    const updates = validated.data;

    // Dynamically build SET clause
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.reference_price !== undefined) {
      setClauses.push(`reference_price = $${idx++}`);
      values.push(updates.reference_price);
    }
    if (updates.currency !== undefined) {
      setClauses.push(`currency = $${idx++}`);
      values.push(updates.currency);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No update fields provided." },
        { status: 400 }
      );
    }

    setClauses.push(`updated_at = now()`);

    values.push(id);
    values.push(existingProduct.workspace_id);

    const updateQuery = `
      UPDATE products
      SET ${setClauses.join(", ")}
      WHERE id = $${idx++} AND workspace_id = $${idx++}
      RETURNING id, workspace_id, name, sku, description, category, reference_price, currency, status, created_at, updated_at
    `;

    const updatedRes = await query(updateQuery, values);
    const updated = updatedRes.rows[0];

    // Audit event
    await AuditService.recordEvent({
      workspaceId: existingProduct.workspace_id,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "product",
      entityId: id,
      action: "product_updated",
      afterState: updates,
    });

    return NextResponse.json({
      success: true,
      message: `Product "${updated.name}" updated successfully.`,
      data: {
        ...updated,
        reference_price: Number(updated.reference_price),
      },
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
    const message = error instanceof Error ? error.message : "Failed to update product";
    return NextResponse.json(
      { success: false, error: "Database error updating product", details: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession(undefined, request);

    if (session.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only workspace administrators can delete catalog products." },
        { status: 403 }
      );
    }

    // Verify product exists and belongs to active workspace
    const existingRes = await query<{ id: string; workspace_id: string; name: string }>(
      `SELECT p.id, p.workspace_id, p.name
       FROM products p
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE p.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const product = existingRes.rows[0];

    // Delete in transaction, detaching any direct submissions to prevent FK issues
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE submissions SET product_id = NULL WHERE product_id = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM products WHERE id = $1 AND workspace_id = $2`,
        [id, product.workspace_id]
      );
    });

    // Audit event
    await AuditService.recordEvent({
      workspaceId: product.workspace_id,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "product",
      entityId: id,
      action: "product_deleted",
      afterState: { id, name: product.name, deleted: true },
    });

    return NextResponse.json({
      success: true,
      message: `Product "${product.name}" deleted successfully.`,
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
    const message = error instanceof Error ? error.message : "Failed to delete product";
    return NextResponse.json(
      { success: false, error: "Database error deleting product", details: message },
      { status: 500 }
    );
  }
}
