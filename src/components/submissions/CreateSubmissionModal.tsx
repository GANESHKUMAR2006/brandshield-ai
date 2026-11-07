"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { createSubmission, LiveProduct } from "@/lib/api-client";
import { X, FileCheck2, Sparkles } from "lucide-react";

interface CreateSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: LiveProduct[];
  initialPresetIndex?: number | null;
}

const DEMO_PRESETS = [
  {
    label: "Compliant Launch Ad",
    badge: "Supported",
    badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
    title: "DermaGlow Vitamin C — Festive Launch Campaign",
    channel: "Instagram",
    content: "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C, now available for ₹1,999.",
  },
  {
    label: "High-Risk Overclaim",
    badge: "Blocked / Review",
    badgeColor: "bg-rose-950/80 text-rose-300 border-rose-800/60",
    title: "DermaGlow Miracle Radiance — Flash Promo",
    channel: "Website",
    content: "DermaGlow Vitamin C Serum guarantees 100% elimination of all wrinkles in 3 days for just ₹999!",
  },
  {
    label: "Multi-Claim Clinical",
    badge: "Efficacy & Evidence",
    badgeColor: "bg-violet-950/80 text-violet-300 border-violet-800/60",
    title: "DermaGlow Clinical Radiance — Product Launch",
    channel: "Instagram",
    content: "DermaGlow Vitamin C Serum is clinically formulated with 10% stabilised Vitamin C to improve skin barrier hydration after 8 weeks. Available at launch for ₹1,999.",
  },
];

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
  initialPresetIndex,
}: CreateSubmissionModalProps) {
  const initialPreset =
    initialPresetIndex !== undefined &&
    initialPresetIndex !== null &&
    DEMO_PRESETS[initialPresetIndex]
      ? DEMO_PRESETS[initialPresetIndex]
      : null;

  const [title, setTitle] = useState(initialPreset ? initialPreset.title : "");
  const [content, setContent] = useState(initialPreset ? initialPreset.content : "");
  const [channel, setChannel] = useState(initialPreset ? initialPreset.channel : "Instagram");
  const [productId, setProductId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveProductId = productId || (products[0]?.id ?? "");

  const handleApplyPreset = (preset: (typeof DEMO_PRESETS)[0]) => {
    setTitle(preset.title);
    setChannel(preset.channel);
    setContent(preset.content);
    if (products.length > 0) {
      setProductId(products[0].id);
    }
  };

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
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-950/80 border border-violet-800/60 rounded-xl text-violet-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                New Marketing Submission
              </h3>
              <p className="text-xs text-slate-400">
                Ingest ad copy, landing pages, or promotional collateral for claim verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Quick-Start Demo Presets */}
          <div className="p-3 bg-violet-950/25 border border-violet-800/40 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Demo Quick-Start Presets:
              </span>
              <span className="text-[10px] text-cyan-300 font-medium">Click to auto-populate</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="text-left p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-violet-500 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="font-semibold text-white text-[11px] truncate">{p.label}</div>
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full border mt-1.5 ${p.badgeColor}`}>
                    {p.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Campaign / Submission Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 HydraBoost Serum — Instagram Carousel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Marketing Channel <span className="text-rose-400">*</span>
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Associated Product
              </label>
              <select
                value={effectiveProductId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
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
              <label className="block font-semibold text-slate-300">
                Marketing Content / Ad Copy <span className="text-rose-400">*</span>
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
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 font-sans shadow-inner"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Assigned to: <strong className="text-slate-200">DermaGlow Workspace</strong>
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
