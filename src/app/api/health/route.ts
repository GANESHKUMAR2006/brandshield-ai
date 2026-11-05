import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/database.types";

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  application: string;
  version: string;
  database: {
    status: "connected" | "disconnected" | "unconfigured";
    latencyMs?: number;
  };
  timestamp: string;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let dbStatus: "connected" | "disconnected" | "unconfigured" = "unconfigured";
  let latencyMs: number | undefined;

  if (url && key) {
    const start = Date.now();
    try {
      const supabase = createClient<Database>(url, key, {
        auth: { persistSession: false },
      });
      const { error } = await supabase
        .from("workspaces")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!error) {
        dbStatus = "connected";
        latencyMs = Date.now() - start;
      } else {
        dbStatus = "disconnected";
      }
    } catch {
      dbStatus = "disconnected";
    }
  }

  const overallStatus: "ok" | "degraded" =
    dbStatus === "connected" ? "ok" : "degraded";

  const payload: HealthResponse = {
    status: overallStatus,
    application: "BrandShield AI",
    version: "1.0.0",
    database: {
      status: dbStatus,
      ...(latencyMs !== undefined ? { latencyMs } : {}),
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    status: overallStatus === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
