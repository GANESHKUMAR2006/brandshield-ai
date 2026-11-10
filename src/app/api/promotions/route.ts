import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db/server-db";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
} from "@/lib/auth/server-session";
import { AuditService } from "@/lib/audit/audit-service";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const createPromotionSchema = z
  .object({
    productId: z.string().regex(uuidRegex, "Valid product ID is required"),
    promotionName: z.string().trim().min(2, "Promotion name must be at least 2 characters").max(200),
    discountType: z.enum(["fixed", "percentage", "bundle"]),
    discountValue: z.coerce.number().min(0, "Discount value must be non-negative"),
    resultingPrice: z.coerce.number().min(0, "Resulting price must be non-negative").optional(),
    currency: z.string().trim().min(2).max(10).default("INR"),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Valid start date ISO string required",
    }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Valid end date ISO string required",
    }),
    applicableChannels: z.array(z.string()).default(["all"]),
    terms: z.string().trim().max(1000).optional().nullable(),
    status: z.enum(["active", "expired", "scheduled", "cancelled"]).default("active"),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    {
      message: "Start date must be earlier than or equal to end date",
      path: ["startDate"],
    }
  );

export async function GET(request?: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    const promotionsRes = await query(`
      SELECT 
        pr.id,
        pr.product_id,
        p.name as product_name,
        p.sku as product_sku,
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
      data: promotionsRes.rows,
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
    const message = error instanceof Error ? error.message : "Failed to retrieve promotions";
    return NextResponse.json(
      { success: false, error: "Database error retrieving promotions", details: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession(undefined, request);

    // RBAC: Viewers cannot create promotions
    if (session.role === "viewer") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Viewer role lacks authorization to create promotions." },
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

    const validated = createPromotionSchema.safeParse(body);
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

    const {
      productId,
      promotionName,
      discountType,
      discountValue,
      resultingPrice,
      currency,
      startDate,
      endDate,
      applicableChannels,
      terms,
      status,
    } = validated.data;

    // Tenant isolation verification: Verify product belongs to caller's workspace
    const prodRes = await query<{ id: string; workspace_id: string; name: string; reference_price: string }>(
      `SELECT p.id, p.workspace_id, p.name, p.reference_price 
       FROM products p
       JOIN workspaces w ON p.workspace_id = w.id
       WHERE p.id = $1 AND w.slug = $2 LIMIT 1`,
      [productId, session.workspaceSlug]
    );

    if (prodRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Product not found or unauthorized in current workspace." },
        { status: 404 }
      );
    }

    const product = prodRes.rows[0];

    // Auto-calculate resulting price from product reference price if omitted
    let finalResultingPrice = resultingPrice;
    if (finalResultingPrice === undefined) {
      const basePrice = Number(product.reference_price);
      if (discountType === "percentage") {
        finalResultingPrice = Math.max(0, basePrice - (basePrice * discountValue) / 100);
      } else if (discountType === "fixed") {
        finalResultingPrice = Math.max(0, basePrice - discountValue);
      } else {
        finalResultingPrice = basePrice;
      }
    }

    // Insert new promotion
    const insertRes = await query<{
      id: string;
      product_id: string;
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
      `INSERT INTO promotions (
        product_id, promotion_name, discount_type, discount_value, resulting_price,
        currency, start_date, end_date, applicable_channels, terms, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, product_id, promotion_name, discount_type, discount_value, resulting_price,
                currency, start_date, end_date, applicable_channels, terms, status, created_at`,
      [
        productId,
        promotionName,
        discountType,
        discountValue,
        finalResultingPrice,
        currency,
        startDate,
        endDate,
        JSON.stringify(applicableChannels),
        terms || null,
        status,
      ]
    );

    const promotion = insertRes.rows[0];

    // Audit event
    await AuditService.recordEvent({
      workspaceId: product.workspace_id,
      actorId: session.userId || session.userName,
      actorRole: session.role,
      entityType: "promotion",
      entityId: promotion.id,
      action: "promotion_created",
      afterState: {
        id: promotion.id,
        productId,
        productName: product.name,
        promotionName,
        discountType,
        discountValue,
        resultingPrice,
        startDate,
        endDate,
        status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Promotion "${promotion.promotion_name}" created successfully.`,
        data: {
          ...promotion,
          product_name: product.name,
          discount_value: Number(promotion.discount_value),
          resulting_price: Number(promotion.resulting_price),
        },
      },
      { status: 201 }
    );
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
    const message = error instanceof Error ? error.message : "Failed to create promotion";
    return NextResponse.json(
      { success: false, error: "Database error creating promotion", details: message },
      { status: 500 }
    );
  }
}
