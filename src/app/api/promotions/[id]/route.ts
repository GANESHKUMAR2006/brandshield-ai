import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

const updatePromotionSchema = z.object({
  promotionName: z.string().trim().min(2).max(200).optional(),
  discountType: z.enum(["fixed", "percentage", "bundle"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  resultingPrice: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(2).max(10).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val))).optional(),
  applicableChannels: z.array(z.string()).optional(),
  terms: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "expired", "scheduled", "cancelled"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await resolveServerSession(undefined, request);

    const promoRes = await query<{
      id: string;
      product_id: string;
      product_name: string;
      workspace_id: string;
      promotion_name: string;
      discount_type: string;
      discount_value: string;
      resulting_price: string;
      currency: string;
      start_date: string;
      end_date: string;
      applicable_channels: any;
      terms: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT pr.*, p.name as product_name, p.workspace_id
       FROM promotions pr
       JOIN products p ON pr.product_id = p.id
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE pr.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (promoRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Promotion not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const pr = promoRes.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        ...pr,
        discount_value: Number(pr.discount_value),
        resulting_price: Number(pr.resulting_price),
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
    const message = error instanceof Error ? error.message : "Failed to retrieve promotion";
    return NextResponse.json(
      { success: false, error: "Database error retrieving promotion", details: message },
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
        { success: false, error: "Forbidden: Viewer role lacks authorization to modify promotions." },
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

    const validated = updatePromotionSchema.safeParse(body);
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

    // Verify promotion exists and belongs to active workspace
    const existingRes = await query<{
      id: string;
      product_id: string;
      workspace_id: string;
      promotion_name: string;
    }>(
      `SELECT pr.id, pr.product_id, p.workspace_id, pr.promotion_name
       FROM promotions pr
       JOIN products p ON pr.product_id = p.id
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE pr.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Promotion not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const existing = existingRes.rows[0];
    const updates = validated.data;

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.promotionName !== undefined) {
      setClauses.push(`promotion_name = $${idx++}`);
      values.push(updates.promotionName);
    }
    if (updates.discountType !== undefined) {
      setClauses.push(`discount_type = $${idx++}`);
      values.push(updates.discountType);
    }
    if (updates.discountValue !== undefined) {
      setClauses.push(`discount_value = $${idx++}`);
      values.push(updates.discountValue);
    }
    if (updates.resultingPrice !== undefined) {
      setClauses.push(`resulting_price = $${idx++}`);
      values.push(updates.resultingPrice);
    }
    if (updates.currency !== undefined) {
      setClauses.push(`currency = $${idx++}`);
      values.push(updates.currency);
    }
    if (updates.startDate !== undefined) {
      setClauses.push(`start_date = $${idx++}`);
      values.push(updates.startDate);
    }
    if (updates.endDate !== undefined) {
      setClauses.push(`end_date = $${idx++}`);
      values.push(updates.endDate);
    }
    if (updates.applicableChannels !== undefined) {
      setClauses.push(`applicable_channels = $${idx++}`);
      values.push(JSON.stringify(updates.applicableChannels));
    }
    if (updates.terms !== undefined) {
      setClauses.push(`terms = $${idx++}`);
      values.push(updates.terms);
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

    values.push(id);

    const updateQuery = `
      UPDATE promotions
      SET ${setClauses.join(", ")}
      WHERE id = $${idx++}
      RETURNING *
    `;

    const updatedRes = await query(updateQuery, values);
    const updated = updatedRes.rows[0];

    // Audit event
    await AuditService.recordEvent({
      workspaceId: existing.workspace_id,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "promotion",
      entityId: id,
      action: "promotion_updated",
      afterState: updates,
    });

    return NextResponse.json({
      success: true,
      message: `Promotion "${updated.promotion_name}" updated successfully.`,
      data: {
        ...updated,
        discount_value: Number(updated.discount_value),
        resulting_price: Number(updated.resulting_price),
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
    const message = error instanceof Error ? error.message : "Failed to update promotion";
    return NextResponse.json(
      { success: false, error: "Database error updating promotion", details: message },
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

    if (session.role === "viewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Viewer role lacks authorization to delete promotions." },
        { status: 403 }
      );
    }

    // Verify promotion exists and belongs to active workspace
    const existingRes = await query<{
      id: string;
      workspace_id: string;
      promotion_name: string;
    }>(
      `SELECT pr.id, p.workspace_id, pr.promotion_name
       FROM promotions pr
       JOIN products p ON pr.product_id = p.id
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE pr.id = $1 AND w.slug = $2 LIMIT 1`,
      [id, session.workspaceSlug]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Promotion not found or unauthorized in workspace." },
        { status: 404 }
      );
    }

    const promo = existingRes.rows[0];

    await query("DELETE FROM promotions WHERE id = $1", [id]);

    // Audit event
    await AuditService.recordEvent({
      workspaceId: promo.workspace_id,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "promotion",
      entityId: id,
      action: "promotion_deleted",
      afterState: { id, promotion_name: promo.promotion_name, deleted: true },
    });

    return NextResponse.json({
      success: true,
      message: `Promotion "${promo.promotion_name}" deleted successfully.`,
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
    const message = error instanceof Error ? error.message : "Failed to delete promotion";
    return NextResponse.json(
      { success: false, error: "Database error deleting promotion", details: message },
      { status: 500 }
    );
  }
}
