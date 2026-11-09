import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    const body = await request.json();

    const validation = PolicyService.validatePolicyRules(body);
    return NextResponse.json({ data: validation });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
