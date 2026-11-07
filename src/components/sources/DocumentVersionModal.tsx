"use client";

import React, { useEffect } from "react";
import { LiveSourceDocument, LiveDocumentVersion } from "@/lib/api-client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CloseIcon, FolderGit2Icon, CheckCircleIcon, AlertCircleIcon } from "@/components/ui/Icons";
import { formatDate } from "@/lib/utils/formatters";

interface DocumentVersionModalProps {
  sourceDoc: LiveSourceDocument | null;
  versions: LiveDocumentVersion[];
  onClose: () => void;
}

export function DocumentVersionModal({
  sourceDoc,
  versions,
  onClose,
}: DocumentVersionModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (sourceDoc && typeof window !== "undefined") {
      window.addEventListener("keydown", handleKeyDown);
      window.document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", handleKeyDown);
        window.document.body.style.overflow = "";
      }
    };
  }, [sourceDoc, onClose]);

  if (!sourceDoc) return null;

  const docVersions = versions.filter((v) => v.source_document_id === sourceDoc.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden flex flex-col max-h-[85vh] z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-start justify-between bg-slate-950/50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-violet-950/60 border border-violet-800/60 rounded-xl text-violet-400 shrink-0">
              <FolderGit2Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                  {sourceDoc.document_type.replace(/_/g, " ")}
                </span>
                <Badge variant={sourceDoc.is_expired ? "warning" : "success"} size="sm">
                  {sourceDoc.approval_status}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-white mt-1 leading-snug">
                {sourceDoc.title}
              </h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5">ID: {sourceDoc.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {sourceDoc.description && (
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-100">Description: </span>
              {sourceDoc.description}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white text-sm">
                Document Version History ({docVersions.length})
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                Sorted by version sequence
              </span>
            </div>

            <div className="space-y-3">
              {docVersions.map((ver) => {
                const isCurrentApproved = ver.is_current;

                return (
                  <div
                    key={ver.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrentApproved
                        ? "bg-violet-950/20 border-violet-700/60 shadow-lg shadow-violet-950/20"
                        : "bg-slate-950/40 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          Version {ver.version_number}
                        </span>
                        {isCurrentApproved && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Active Approved Version
                          </span>
                        )}
                        {ver.is_superseded && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                            Superseded
                          </span>
                        )}
                        {ver.is_expired && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60">
                            <AlertCircleIcon className="w-3.5 h-3.5" />
                            Expired
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Status: <strong className="text-slate-200 capitalize">{ver.approval_status}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500">Storage Path: </span>
                        <code className="text-cyan-300 font-mono text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                          {ver.storage_path}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-500">Approval Date: </span>
                        <span className="text-slate-200 font-medium">
                          {ver.approval_date ? formatDate(ver.approval_date) : "Pending"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Validity Window: </span>
                        <span className="text-slate-200 font-medium">
                          {formatDate(ver.valid_from)} —{" "}
                          {ver.valid_until ? formatDate(ver.valid_until) : "Indefinite"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Content Hash: </span>
                        <span className="text-slate-400 font-mono text-[10px] truncate inline-block max-w-[180px]">
                          {ver.content_hash}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 flex justify-end bg-slate-950/50">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
