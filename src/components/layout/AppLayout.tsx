"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { MobileNav } from "./MobileNav";
import { SAMPLE_DATA_NOTICE } from "@/config/sample-data";
import { InfoIcon } from "@/components/ui/Icons";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        <TopNav onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Synthetic / Demonstration Data Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 sm:px-6">
          <div className="flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <InfoIcon className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-semibold">{SAMPLE_DATA_NOTICE.label}:</span>
              <span className="text-amber-800 hidden sm:inline">
                {SAMPLE_DATA_NOTICE.description}
              </span>
              <span className="text-amber-800 sm:hidden">
                Mock UI data active. Real-time verification disabled in Phase 1.
              </span>
            </div>
            <span className="text-[11px] font-medium text-amber-700 shrink-0 ml-2 uppercase tracking-wider">
              Phase 1 Preview
            </span>
          </div>
        </div>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
