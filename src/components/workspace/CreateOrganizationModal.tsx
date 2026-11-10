"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Link as LinkIcon,
  Shield,
  Lock,
} from "lucide-react";
import { createWorkspace } from "@/lib/api-client";

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newWorkspace: { id: string; name: string; slug: string }) => void;
}

/**
 * Generates a clean URL slug from an organization name.
 * Lowercase, alphanumeric characters, and single hyphens.
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validates domain format (e.g. acme.com or sub.acme.org)
 */
function isValidDomain(domain: string): boolean {
  if (!domain) return true;
  const regex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(domain.trim());
}

export function CreateOrganizationModal({
  isOpen,
  onClose,
  onCreated,
}: CreateOrganizationModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [domain, setDomain] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // SSR hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  // Manage focus, body scrolling, and Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    // Prevent background page scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus input after modal mounts
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);

    // Escape key listener
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

  // Reset form state when closed
  const handleClose = () => {
    if (isLoading) return;
    setError(null);
    setSuccess(null);
    setName("");
    setSlug("");
    setIsSlugManuallyEdited(false);
    setDomain("");
    onClose();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setError(null);

    // Auto-generate slug if not manually customized
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(rawVal);
    setIsSlugManuallyEdited(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Organization name is required.");
      nameInputRef.current?.focus();
      return;
    }

    if (trimmedName.length < 2) {
      setError("Organization name must be at least 2 characters.");
      nameInputRef.current?.focus();
      return;
    }

    const effectiveSlug = slug.trim() || generateSlug(trimmedName);
    if (!effectiveSlug) {
      setError("A valid workspace slug is required.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug)) {
      setError(
        "Workspace slug must contain only lowercase letters, numbers, and single hyphens without leading or trailing hyphens."
      );
      return;
    }

    if (domain.trim() && !isValidDomain(domain.trim())) {
      setError("Please enter a valid corporate domain (e.g. acmebio.com).");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const ws = await createWorkspace({
        name: trimmedName,
        slug: effectiveSlug,
        domain: domain.trim() || undefined,
      });

      setSuccess(`Organization "${ws.name}" created successfully!`);

      // Allow reviewer to see confirmation banner, then notify parent & close
      setTimeout(() => {
        onCreated(ws);
        handleClose();
      }, 700);
    } catch (err) {
      // Preserve user input on failure so they can adjust without retyping
      setError(
        err instanceof Error ? err.message : "Failed to create organization"
      );
      setIsLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-[#090D16]/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        // Close on backdrop click if not submitting
        if (e.target === e.currentTarget && !isLoading) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-org-modal-title"
        aria-describedby="create-org-modal-desc"
        className="relative w-full max-w-lg max-h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-48px)] flex flex-col bg-[#0B0F19] border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header (Pinned) */}
        <div className="px-5 sm:px-6 py-4.5 border-b border-slate-800/90 flex items-start justify-between shrink-0 bg-slate-900/50">
          <div className="flex items-center gap-3 pr-4">
            <div className="w-10 h-10 rounded-xl bg-violet-950/80 border border-violet-800/60 flex items-center justify-center text-violet-400 shrink-0 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="create-org-modal-title"
                className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2"
              >
                <span>Create Organization</span>
              </h2>
              <p
                id="create-org-modal-desc"
                className="text-xs text-slate-400 mt-0.5 leading-relaxed"
              >
                Provision a tenant-isolated compliance workspace for your brand, team, or clinical portfolio.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Independently Scrollable) */}
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1 space-y-4.5 overscroll-contain">
          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/70 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Creation Failed</span>
                <span className="text-rose-200/90 leading-relaxed">{error}</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/70 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{success}</span>
            </div>
          )}

          <form id="create-org-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Organization Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="org-name-input"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Organization Name <span className="text-violet-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500">Legal entity or brand</span>
              </div>
              <div className="relative">
                <input
                  id="org-name-input"
                  ref={nameInputRef}
                  type="text"
                  required
                  disabled={isLoading}
                  value={name}
                  onChange={handleNameChange}
                  placeholder="e.g. BioTech Health Inc."
                  className="w-full h-10 px-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-inner disabled:opacity-50"
                />
              </div>
            </div>

            {/* Field 2: Workspace Slug */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="org-slug-input"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Workspace Slug (URL Identifier) <span className="text-violet-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500">Unique URL handle</span>
              </div>
              <div className="flex rounded-xl overflow-hidden border border-slate-700/80 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all bg-slate-950 shadow-inner">
                <span className="inline-flex items-center px-3 text-[11px] sm:text-xs text-slate-400 bg-slate-900 border-r border-slate-800 select-none font-mono">
                  brandshield.ai/
                </span>
                <input
                  id="org-slug-input"
                  type="text"
                  required
                  disabled={isLoading}
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="biotech-health"
                  className="flex-1 h-10 px-3 bg-transparent text-xs sm:text-sm font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-slate-500 shrink-0" />
                <span>Lowercase alphanumeric characters and hyphens only.</span>
              </p>
            </div>

            {/* Field 3: Corporate Domain */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="org-domain-input"
                  className="block text-xs font-semibold text-slate-200"
                >
                  Corporate Domain <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <span className="text-[11px] text-slate-500">For user auto-join</span>
              </div>
              <div className="relative flex items-center">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                <input
                  id="org-domain-input"
                  type="text"
                  disabled={isLoading}
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value.toLowerCase().trim());
                    setError(null);
                  }}
                  placeholder="biotech.com"
                  className="w-full h-10 pl-9 pr-3.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-inner disabled:opacity-50 font-mono"
                />
              </div>
            </div>

            {/* Tenant Security Notice */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300 space-y-1.5 shadow-inner">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Tenant Isolation Guaranteed</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Your new organization will be provisioned with cryptographically isolated PostgreSQL row-level security, separate policy studio rules, and an independent append-only audit trail.
              </p>
            </div>
          </form>
        </div>

        {/* Modal Footer (Pinned) */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800/90 flex items-center justify-end gap-3 shrink-0 bg-slate-900/60">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-org-form"
            disabled={isLoading || !name.trim()}
            className="px-4.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/25 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Provisioning Workspace...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Create Organization</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
