"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { updatePromotion, LivePromotion } from "@/lib/api-client";
import { X, Edit3, AlertCircle, Loader2 } from "lucide-react";

interface EditPromotionModalProps {
  promotion: LivePromotion | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: LivePromotion) => void;
}

const CHANNELS = [
  "all",
  "Instagram",
  "Website",
  "Facebook",
  "Google Ads",
  "Email",
  "Packaging / Print",
];

export function EditPromotionModal({
  promotion,
  isOpen,
  onClose,
  onSuccess,
}: EditPromotionModalProps) {
  const [promotionName, setPromotionName] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage" | "bundle">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [resultingPrice, setResultingPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["all"]);
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<"active" | "expired" | "scheduled" | "cancelled">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (promotion) {
      setPromotionName(promotion.promotion_name);
      setDiscountType(promotion.discount_type as any);
      setDiscountValue(String(promotion.discount_value));
      setResultingPrice(String(promotion.resulting_price));
      setStartDate(promotion.start_date.split("T")[0]);
      setEndDate(promotion.end_date.split("T")[0]);
      setSelectedChannels(
        Array.isArray(promotion.applicable_channels)
          ? promotion.applicable_channels
          : ["all"]
      );
      setTerms(promotion.terms || "");
      setStatus((promotion.status as any) || "active");
      setError(null);
    }
  }, [promotion]);

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

  if (!isOpen || !promotion) return null;

  const toggleChannel = (channel: string) => {
    if (channel === "all") {
      setSelectedChannels(["all"]);
      return;
    }
    setSelectedChannels((prev) => {
      const withoutAll = prev.filter((c) => c !== "all");
      if (withoutAll.includes(channel)) {
        const next = withoutAll.filter((c) => c !== channel);
        return next.length === 0 ? ["all"] : next;
      } else {
        return [...withoutAll, channel];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (promotionName.trim().length < 2) {
      setError("Promotion name must be at least 2 characters long.");
      return;
    }
    const resPriceNum = parseFloat(resultingPrice);
    const discNum = parseFloat(discountValue);

    if (isNaN(resPriceNum) || resPriceNum < 0) {
      setError("Resulting price must be a non-negative number.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be after end date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updatePromotion(promotion.id, {
        promotionName: promotionName.trim(),
        discountType,
        discountValue: discNum,
        resultingPrice: resPriceNum,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        applicableChannels: selectedChannels,
        terms: terms.trim() || null,
        status,
      });

      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update promotion");
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

      <div className="relative w-full max-w-lg bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-950/80 border border-amber-800/60 rounded-xl text-amber-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Edit Promotion Campaign
              </h3>
              <p className="text-xs text-slate-400">
                Target Product: <span className="text-slate-200 font-semibold">{promotion.product_name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Promotion Campaign Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={promotionName}
              onChange={(e) => setPromotionName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Off (₹)</option>
                <option value="bundle">Bundle Deal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Discount Value <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Resulting Price <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={resultingPrice}
                onChange={(e) => setResultingPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-amber-300 bg-slate-900/90 border border-slate-700/80 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                End Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
              >
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Applicable Channels
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map((ch) => {
                const isSelected = selectedChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-amber-950/80 border-amber-700/80 text-amber-300 shadow-sm"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {ch === "all" ? "All Channels" : ch}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Terms & Conditions
            </label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
