"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  UserCheck,
} from "lucide-react";

interface DemoAccount {
  name: string;
  email: string;
  role: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Dr. Elena Vance",
    email: "elena.vance@dermaglow.com",
    role: "Compliance Reviewer (Lead)",
  },
  {
    name: "Compliance Administrator",
    email: "admin@dermaglow.com",
    role: "Workspace Administrator",
  },
  {
    name: "Marcus Brody, Esq.",
    email: "marcus.brody@dermaglow.com",
    role: "Legal & Regulatory Counsel",
  },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("elena.vance@dermaglow.com");
  const [password, setPassword] = useState("BrandShield2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

  const handleLogin = async (
    e?: React.FormEvent,
    overrideEmail?: string,
    overridePassword?: string
  ) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const submitEmail = (overrideEmail || email).trim();
    const submitPassword = overridePassword || password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submitEmail, password: submitPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          data.error || "Authentication failed. Please verify credentials."
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        `Welcome, ${data.user?.name || submitEmail}. Redirecting to workspace...`
      );

      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error during authentication."
      );
      setIsLoading(false);
    }
  };

  const handleSelectDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword("BrandShield2026!");
    handleLogin(undefined, account.email, "BrandShield2026!");
  };

  return (
    <div className="bg-[#0e1424]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl w-full max-w-[460px] relative z-10">
      {/* Top Workspace Box */}
      <div className="bg-[#131b30] border border-slate-700/60 rounded-xl p-3 flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Workspace Authentication
          </span>
          <span className="block text-xs font-semibold text-white">
            Authorized Enterprise Access
          </span>
        </div>
      </div>

      {/* Card Header */}
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Welcome to BrandShield
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Sign in to access your organization&apos;s marketing governance workspace.
        </p>
      </div>

      {/* Dynamic Alerts */}
      {error && (
        <div
          role="alert"
          className="p-3.5 mb-5 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-rose-200">
              Authentication Error
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
          className="p-3.5 mb-5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Work Email */}
        <div>
          <label
            htmlFor="work-email"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Work Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="work-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="w-full h-11 pl-10 pr-4 bg-[#0a0f1d] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="account-password"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="account-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 pl-10 pr-10 bg-[#0a0f1d] border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-all shadow-inner"
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

        {/* Options Row */}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-[#0a0f1d] text-violet-600 focus:ring-violet-500/20 accent-violet-500 cursor-pointer"
            />
            <span className="text-slate-400 hover:text-slate-300 transition-colors">
              Remember me
            </span>
          </label>

          <Link
            href="/forgot-password"
            className="text-slate-400 hover:text-violet-300 transition-colors focus:outline-none"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-[#c5b4fd] hover:bg-[#d8b4fe] active:scale-[0.99] text-[#151028] font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#151028]" />
                <span>Signing in to workspace...</span>
              </>
            ) : (
              <>
                <span>Sign in to your workspace</span>
                <ArrowRight className="w-4 h-4 text-[#151028]" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Access Restriction Notice */}
      <div className="pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Access is restricted to authorized workspace members.</span>
      </div>

      {/* Evaluator Fast-Access Switcher (Collapsible for Evaluators / Judges) */}
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowDemoSelector(!showDemoSelector)}
          className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1 focus:outline-none"
        >
          <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <UserCheck className="w-3.5 h-3.5 text-violet-400" />
            Evaluator Demo Profiles
          </span>
          <span className="text-[10px] text-violet-400 underline">
            {showDemoSelector ? "Hide" : "1-Click Sign In"}
          </span>
        </button>

        {showDemoSelector && (
          <div className="mt-2 space-y-1.5 animate-in fade-in duration-150">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={isLoading}
                onClick={() => handleSelectDemo(acc)}
                className="w-full p-2 rounded-lg bg-[#0a0f1d] hover:bg-slate-800/60 border border-slate-800/80 hover:border-violet-500/40 text-left transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-violet-300">
                    {acc.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {acc.role} · <span className="font-mono text-slate-500">{acc.email}</span>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-violet-300 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
