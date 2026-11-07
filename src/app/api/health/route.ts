import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabase/database.types";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/ai/extraction/extraction-prompt";

export interface ComprehensiveHealthResponse {
  status: "ok" | "degraded" | "error";
  application: {
    name: string;
    version: string;
    environment: string;
    timestamp: string;
  };
  services: {
    database: {
      name: string;
      status: "connected" | "disconnected" | "unconfigured";
      latencyMs?: number;
      workspace: string;
      error?: string;
    };
    ollama: {
      name: string;
      status: "connected" | "disconnected" | "unconfigured";
      model: string;
      modelInstalled?: boolean;
      availableModels?: string[];
      latencyMs?: number;
      endpoint: string;
      recoveryHint?: string;
      error?: string;
    };
    verificationEngine: {
      name: string;
      status: "operational" | "degraded";
      promptVersion: string;
      deterministicOffsetCorrection: "active";
      rulesCount: number;
    };
  };
}

export async function GET(): Promise<NextResponse<ComprehensiveHealthResponse>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Supabase Database Check
  let dbStatus: "connected" | "disconnected" | "unconfigured" = "unconfigured";
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  if (supabaseUrl && supabaseKey) {
    const dbStart = Date.now();
    try {
      const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      const { error } = await supabase
        .from("workspaces")
        .select("id, name, slug")
        .eq("slug", "dermaglow")
        .limit(1)
        .maybeSingle();

      if (!error) {
        dbStatus = "connected";
        dbLatencyMs = Date.now() - dbStart;
      } else {
        dbStatus = "disconnected";
        dbError = error.message;
      }
    } catch (err: unknown) {
      dbStatus = "disconnected";
      dbError = err instanceof Error ? err.message : "Database connection failed";
    }
  }

  // Active LLM Provider Check
  const activeLlmProvider = (process.env.LLM_PROVIDER || "groq").trim().toLowerCase();
  const isGroqActive = activeLlmProvider === "groq";
  const isGroqConfigured = Boolean(
    process.env.GROQ_API_KEY &&
    !process.env.GROQ_API_KEY.includes("placeholder")
  );

  // 2. LLM Provider Check
  const rawOllamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const ollamaHost = rawOllamaBase.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  const targetModel = isGroqActive
    ? process.env.GROQ_MODEL || "openai/gpt-oss-20b"
    : process.env.OLLAMA_MODEL || "qwen3:4b";

  let ollamaStatus: "connected" | "disconnected" | "unconfigured" = isGroqActive
    ? (isGroqConfigured ? "connected" : "disconnected")
    : "disconnected";
  let ollamaLatencyMs: number | undefined;
  let modelInstalled = isGroqActive ? isGroqConfigured : false;
  let availableModels: string[] = isGroqActive ? [targetModel] : [];
  let ollamaError: string | undefined = isGroqActive && !isGroqConfigured ? "GROQ_API_KEY is not configured" : undefined;
  let recoveryHint: string | undefined = isGroqActive && !isGroqConfigured ? "Configure GROQ_API_KEY in server environment." : undefined;

  if (!isGroqActive) {
    const ollamaStart = Date.now();
    try {
      const res = await fetch(`${ollamaHost}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(3000), // 3s fast timeout
        headers: { "User-Agent": "BrandShield-AI-Health/1.0" },
      });

      if (res.ok) {
        const json = await res.json();
        ollamaLatencyMs = Date.now() - ollamaStart;
        ollamaStatus = "connected";

        if (json.models && Array.isArray(json.models)) {
          availableModels = json.models.map((m: { name?: string }) => m.name || "").filter(Boolean);
          modelInstalled = availableModels.some((m) =>
            m.toLowerCase().includes(targetModel.toLowerCase())
          );
        }

        if (!modelInstalled) {
          recoveryHint = `Target model "${targetModel}" is not pulled. Run "ollama pull ${targetModel}" in terminal.`;
        }
      } else {
        ollamaStatus = "disconnected";
        ollamaError = `HTTP ${res.status}: ${res.statusText}`;
        recoveryHint = `Ollama server responded with error. Ensure Ollama service is healthy at ${ollamaHost}.`;
      }
    } catch (err: unknown) {
      ollamaStatus = "disconnected";
      ollamaError = err instanceof Error ? err.message : "Connection failed";
      recoveryHint = `Ollama server unreachable at ${ollamaHost}. Start the service with "ollama serve" or run "ollama run ${targetModel}".`;
    }
  }

  // 3. Verification Engine Check
  const engineStatus: "operational" | "degraded" =
    dbStatus === "connected" ? "operational" : "degraded";

  const activeLlmStatus = isGroqActive
    ? (isGroqConfigured ? "connected" : "disconnected")
    : (ollamaStatus === "connected" && modelInstalled ? "connected" : "disconnected");

  // Overall status evaluation
  const overallStatus: "ok" | "degraded" | "error" =
    dbStatus === "connected" && activeLlmStatus === "connected"
      ? "ok"
      : dbStatus === "connected"
      ? "degraded"
      : "error";

  const payload: ComprehensiveHealthResponse = {
    status: overallStatus,
    application: {
      name: "BrandShield AI",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    },
    services: {
      database: {
        name: "Supabase PostgreSQL 17",
        status: dbStatus,
        workspace: "dermaglow",
        ...(dbLatencyMs !== undefined ? { latencyMs: dbLatencyMs } : {}),
        ...(dbError ? { error: dbError } : {}),
      },
      ollama: {
        name: "Ollama Local LLM",
        status: ollamaStatus,
        model: targetModel,
        modelInstalled,
        availableModels: availableModels.slice(0, 5),
        endpoint: ollamaHost,
        ...(ollamaLatencyMs !== undefined ? { latencyMs: ollamaLatencyMs } : {}),
        ...(recoveryHint ? { recoveryHint } : {}),
        ...(ollamaError ? { error: ollamaError } : {}),
      },
      verificationEngine: {
        name: "Deterministic Rules Engine",
        status: engineStatus,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        deterministicOffsetCorrection: "active",
        rulesCount: 14,
      },
    },
  };

  return NextResponse.json(payload, {
    status: overallStatus === "error" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
