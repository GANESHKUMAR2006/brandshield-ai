"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { MobileNav } from "./MobileNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#090D16] text-slate-100">
      {/* Ambient background glows */}
      <div
        className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/3 -right-20 w-[450px] h-[450px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0 relative z-20">
        <Sidebar />
      </div>

      {/* Mobile Drawer Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
        {/* Top Header */}
        <TopNav onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="max-w-7xl mx-auto space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
