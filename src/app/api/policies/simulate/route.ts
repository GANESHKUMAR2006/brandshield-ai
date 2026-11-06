import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/auth/server-session";
import { PolicyService } from "@/lib/policy/policy-service";

export async function POST(request: NextRequest) {
  try {
    const session = await resolveServerSession();
    const body = await request.json();

    if (!body.sampleClaims || !Array.isArray(body.sampleClaims) || body.sampleClaims.length === 0) {
      return NextResponse.json(
        { error: "Invalid simulation input: sampleClaims array is required and must contain at least 1 claim." },
        { status: 400 }
      );
    }

    const simulationResult = await PolicyService.simulatePolicy(session, {
      policyId: body.policyId,
      draftRules: body.draftRules,
      sampleClaims: body.sampleClaims,
      productId: body.productId,
      channel: body.channel,
    });

    return NextResponse.json({ data: simulationResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute policy simulation";
    const status = message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
