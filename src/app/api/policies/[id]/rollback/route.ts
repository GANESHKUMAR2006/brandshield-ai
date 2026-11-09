import { NextRequest, NextResponse } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  UnauthorizedRoleError,
} from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await props.params;
    const body = await request.json();

    const targetVersion = Number(body.targetVersionNumber);
    if (!targetVersion || isNaN(targetVersion)) {
      return NextResponse.json(
        { error: "Invalid rollback input: targetVersionNumber must be a positive integer." },
        { status: 400 }
      );
    }

    const updatedPolicy = await PolicyService.rollbackPolicyVersion(session, id, targetVersion);
    return NextResponse.json({ data: updatedPolicy });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json({ error: "Authentication required", details: error.message }, { status: 401 });
    }
    if (error instanceof WorkspaceAccessError || error instanceof UnauthorizedRoleError) {
      return NextResponse.json({ error: "Forbidden", details: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to rollback policy";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
