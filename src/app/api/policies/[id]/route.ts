import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await props.params;

    const policy = await PolicyService.getPolicyById(session, id);
    return NextResponse.json({ data: policy });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch policy";
    const status = message.includes("not found") ? 404 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await props.params;
    const body = await request.json();

    const updated = await PolicyService.updateDraftPolicy(session, id, {
      name: body.name,
      description: body.description,
      category: body.category,
      severity: body.severity,
      productId: body.productId,
      rules: body.rules,
      validFrom: body.validFrom,
      validUntil: body.validUntil,
    });

    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to update policy";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
