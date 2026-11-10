"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { createPromotion, LiveProduct, LivePromotion } from "@/lib/api-client";
import { X, Tag, AlertCircle, Loader2, Calendar } from "lucide-react";

interface CreatePromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (promo: LivePromotion) => void;
  products: LiveProduct[];
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

export function CreatePromotionModal({
  isOpen,
  onClose,
  onSuccess,
  products,
}: CreatePromotionModalProps) {
  const [productId, setProductId] = useState<string>("");
  const [promotionName, setPromotionName] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage" | "bundle">("percentage");
  const [discountValue, setDiscountValue] = useState("20");
  const [resultingPrice, setResultingPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["all"]);
  const [terms, setTerms] = useState("");
  const [status, setStatus] = useState<"active" | "scheduled" | "expired" | "cancelled">("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates on client-side mount / modal open
  useEffect(() => {
    if (isOpen) {
      if (!startDate) {
        setStartDate(new Date().toISOString().split("T")[0]);
      }
      if (!endDate) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        setEndDate(d.toISOString().split("T")[0]);
      }
    }
  }, [isOpen, startDate, endDate]);

  // Set default product
  useEffect(() => {
    if (products.length > 0 && !productId) {
      setProductId(products[0].id);
      setCurrency(products[0].currency || "INR");
    }
  }, [products, productId]);

  // Auto-calculate resulting price based on selected product and discount
  useEffect(() => {
    const selectedProd = products.find((p) => p.id === productId);
    if (!selectedProd) return;

    const basePrice = Number(selectedProd.reference_price);
    const discNum = parseFloat(discountValue) || 0;

    if (discountType === "percentage") {
      const calcPrice = Math.max(0, basePrice - (basePrice * discNum) / 100);
      setResultingPrice(calcPrice.toFixed(2));
    } else if (discountType === "fixed") {
      const calcPrice = Math.max(0, basePrice - discNum);
      setResultingPrice(calcPrice.toFixed(2));
    } else {
      setResultingPrice(basePrice.toFixed(2));
    }
  }, [productId, discountType, discountValue, products]);

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

    if (!productId) {
      setError("Please select a target product for the promotion.");
      return;
    }
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
      const promo = await createPromotion({
        productId,
        promotionName: promotionName.trim(),
        discountType,
        discountValue: discNum,
        resultingPrice: resPriceNum,
        currency,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        applicableChannels: selectedChannels,
        terms: terms.trim() || null,
        status,
      });

      onSuccess(promo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promotion");
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
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Create Pricing Promotion
              </h3>
              <p className="text-xs text-slate-400">
                Register a promotional discount rule for deterministic claim verification
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
              Target Product <span className="text-rose-400">*</span>
            </label>
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-inner"
            >
              {products.length === 0 && (
                <option value="">No products available (Please register a product first)</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Retail: ₹{Number(p.reference_price).toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Promotion Campaign Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={promotionName}
              onChange={(e) => setPromotionName(e.target.value)}
              placeholder="e.g., Festive Radiance Flash Offer"
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

          <div className="grid grid-cols-2 gap-3">
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
              Terms, Conditions & Exclusions
            </label>
            <textarea
              rows={2}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="e.g., Valid online only. Cannot be combined with other promotional coupons."
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
              disabled={isSubmitting || products.length === 0}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Creating...
                </>
              ) : (
                "Save Promotion"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
