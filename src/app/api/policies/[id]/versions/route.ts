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

    const version = await PolicyService.createDraftVersion(session, id, {
      description: body.description,
      rules: body.rules || [],
      validFrom: body.validFrom,
      validUntil: body.validUntil,
    });

    return NextResponse.json({ data: version }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create policy draft version";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
