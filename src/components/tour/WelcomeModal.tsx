"use client";

import React from "react";
import { useTour } from "./TourContext";
import { ROLE_TOUR_CONFIGS } from "@/lib/tour/tour-config";
import {
  ShieldCheck,
  Sparkles,
  ArrowRight,
  X,
  FileCheck2,
  Users,
  CheckCircle2,
  Layers,
  Scale,
  Compass,
} from "lucide-react";

export function WelcomeModal() {
  const { isWelcomeOpen, closeWelcome, startRoleTour, userRole, userName, userEmail } = useTour();

  if (!isWelcomeOpen) return null;

  const roleConfig = ROLE_TOUR_CONFIGS[userRole] || ROLE_TOUR_CONFIGS.viewer;

  const getRoleIcon = () => {
    switch (userRole) {
      case "admin":
        return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case "compliance_reviewer":
        return <CheckCircle2 className="w-5 h-5 text-cyan-400" />;
      case "legal_reviewer":
        return <Scale className="w-5 h-5 text-amber-400" />;
      case "creator":
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
      case "viewer":
      default:
        return <Users className="w-5 h-5 text-slate-300" />;
    }
  };

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case "admin":
        return "bg-purple-950/80 text-purple-300 border-purple-800/60";
      case "compliance_reviewer":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800/60";
      case "legal_reviewer":
        return "bg-amber-950/80 text-amber-300 border-amber-800/60";
      case "creator":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800/60";
      case "viewer":
      default:
        return "bg-slate-800/80 text-slate-300 border-slate-700/60";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-[#0B0F19]/95 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
      >
        {/* Glow ambient background accents */}
        <div className="absolute top-0 right-1/4 w-72 h-36 bg-violet-600/15 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-36 bg-cyan-600/15 rounded-full blur-[80px] pointer-events-none" />

        {/* Modal Header */}
        <div className="relative px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 via-indigo-600/20 to-cyan-500/10 border border-violet-500/30 flex items-center justify-center text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
              <Compass className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 id="welcome-modal-title" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Welcome to BrandShield AI</span>
                <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  Interactive Guide
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic Marketing Claim Governance & Evidence Reconciliation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeWelcome}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
            aria-label="Close welcome modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative px-6 py-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* User Role Card */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400">Signed in as:</p>
                <p className="font-semibold text-white text-sm">
                  {userName} {userEmail ? `(${userEmail})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${getRoleBadgeColor()}`}>
                  {getRoleIcon()}
                  <span>{roleConfig.roleDisplayName}</span>
                </span>
              </div>
            </div>

            <p className="mt-3 text-slate-300 leading-relaxed font-normal">
              {roleConfig.workflowSummary}
            </p>
          </div>

          {/* Role Responsibilities */}
          <div>
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              <span>Your Role Responsibilities:</span>
            </h3>
            <ul className="space-y-1.5 pl-1">
              {roleConfig.responsibilities.map((resp, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5 shadow-[0_0_4px_#22d3ee]" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 5-Step Workflow Overview */}
          <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>The BrandShield Core Lifecycle:</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px] text-slate-300 pt-1">
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-violet-400 block mb-0.5">1. Copy Ingestion</span>
                Draft marketing copy or campaign creative
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-cyan-400 block mb-0.5">2. Claim Extraction</span>
                AI isolates quantifiable assertions
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-purple-400 block mb-0.5">3. Fact Grounding</span>
                Reconciles with clinical study dossiers
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-amber-400 block mb-0.5">4. Review Queue</span>
                Human sign-off on flagged claims
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-0.5">5. Publication Gate</span>
                Only verified claims clear to publish
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={closeWelcome}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-2 px-3 text-left sm:text-center cursor-pointer"
          >
            Explore on My Own (Skip)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startRoleTour()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-violet-950/50 cursor-pointer w-full sm:w-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Start {roleConfig.roleDisplayName} Tour</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
