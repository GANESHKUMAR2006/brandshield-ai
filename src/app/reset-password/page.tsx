"use client";

import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#060913] text-slate-100 relative overflow-x-hidden selection:bg-violet-500/30 selection:text-white">
      {/* Ambient background lighting glows matching design specification */}
      <div
        className="absolute top-[-10%] left-[25%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-[35%] right-[15%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] left-[30%] w-[550px] h-[550px] bg-purple-900/10 rounded-full blur-[160px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Global Navigation with BrandShield AI & Enterprise Claim Governance subhead */}
      <AuthHeader showSubhead={true} showRightBadge={true} />

      {/* Centered Main Reset Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Top Centered Security Operations Badge */}
        <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-slate-300 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Claim Governance • Security Operations
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-[460px] h-[480px] bg-[#0e1424]/90 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <span>Loading reset console...</span>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>

      {/* Global Footer */}
      <AuthFooter />
    </div>
  );
}
