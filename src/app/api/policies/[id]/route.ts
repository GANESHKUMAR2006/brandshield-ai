import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/auth/server-session";
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
    const message = error instanceof Error ? error.message : "Failed to fetch policy";
    const status = message.includes("not found") ? 404 : message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
