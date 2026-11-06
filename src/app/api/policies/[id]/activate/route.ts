import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await props.params;
    const body = await request.json();

    if (!body.versionId) {
      return NextResponse.json({ error: "Missing required parameter: versionId" }, { status: 400 });
    }

    const updatedPolicy = await PolicyService.activatePolicyVersion(session, id, body.versionId);
    return NextResponse.json({ data: updatedPolicy });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to activate policy version";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
