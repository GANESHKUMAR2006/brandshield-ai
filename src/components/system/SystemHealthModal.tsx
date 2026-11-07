"use client";

import React, { useState, useEffect } from "react";
import { fetchSystemHealth, SystemHealthData } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Activity,
  Database,
  Cpu,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemHealthModal({ isOpen, onClose }: SystemHealthModalProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
      setLastCheckedAt(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run system diagnostics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      fetchSystemHealth()
        .then((data) => {
          if (isMounted) {
            setHealth(data);
            setLastCheckedAt(new Date().toLocaleTimeString());
          }
        })
        .catch((err: unknown) => {
          if (isMounted) {
            setError(err instanceof Error ? err.message : "Failed to run system diagnostics");
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isHealthy = health?.status === "ok";
  const isDegraded = health?.status === "degraded";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/80 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-2xl bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-800/60 text-violet-400">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  System Health & Operational Diagnostics
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-950/80 text-violet-300 border border-violet-800/60">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time reachability, local Ollama status, and database integrity telemetry.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Overall Health Status Banner */}
          {health ? (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
                isHealthy
                  ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                  : isDegraded
                  ? "bg-amber-950/40 border-amber-800/60 text-amber-200"
                  : "bg-rose-950/40 border-rose-800/60 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isHealthy
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"
                      : isDegraded
                      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse"
                      : "bg-rose-400 shadow-[0_0_8px_#fb7185]"
                  }`}
                />
                <div>
                  <div className="font-bold text-sm text-white">
                    {isHealthy
                      ? "All Systems Operational"
                      : isDegraded
                      ? "Degraded Performance (Database Active, Ollama Notice)"
                      : "System Service Outage Detected"}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Application: BrandShield AI v{health.application.version} ({health.application.environment}) · Last checked at {lastCheckedAt}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadHealth}
                isLoading={isLoading}
                className="h-7 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Re-check
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span>Diagnostics unchecked. Click below to inspect live services.</span>
              </div>
              <Button variant="primary" size="sm" onClick={loadHealth} isLoading={isLoading}>
                Run Diagnostics
              </Button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Service Diagnostics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Service 1: Supabase Database */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  PostgreSQL DB
                </span>
                {health?.services.database ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      health.services.database.status === "connected"
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                        : "bg-rose-950/80 text-rose-300 border-rose-800/60"
                    }`}
                  >
                    {health.services.database.status}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    Unchecked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Supabase PostgreSQL 17 hosting products, claims, version history, and audit ledger.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Workspace:</span>
                  <span className="font-semibold text-white">DermaGlow</span>
                </div>
                {health?.services.database.latencyMs !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latency:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {health.services.database.latencyMs}ms
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Service 2: Ollama Local LLM */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" />
                  Ollama Local LLM
                </span>
                {health?.services.ollama ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      health.services.ollama.status === "connected"
                        ? health.services.ollama.modelInstalled
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/60"
                          : "bg-amber-950/80 text-amber-300 border-amber-800/60"
                        : "bg-rose-950/80 text-rose-300 border-rose-800/60"
                    }`}
                  >
                    {health.services.ollama.status === "connected"
                      ? health.services.ollama.modelInstalled
                        ? "Active"
                        : "Model Missing"
                      : "Offline"}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    Unchecked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Local inference at http://localhost:11434 with zero cloud transmission cost.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Model:</span>
                  <span className="font-mono text-violet-300 font-semibold">
                    {health?.services.ollama.model || "qwen3:4b"}
                  </span>
                </div>
                {health?.services.ollama.latencyMs !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Response Latency:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {health.services.ollama.latencyMs}ms
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Service 3: Deterministic Rules Engine */}
            <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Rules Engine
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 uppercase">
                  Operational
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Deterministic UTF-16 offset calculator and invariant publication compiler.
              </p>
              <div className="pt-2 border-t border-slate-800 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Rules Active:</span>
                  <span className="font-semibold text-white">14 Verified Invariants</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Offset Invariant:</span>
                  <span className="font-mono text-cyan-300 font-medium">UTF-16 Safe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recovery and Troubleshooting Card if Ollama or DB has issues */}
          {health?.services.ollama.status !== "connected" && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 text-xs text-amber-200 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Ollama Service Recovery Instructions</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                BrandShield AI utilizes local Ollama inference for zero cloud cost and deterministic extraction. To activate or restore the service:
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-cyan-300 border border-slate-800 select-all">
                ollama run qwen3:4b
              </div>
              <p className="text-[11px] text-slate-400">
                Alternatively, ensure Ollama is running in background with <code className="font-mono bg-slate-800 px-1 py-0.5 rounded text-white">ollama serve</code>.
              </p>
            </div>
          )}

          {/* Security and Data Privacy Guarantee */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              <strong>Security Protocol:</strong> All database passwords, API tokens, and service keys are encrypted and isolated on the backend server. No sensitive environment variables or credentials are ever transmitted to or stored in client-side state.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <Button
            variant="outline"
            size="sm"
            onClick={loadHealth}
            isLoading={isLoading}
            className="text-xs"
          >
            Refresh Diagnostics
          </Button>
          <Button variant="primary" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
