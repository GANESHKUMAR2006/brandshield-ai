"use client";

import React, { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { CloseIcon } from "@/components/ui/Icons";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 left-0 flex max-w-full z-50">
        <div className="relative w-72 bg-white shadow-xl flex flex-col">
          {/* Close button inside mobile header */}
          <div className="absolute top-3 right-3 z-50">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              aria-label="Close navigation"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          <Sidebar onNavigate={onClose} className="w-full border-r-0" />
        </div>
      </div>
    </div>
  );
}
