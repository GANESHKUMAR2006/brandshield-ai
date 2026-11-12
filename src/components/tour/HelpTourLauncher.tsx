"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTour } from "./TourContext";
import { ROLE_TOUR_CONFIGS, PAGE_TOURS } from "@/lib/tour/tour-config";
import { ReviewerRole } from "@/types";
import {
  Compass,
  Sparkles,
  HelpCircle,
  RotateCcw,
  BookOpen,
  ChevronDown,
  Layers,
  CheckCircle2,
} from "lucide-react";

export function HelpTourLauncher() {
  const pathname = usePathname();
  const {
    startRoleTour,
    startPageTour,
    openWelcome,
    resetAllTours,
    userRole,
    isTourActive,
  } = useTour();

  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isTourActive) return null;

  const roleConfig = ROLE_TOUR_CONFIGS[userRole] || ROLE_TOUR_CONFIGS.viewer;
  const currentPageTour = PAGE_TOURS[pathname];

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button in Header */}
      <button
        type="button"
        data-tour="help-tour-launcher"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-all hover:border-violet-500/50 shadow-sm cursor-pointer"
        aria-label="Interactive Guided Tours & Help"
        title="Launch Product Walkthroughs & Guided Tours"
      >
        <Compass className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Guided Tour</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-xl shadow-2xl p-3 z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 space-y-2.5"
          role="menu"
        >
          {/* Header */}
          <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-white text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>Interactive Tours</span>
            </span>
            <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full capitalize">
              {roleConfig.roleDisplayName.split(" ")[0]}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="space-y-1">
            {/* 1. Current Page Tour */}
            {currentPageTour && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  startPageTour(pathname);
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-violet-950/40 hover:bg-violet-900/40 border border-violet-800/50 text-left transition-colors cursor-pointer group"
              >
                <div>
                  <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {currentPageTour.pageTitle}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Walk through this page&apos;s key controls ({currentPageTour.steps.length} steps)
                  </div>
                </div>
                <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              </button>
            )}

            {/* 2. Full Role Tour */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                startRoleTour(userRole);
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 text-left transition-colors cursor-pointer group"
            >
              <div>
                <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {roleConfig.roleDisplayName} Journey
                </div>
                <div className="text-[10px] text-slate-400">
                  Full end-to-end workflow walkthrough ({roleConfig.steps.length} steps)
                </div>
              </div>
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </button>

            {/* 3. Welcome Screen */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openWelcome();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 text-left transition-colors cursor-pointer group"
            >
              <div>
                <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  Welcome & Role Overview
                </div>
                <div className="text-[10px] text-slate-400">
                  Responsibilities & BrandShield core workflow
                </div>
              </div>
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Switch Role Preview */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1.5">
              Explore Other Role Tours:
            </span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {(["admin", "compliance_reviewer", "legal_reviewer", "creator", "viewer"] as ReviewerRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    startRoleTour(r);
                  }}
                  className="px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white text-left capitalize truncate cursor-pointer transition-colors"
                >
                  {r.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Reset All Tours */}
          <div className="pt-1.5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetAllTours();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset First-Login Tour State</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
