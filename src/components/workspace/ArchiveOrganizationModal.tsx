"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  X,
  Loader2,
  ShieldAlert,
  Building2,
  Lock,
  FileCheck2,
} from "lucide-react";
import { archiveWorkspace, WorkspaceItem } from "@/lib/api-client";

interface ArchiveOrganizationModalProps {
  isOpen: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
  onClose: () => void;
  onArchived: (archivedWorkspace: { id: string; name: string; slug: string }) => void;
}

export function ArchiveOrganizationModal({
  isOpen,
  workspace,
  onClose,
  onArchived,
}: ArchiveOrganizationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConfirmInput("");
      setReason("");
      setError(null);
      setIsLoading(false);
      return;
    }

    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerElementRef.current?.focus();
    };
  }, [isOpen, isLoading, onClose]);

  if (!mounted || !isOpen || !workspace) {
    return null;
  }

  const expectedName = workspace.name.trim();
  const isMatch = confirmInput.trim().toLowerCase() === expectedName.toLowerCase();

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      await archiveWorkspace(workspace.id, {
        confirmName: confirmInput.trim(),
        reason: reason.trim() || undefined,
      });

      onArchived({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive organization");
      setIsLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={() => {
          if (!isLoading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-rose-800/60 rounded-2xl shadow-2xl shadow-rose-950/40 flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Pinned Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-900/40 bg-rose-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="archive-modal-title" className="text-base font-bold text-white tracking-tight">
                Archive Organization
              </h2>
              <p className="text-xs text-rose-300/80 font-medium">
                Irreversible Compliance Lifecycle Action
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Target Organization Info */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-slate-400" />
              <div>
                <div className="text-white font-semibold">{workspace.name}</div>
                <div className="text-[11px] font-mono text-slate-400">slug: {workspace.slug}</div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800/60 text-rose-300">
              Target for Archival
            </span>
          </div>

          {/* Impact Warning */}
          <div className="p-3.5 rounded-xl border border-amber-900/50 bg-amber-950/20 text-amber-200/90 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Consequences of Archival</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-200/80 pl-1">
              <li>All active team memberships in this workspace will be suspended immediately.</li>
              <li>Pending invitations will be revoked.</li>
              <li>This organization will be removed from active workspace switchers.</li>
              <li>New submissions, claims, and verification runs will be blocked.</li>
            </ul>
          </div>

          {/* Regulatory Retention Note */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-300 flex items-start gap-2.5">
            <FileCheck2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-white">Compliance Preservation Notice:</strong> Under FDA 21 CFR Part 11, FTC Marketing Substantiation, and ISO 22716, all clinical documents, extracted claims, review decisions, and tamper-evident audit records are preserved permanently in the immutable archive. Hard deletion is prohibited to prevent spoliation of compliance records.
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form id="archive-org-form" onSubmit={handleArchive} className="space-y-4 pt-1">
            <div>
              <label htmlFor="confirm-name-input" className="block text-slate-300 font-semibold mb-1.5">
                To confirm, type <span className="font-bold text-white select-all font-mono">&ldquo;{expectedName}&rdquo;</span> below:
              </label>
              <input
                id="confirm-name-input"
                ref={inputRef}
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={expectedName}
                disabled={isLoading}
                autoComplete="off"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl text-white placeholder-slate-500 text-xs shadow-inner outline-none transition-colors"
              />
            </div>

            <div>
              <label htmlFor="archive-reason-input" className="block text-slate-300 font-semibold mb-1.5">
                Reason for Archival <span className="text-slate-500 font-normal">(Optional)</span>:
              </label>
              <input
                id="archive-reason-input"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Brand discontinued, corporate restructuring, end of campaign"
                disabled={isLoading}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 focus:border-slate-500 rounded-xl text-white placeholder-slate-500 text-xs shadow-inner outline-none transition-colors"
              />
            </div>
          </form>
        </div>

        {/* Pinned Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="archive-org-form"
            disabled={!isMatch || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:bg-rose-950/60 disabled:border disabled:border-rose-900/40 disabled:text-rose-400/50 text-white font-semibold text-xs transition-all shadow-md shadow-rose-950/50 cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Archiving Organization...</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Archive Organization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
