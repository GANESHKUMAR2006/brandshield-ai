import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await props.params;

    const archivedPolicy = await PolicyService.archivePolicy(session, id);
    return NextResponse.json({ data: archivedPolicy });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to archive policy";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
