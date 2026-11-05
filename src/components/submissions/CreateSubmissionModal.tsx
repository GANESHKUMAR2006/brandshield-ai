"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { CloseIcon, FileCheckIcon } from "@/components/ui/Icons";
import { createSubmission, LiveProduct } from "@/lib/api-client";

interface CreateSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: LiveProduct[];
}

const CHANNELS = [
  "Instagram",
  "Website",
  "Facebook",
  "Google Ads",
  "Email",
  "Packaging / Print",
  "Other",
] as const;

export function CreateSubmissionModal({
  isOpen,
  onClose,
  onSuccess,
  products,
}: CreateSubmissionModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState("Instagram");
  const [productId, setProductId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveProductId = productId || (products[0]?.id ?? "");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters long.");
      return;
    }
    if (content.trim().length < 5) {
      setError("Marketing content must be at least 5 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createSubmission({
        title: title.trim(),
        content: content.trim(),
        channel,
        productId: effectiveProductId || null,
        submittedBy: "Dr. Elena Vance (Regulatory Affairs)",
      });

      setTitle("");
      setContent("");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700">
              <FileCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                New Marketing Submission
              </h3>
              <p className="text-xs text-slate-500">
                Ingest ad copy, landing pages, or promotional collateral for claim verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Campaign / Submission Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 HydraBoost Serum — Instagram Carousel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Marketing Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Associated Product
              </label>
              <select
                value={effectiveProductId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None / Multi-Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">
                Marketing Content / Ad Copy <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Version 1 will be generated automatically
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Paste exact promotional copy, claim assertions, or headline text here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Assigned to: <strong className="text-slate-700">DermaGlow Workspace</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Save as Draft
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
