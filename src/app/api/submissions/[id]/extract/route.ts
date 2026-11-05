import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ExtractionService } from "@/lib/ai/extraction/extraction-service";

const ExtractRequestSchema = z.object({
  versionId: z.string().uuid("Invalid version UUID").optional(),
  forceReextract: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
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

    let body: z.infer<typeof ExtractRequestSchema> = { forceReextract: false };
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const json = JSON.parse(text);
        const parseResult = ExtractRequestSchema.safeParse(json);
        if (!parseResult.success) {
          return NextResponse.json(
            {
              error: "Invalid request payload",
              details: parseResult.error.issues,
            },
            { status: 400 }
          );
        }
        body = parseResult.data;
      }
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON body" },
        { status: 400 }
      );
    }

    const result = await ExtractionService.extractFromSubmissionVersion(id, {
      versionId: body.versionId,
      forceReextract: body.forceReextract,
    });

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal extraction error";
    const status = message.includes("not found")
      ? 404
      : message.includes("validation failed") || message.includes("not configured")
      ? 400
      : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status }
    );
  }
}
