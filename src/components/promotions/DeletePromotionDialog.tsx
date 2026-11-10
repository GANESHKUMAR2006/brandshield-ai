"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deletePromotion, LivePromotion } from "@/lib/api-client";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeletePromotionDialogProps {
  promotion: LivePromotion | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export function DeletePromotionDialog({
  promotion,
  isOpen,
  onClose,
  onSuccess,
}: DeletePromotionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !promotion) return null;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deletePromotion(promotion.id);
      onSuccess(promotion.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete promotion");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-[#0B0F19] rounded-2xl shadow-2xl border border-rose-900/60 overflow-hidden flex flex-col z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100">
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800/80 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Delete Promotion Campaign?
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-white">&ldquo;{promotion.promotion_name}&rdquo;</span> for product <span className="text-slate-200 font-semibold">{promotion.product_name}</span>?
            </p>
          </div>

          <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-left text-[11px] text-rose-300/90 leading-relaxed">
            <strong>Verification Impact:</strong> Claims quoting this promotional price may subsequently be flagged as pricing discrepancies if no other active promotional rule corroborates the discount.
          </div>

          {error && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300 text-left">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                "Confirm Delete"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
