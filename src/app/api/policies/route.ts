import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function GET(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const productId = searchParams.get("productId") || undefined;
    const search = searchParams.get("search") || undefined;

    const policies = await PolicyService.getPolicies(session, {
      category,
      status,
      productId,
      search,
    });

    return NextResponse.json({
      data: policies,
      total: policies.length,
      workspaceSlug: session.workspaceSlug,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch policies";
    const status = message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    const body = await request.json();

    const policy = await PolicyService.createPolicy(session, {
      name: body.name,
      code: body.code,
      description: body.description,
      category: body.category,
      productId: body.productId,
      rules: body.rules,
      validFrom: body.validFrom,
    });

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to create policy";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
