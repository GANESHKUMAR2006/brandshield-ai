"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteProduct, LiveProduct } from "@/lib/api-client";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteProductDialogProps {
  product: LiveProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export function DeleteProductDialog({
  product,
  isOpen,
  onClose,
  onSuccess,
}: DeleteProductDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteProduct(product.id);
      onSuccess(product.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
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
              Delete Product Formulation?
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-white">&ldquo;{product.name}&rdquo;</span> (SKU: <span className="font-mono text-cyan-300">{product.sku}</span>)?
            </p>
          </div>

          <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-left text-[11px] text-rose-300/90 leading-relaxed">
            <strong>Governance Safeguard:</strong> Associated pricing promotions and approved ground-truth facts will be permanently detached. Historical audit logs will retain the deletion trail.
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
