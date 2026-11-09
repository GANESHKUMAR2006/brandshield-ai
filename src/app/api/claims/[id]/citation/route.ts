/**
 * BrandShield AI — Claim Citation API Route
 * Phase 2: Multimodal Verification & Document Citation Viewer
 *
 * GET /api/claims/[id]/citation
 * Returns exact citation coordinates (document ID, title, version, page number,
 * section, offsets, bounding box, stance, and page cache) for in-browser citation highlighting.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession, AuthenticationRequiredError } from "@/lib/auth/server-session";
import { EvidenceIntelligenceService } from "@/lib/rag/linking/evidence-intelligence-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await resolveServerSession();
    const { id } = await params;

    const citations = await EvidenceIntelligenceService.getClaimCitation(session, id);

    if (!citations || citations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No evidence citations linked to this claim yet. Run evidence discovery first.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      claimId: id,
      count: citations.length,
      citations,
      primaryCitation: citations[0],
    });
  } catch (err: unknown) {
    if (err instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: "Authentication required", details: err.message },
        { status: 401 }
      );
    }
    const message = err instanceof Error ? err.message : "Failed to load citation coordinates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
