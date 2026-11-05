import { NextRequest, NextResponse } from "next/server";
import { VerificationEngine } from "@/lib/verification/verification-engine";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Claim ID is required" },
        { status: 400 }
      );
    }

    const result = await VerificationEngine.verifyClaim(id);

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal verification error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}
