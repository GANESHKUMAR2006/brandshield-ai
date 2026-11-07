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
        { error: "Submission ID is required" },
        { status: 400 }
      );
    }

    const results = await VerificationEngine.verifySubmissionClaims(id);

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (err: unknown) {
    console.error("Verification route error:", err);
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
