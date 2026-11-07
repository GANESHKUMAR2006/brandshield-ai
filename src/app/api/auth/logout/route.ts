import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      message: "Session terminated successfully",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error during sign out";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
