"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandShieldLogo } from "@/components/ui/Icons";
import { SITE_CONFIG } from "@/config/site";
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Sparkles,
  Eye,
  EyeOff,
  Shield,
  KeyRound,
  Check,
} from "lucide-react";

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  badge: string;
  accent: "violet" | "cyan" | "emerald";
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Dr. Elena Vance",
    email: "elena.vance@dermaglow.com",
    role: "Compliance Reviewer (Lead)",
    badge: "Primary Demo",
    accent: "violet",
    description: "Evaluates marketing claims against clinical dossiers and approved facts.",
  },
  {
    name: "Compliance Administrator",
    email: "admin@dermaglow.com",
    role: "Workspace Administrator",
    badge: "Admin Access",
    accent: "cyan",
    description: "Full controls: workspace governance, policy editor, and audit exports.",
  },
  {
    name: "Marcus Brody, Esq.",
    email: "marcus.brody@dermaglow.com",
    role: "Legal & Regulatory Counsel",
    badge: "Legal Gate",
    accent: "emerald",
    description: "Reviews escalated claims, medical disclosures, and policy overrides.",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("elena.vance@dermaglow.com");
  const [password, setPassword] = useState("BrandShield2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeQuickRole, setActiveQuickRole] = useState<string | null>("elena.vance@dermaglow.com");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (
    e?: React.FormEvent,
    customEmail?: string,
    customPass?: string
  ) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const submitEmail = (customEmail || email).trim();
    const submitPassword = customPass || password;

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

      // Smooth transition to target workspace
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 450);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error during authentication."
      );
      setIsLoading(false);
    }
  };

  const handleSelectDemoRole = (acc: DemoAccount) => {
    setActiveQuickRole(acc.email);
    setEmail(acc.email);
    setPassword("BrandShield2026!");
    handleLogin(undefined, acc.email, "BrandShield2026!");
  };

  return (
    <div className="w-full max-w-[460px] space-y-6">
      {/* Central Glassmorphic Card */}
      <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-800/80 rounded-2xl shadow-2xl shadow-black/60 p-6 sm:p-8 space-y-6 relative z-10 transition-all">
        {/* Card Header */}
        <div className="space-y-1.5 text-left border-b border-slate-800/80 pb-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Sign In
            </h2>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-violet-950/80 border border-violet-800/60 text-violet-300">
              <Shield className="w-3 h-3 text-violet-400" />
              SSO & Credentials
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Enter your credentials to access the BrandShield claim governance portal.
          </p>
        </div>

        {/* Dynamic Alerts */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-xs text-rose-300 animate-in fade-in duration-200"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">Authentication Error</p>
              <p className="text-[11px] text-rose-300/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in duration-200"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-4.5">
          {/* Work Email Field */}
          <div>
            <label
              htmlFor="email-address"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setActiveQuickRole(null);
                }}
                placeholder="name@dermaglow.com"
                className="w-full h-11 pl-10 pr-4 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-slate-900/90 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="user-password"
                className="block text-xs font-semibold text-slate-300"
              >
                Password
              </label>
              <a
                href="#forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  alert("For password reset in production, contact your workspace administrator at admin@dermaglow.com.");
                }}
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors focus:outline-none focus:underline"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="user-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 pl-10 pr-11 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-slate-900/90 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Session & Security Row */}
          <div className="flex items-center justify-between pt-0.5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-violet-600 focus:ring-violet-500/30 accent-violet-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors">
                Remember this device
              </span>
            </label>
            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
              <KeyRound className="w-3 h-3 text-violet-400" />
              256-bit TLS
            </span>
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 px-4 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:via-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
              Evaluator Quick Access
            </span>
          </div>
        </div>

        {/* Evaluator Fast Access Roles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between pb-1 text-[11px] text-slate-400">
            <span>Select a pre-verified reviewer profile:</span>
            <span className="text-[10px] text-violet-400 font-mono flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              1-Click Sign In
            </span>
          </div>

          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = activeQuickRole === acc.email;
              const accentBorder =
                acc.accent === "violet"
                  ? "border-violet-500/40 bg-violet-950/20"
                  : acc.accent === "cyan"
                  ? "border-cyan-500/40 bg-cyan-950/20"
                  : "border-emerald-500/40 bg-emerald-950/20";

              const badgeColor =
                acc.accent === "violet"
                  ? "bg-violet-950/80 text-violet-300 border-violet-800/60"
                  : acc.accent === "cyan"
                  ? "bg-cyan-950/80 text-cyan-300 border-cyan-800/60"
                  : "bg-emerald-950/80 text-emerald-300 border-emerald-800/60";

              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSelectDemoRole(acc)}
                  className={`w-full p-2.5 sm:p-3 rounded-xl border text-left transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50 ${
                    isSelected
                      ? `${accentBorder} shadow-sm shadow-violet-900/20`
                      : "bg-slate-950/50 hover:bg-slate-800/50 border-slate-800/80 hover:border-slate-700/80"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                        {acc.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${badgeColor}`}
                      >
                        {acc.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {acc.role} · <span className="font-mono text-slate-500">{acc.email}</span>
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/60 flex items-center justify-center text-violet-300">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-violet-600 group-hover:border-violet-500 transition-all">
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 bg-[#090D16] text-slate-100 overflow-x-hidden selection:bg-violet-500/30 selection:text-white">
      {/* Ambient background glows matching Figma design tokens */}
      <div
        className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-10%] right-[15%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Brand Header */}
      <header className="flex flex-col items-center text-center space-y-3 pt-4 sm:pt-6 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/10 border border-violet-500/30 shadow-[0_0_25px_rgba(139,92,246,0.35)] flex items-center justify-center transition-transform hover:scale-105 duration-300">
          <BrandShieldLogo className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            {SITE_CONFIG.name}
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
            Marketing claims. Verified before publication against approved product evidence.
          </p>
        </div>

        {/* Tenant Workspace Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 shadow-sm">
          <Building2 className="w-3.5 h-3.5 text-violet-400" />
          <span>Tenant:</span>
          <strong className="text-white font-semibold">DermaGlow</strong>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Protected
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full flex justify-center my-6 sm:my-8">
        <Suspense
          fallback={
            <div className="w-full max-w-[460px] h-[480px] bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <span>Loading secure reviewer portal...</span>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </main>

      {/* Clean Security Footer */}
      <footer className="pb-4 text-center text-[10px] text-slate-500 space-y-1.5 relative z-10 max-w-lg">
        <div className="flex flex-wrap items-center justify-center gap-3 text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>v{SITE_CONFIG.version} · Multi-Tenant PostgreSQL RLS</span>
          </span>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <a
            href="#security"
            onClick={(e) => {
              e.preventDefault();
              alert("BrandShield AI Security: Strict session isolation, append-only audit events, and deterministic RAG verification.");
            }}
            className="hover:text-slate-300 transition-colors"
          >
            Security Specifications
          </a>
        </div>
        <p className="text-slate-600 text-[10px]">
          © 2026 BrandShield AI. All audit trails and human review decisions are cryptographically immutable.
        </p>
      </footer>
    </div>
  );
}
