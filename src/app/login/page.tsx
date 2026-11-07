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
  UserCheck,
  Building2,
  Sparkles,
} from "lucide-react";

interface DemoAccount {
  name: string;
  email: string;
  role: string;
  description: string;
  badge: string;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Dr. Elena Vance",
    email: "elena.vance@dermaglow.com",
    role: "Compliance Reviewer",
    description: "Evaluates marketing claims against clinical trial dossiers and approved facts.",
    badge: "Primary Demo",
    color: "from-violet-500/20 to-indigo-500/10 border-violet-500/30 text-violet-300",
  },
  {
    name: "Administrator",
    email: "admin@dermaglow.com",
    role: "System Admin",
    description: "Full platform permissions: workspace settings, policy governance, and audit export.",
    badge: "Admin Role",
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-300",
  },
  {
    name: "Marcus Brody, Esq.",
    email: "marcus.brody@dermaglow.com",
    role: "Legal Reviewer",
    description: "Reviews escalated claims, risk overrides, and regulatory disclosures.",
    badge: "Legal Gate",
    color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-300",
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("elena.vance@dermaglow.com");
  const [password, setPassword] = useState("BrandShield2026!");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const submitEmail = customEmail || email;
    const submitPassword = customPass || password;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submitEmail, password: submitPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Authentication failed. Please verify credentials.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage(`Authenticated as ${data.user.name || submitEmail}. Redirecting...`);

      // Refresh router and navigate to destination
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error during authentication.");
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword("BrandShield2026!");
    handleLogin(undefined, acc.email, "BrandShield2026!");
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Login Card */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-violet-950/20">
        <div className="space-y-1 mb-6">
          <h2 className="text-xl font-bold text-white tracking-tight">Reviewer Sign In</h2>
          <p className="text-xs text-slate-400">
            Sign in to access marketing claim verification, evidence dossiers, and review gates.
          </p>
        </div>

        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Authentication Error</p>
              <p className="text-[11px] text-rose-300/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Credential Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="email-input">
              Work Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reviewer@dermaglow.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="password-input">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to BrandShield</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Evaluator & Demo Accounts */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-white">Evaluator Quick Sign-In</span>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
            1-Click Access
          </span>
        </div>

        <p className="text-[11px] text-slate-400">
          Select a verified role to instantly log in with pre-configured tenant permissions:
        </p>

        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              disabled={isLoading}
              onClick={() => selectDemoAccount(acc)}
              className="w-full p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 hover:border-violet-500/40 text-left transition-all flex items-center justify-between group cursor-pointer disabled:opacity-50"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors">
                    {acc.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {acc.role}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{acc.email}</p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 text-xs text-violet-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                <span className="text-[11px] hidden sm:inline">Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 sm:p-6 bg-[#090D16] text-slate-100 overflow-hidden">
      {/* Ambient background glows */}
      <div
        className="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-1/4 w-[450px] h-[450px] bg-cyan-600/8 rounded-full blur-[150px] pointer-events-none"
        aria-hidden="true"
      />

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-3 mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/10 border border-violet-500/30 shadow-[0_0_25px_rgba(139,92,246,0.35)] flex items-center justify-center">
          <BrandShieldLogo className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            {SITE_CONFIG.name}
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Marketing claims. Verified before publication against approved product evidence.
          </p>
        </div>

        {/* Tenant Workspace Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
          <Building2 className="w-3.5 h-3.5 text-violet-400" />
          <span>Tenant:</span>
          <strong className="text-white">DermaGlow</strong>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Protected
          </span>
        </div>
      </div>

      {/* Main Content with Suspense for useSearchParams */}
      <div className="relative z-10 w-full flex justify-center">
        <Suspense
          fallback={
            <div className="w-full max-w-md p-10 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-violet-400" />
              Loading security portal...
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      {/* Footer Info */}
      <footer className="mt-8 text-center text-[10px] text-slate-500 space-y-1 relative z-10">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-cyan-400" />
          <span>v{SITE_CONFIG.version} · Multi-Tenant PostgreSQL Row Level Security (RLS)</span>
        </p>
        <p>© 2026 BrandShield AI. All audit logs and verification decisions are cryptographically immutable.</p>
      </footer>
    </div>
  );
}
