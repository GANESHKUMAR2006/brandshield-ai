"use client";

import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthFooter } from "@/components/auth/AuthFooter";
import { BrandShowcase } from "@/components/auth/BrandShowcase";
import { VerificationFlow } from "@/components/auth/VerificationFlow";
import { FeatureCards } from "@/components/auth/FeatureCards";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#060913] text-slate-100 relative overflow-x-hidden selection:bg-violet-500/30 selection:text-white">
      {/* Ambient background lighting glows matching design specification */}
      <div
        className="absolute top-[-10%] left-[15%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-[25%] right-[5%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] left-[30%] w-[550px] h-[550px] bg-purple-900/10 rounded-full blur-[160px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Top Global Navigation */}
      <AuthHeader />

      {/* Two-Column Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex items-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Branding, Deterministic Chain & Feature Cards */}
          <div className="lg:col-span-7 space-y-7">
            <BrandShowcase />
            <VerificationFlow />
            <FeatureCards />
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
            <Suspense
              fallback={
                <div className="w-full max-w-[460px] h-[500px] bg-[#0e1424]/90 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                  <span>Loading workspace authentication...</span>
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <AuthFooter />
    </div>
  );
}
