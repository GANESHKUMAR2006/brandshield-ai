"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Info,
  ArrowRight,
  ArrowLeft,
  Shield,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Listen for auth state change from recovery link hash fragments
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === "PASSWORD_RECOVERY" || session) {
            setHasValidSession(true);
            setIsVerifyingSession(false);
          }
        }
      );

      // Also check existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setHasValidSession(true);
        }
        setIsVerifyingSession(false);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    } catch {
      setIsVerifyingSession(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify confirmation.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          data.error ||
            "Failed to update password. Your recovery session may have expired."
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        data.message ||
          "Password updated successfully! Redirecting to sign in..."
      );
      setIsLoading(false);

      // Redirect to login with success parameter after brief delay
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while resetting your password."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] flex flex-col items-center relative z-10">
      {/* Central Reset Card */}
      <div className="w-full bg-[#0e1424]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Top Key Icon */}
        <div className="w-12 h-12 rounded-xl bg-[#141b30] border border-slate-700/80 flex items-center justify-center text-slate-200 mx-auto mb-4 shadow-sm">
          <KeyRound className="w-5 h-5 text-violet-400" />
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Set new password
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 mb-6 max-w-sm mx-auto leading-relaxed">
          Create a new secure password for your BrandShield governance account.
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
                Password Reset Error
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
                Credentials Updated
              </span>
              <span className="text-[11px] text-emerald-300/90 block mt-0.5">
                {successMessage}
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* New Password */}
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full h-11 pl-10 pr-10 bg-[#0a0f1d] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all shadow-inner disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                disabled={isLoading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full h-11 pl-10 pr-10 bg-[#0a0f1d] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all shadow-inner disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 focus:outline-none"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Security Notice Box */}
          <div className="bg-[#0f1629] border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Security Notice: Updating your password will invalidate previous
              active sessions across other browsers.
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
                  <span>Updating credentials...</span>
                </>
              ) : (
                <>
                  <span>Update Password</span>
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
            Credential updates are verified through cryptographic challenge
            tokens and recorded in the immutable audit log.
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
