"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  RotateCcw,
  AtSign,
  Info,
  ArrowRight,
  ArrowLeft,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your corporate email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please provide a valid corporate email address.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          data.error ||
            "Unable to process recovery request. Please verify your email or contact support."
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        data.message ||
          "Recovery instructions dispatched. Please check your registered corporate email."
      );
      setIsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error occurred while submitting recovery request."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] flex flex-col items-center relative z-10">
      {/* Central Reset Card */}
      <div className="w-full bg-[#0e1424]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Top Reset Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#141b30] border border-slate-700/80 flex items-center justify-center text-slate-200 mx-auto mb-4 shadow-sm">
          <RotateCcw className="w-5 h-5 text-violet-400" />
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Reset your password
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-6 max-w-sm mx-auto leading-relaxed">
          Enter the corporate email address associated with your BrandShield
          governance account. We will send an encrypted authorization link to
          reset your credentials.
        </p>

        {/* Dynamic Alerts */}
        {error && (
          <div
            role="alert"
            className="p-3.5 mb-5 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 text-left animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-rose-200">
                Recovery Error
              </span>
              <span className="text-[11px] text-rose-300/90 block mt-0.5">
                {error}
              </span>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3.5 mb-5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-start gap-2.5 text-xs text-emerald-300 text-left animate-in fade-in"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-emerald-200">
                Recovery Link Dispatched
              </span>
              <span className="text-[11px] text-emerald-300/90 block mt-0.5">
                {successMessage}
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Work Email */}
          <div>
            <label
              htmlFor="recovery-email"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Work Email
            </label>

            <div className="relative">
              <AtSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="recovery-email"
                type="email"
                required
                disabled={isLoading}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                className="w-full h-11 pl-10 pr-4 bg-[#0a0f1d] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all shadow-inner disabled:opacity-60"
              />
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="bg-[#0f1629] border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Security Notice: Time-limited recovery token will be dispatched to
              your registered address.
            </span>
          </div>

          {/* Submit Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#c5b4fd] hover:bg-[#d8b4fe] active:scale-[0.99] text-[#151028] font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#151028]" />
                  <span>Dispatching recovery link...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="w-4 h-4 text-[#151028]" />
                </>
              )}
            </button>
          </div>

          {/* Return to Sign In */}
          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors focus:outline-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Sign In</span>
            </Link>
          </div>
        </form>
      </div>

      {/* Security & Governance Protocol Information Card */}
      <div className="w-full bg-[#0d1324] border border-slate-800 rounded-xl p-4 flex items-start gap-3.5 mt-5 text-left">
        <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
          <Shield className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold tracking-wider text-slate-200 uppercase">
            Security & Governance Protocol
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
            Recovery requests are logged in the Governance Audit Trail. If your
            account is locked by an administrator, contact your workspace
            compliance officer.
          </p>
        </div>
      </div>

      {/* Encrypted Authorization Protocol Label */}
      <div className="mt-5 text-[9px] tracking-[0.25em] text-slate-500 font-mono uppercase text-center">
        Encrypted Authorization Protocol
      </div>
    </div>
  );
}
