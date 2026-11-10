"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Code2 } from "lucide-react";

interface AuditCodeViewerProps {
  data: Record<string, unknown> | null | undefined;
  title?: string;
  defaultExpanded?: boolean;
  beforeData?: Record<string, unknown> | null | undefined;
}

export function AuditCodeViewer({
  data,
  title = "Technical Metadata (Raw JSON)",
  defaultExpanded = false,
  beforeData,
}: AuditCodeViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<"after" | "before">("after");
  const [copied, setCopied] = useState(false);

  const currentPayload = activeTab === "after" ? data : beforeData;
  const jsonString = currentPayload
    ? JSON.stringify(currentPayload, null, 2)
    : "{}";

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers or restricted sandboxes
      const textarea = document.createElement("textarea");
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden transition-all">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-violet-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-200 shrink-0 transition-colors" />
          )}
          <Code2 className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
            {title}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {isExpanded ? "Click to collapse" : "Click to inspect original payload"}
          </span>
        </div>

        {isExpanded && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {beforeData && (
              <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("after")}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    activeTab === "after"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Recorded (After)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("before")}
                  className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    activeTab === "before"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Prior (Before)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm"
              title="Copy JSON to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
        )}
      </button>

      {/* Expanded Code Viewer */}
      {isExpanded && (
        <div className="p-3.5 pt-0 border-t border-slate-800/80">
          <div className="relative mt-2">
            <pre className="p-3.5 bg-[#070A11] text-cyan-300 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800/90 shadow-inner max-h-72">
              <code>{jsonString}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
