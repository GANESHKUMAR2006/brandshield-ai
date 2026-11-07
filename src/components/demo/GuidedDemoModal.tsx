"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  X,
  Sparkles,
  CheckCircle2,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface GuidedDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (presetIndex: number) => void;
}

export const SCENARIOS = [
  {
    id: 1,
    title: "Scenario A: Compliant Launch Ad (Green Path)",
    subtitle: "Valid product attribute & promotional pricing",
    badge: "100% Compliant",
    badgeColor: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]",
    description:
      "Demonstrates the standard compliant ingestion flow. The AI extraction engine identifies the active ingredient concentration (10% Vitamin C) and promotional launch price (₹1,999). Both are deterministically supported by approved database facts and active promotional registries, allowing publication once signed off.",
    inputCopy: "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C, now available for ₹1,999.",
    expectedOutcome: [
      "Extracted claims: Product Attribute (10%) and Promotional Price (₹1,999).",
      "Deterministic verification status: SUPPORTED with LOW compliance risk.",
      "Evidence linked: DermaGlow Vitamin C approved fact key + Festival Launch Offer.",
      "Publication gate: Becomes ELIGIBLE immediately upon reviewer approval.",
    ],
  },
  {
    id: 2,
    title: "Scenario B: High-Risk Overclaim & Contradiction (Gate Block)",
    subtitle: "Unauthorized discount & absolute medical guarantee",
    badge: "Blocked by Gate",
    badgeColor: "bg-rose-950/80 text-rose-300 border-rose-800/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]",
    description:
      "Demonstrates BrandShield AI's deterministic protection against brand risk. Advertised price (₹999) directly contradicts registered promotions (₹1,999), and absolute guarantee ('100% wrinkles in 3 days') triggers a Critical risk brand safety alert. Publication is strictly blocked until human compliance reviews and modifies or overrides.",
    inputCopy: "DermaGlow Vitamin C Serum guarantees 100% elimination of all wrinkles in 3 days for just ₹999!",
    expectedOutcome: [
      "Price Contradiction: ₹999 advertised vs. ₹1,999 approved promotional price.",
      "Deterministic verification status: CONTRADICTED + CRITICAL RISK.",
      "Suggested correction provided: Defensible pricing and non-absolute claim.",
      "Publication gate: STRICTLY BLOCKED; requires documented override (>=10 chars) or text modification.",
    ],
  },
  {
    id: 3,
    title: "Scenario C: Multi-Claim Clinical Dossier Alignment",
    subtitle: "Multiple claims matched to clinical trial study DG-CT-2025-04",
    badge: "Multi-Source Evidence",
    badgeColor: "bg-violet-950/80 text-violet-300 border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]",
    description:
      "Demonstrates multi-sentence extraction and clinical trial evidence citation. The system extracts three distinct claims from complex marketing copy, mapping the 8-week hydration claim directly to the approved Clinical Trial Dossier DG-CT-2025-04 with exact page and section telemetry.",
    inputCopy: "DermaGlow Vitamin C Serum is clinically formulated with 10% stabilised Vitamin C to improve skin barrier hydration after 8 weeks. Available at launch for ₹1,999.",
    expectedOutcome: [
      "Multi-claim extraction: Concentration (10%), Efficacy (8-week hydration), and Price (₹1,999).",
      "Evidence retrieval: Matched to Clinical Study DG-CT-2025-04 (Section 3.2, Efficacy Results).",
      "Deterministic verification: Fully supported with verifiable clinical trial evidence excerpt.",
      "Audit trail: Generates full provenance snapshot for regulatory disclosure.",
    ],
  },
];

export function GuidedDemoModal({ isOpen, onClose, onSelectPreset }: GuidedDemoModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<number>(1);
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const activeScenario = SCENARIOS.find((s) => s.id === activeTab) || SCENARIOS[0];

  const handleLaunchScenario = () => {
    onClose();
    if (onSelectPreset) {
      onSelectPreset(activeTab - 1);
    } else {
      router.push("/submissions");
    }
  };

  const handleResetDemoState = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("brandshield_demo_filter");
      localStorage.removeItem("brandshield_demo_active_id");
    }
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-[#0B0F19] rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in-0 zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-slate-900/60">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl text-white shadow-md shadow-violet-950/40">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                  Interactive Guide
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-semibold shadow-[0_0_6px_rgba(52,211,153,0.3)]">
                  Live PostgreSQL + Ollama
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 tracking-tight">
                BrandShield AI — Compliance Workflow Tour
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore how AI claim extraction, deterministic verification, and human governance protect brand integrity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert for Reset */}
        {resetSuccess && (
          <div className="p-3 mx-6 mt-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Local demo interface state reset! Live database records were left safely untouched.</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-800 text-xs overflow-x-auto">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`pb-2.5 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === s.id
                  ? "border-violet-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Scenario {s.id === 1 ? "A: Compliant" : s.id === 2 ? "B: Blocked Overclaim" : "C: Clinical Trial"}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Active Scenario Card */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white">{activeScenario.title}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${activeScenario.badgeColor}`}>
                {activeScenario.badge}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              {activeScenario.description}
            </p>

            {/* Input Marketing Copy Box */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Campaign Input Marketing Copy:
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 leading-relaxed shadow-inner">
                &ldquo;{activeScenario.inputCopy}&rdquo;
              </div>
            </div>

            {/* Expected Telemetry List */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Expected System Telemetry:
              </div>
              <ul className="space-y-1.5">
                {activeScenario.expectedOutcome.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stepper Flow Explanation */}
          <div className="p-4 rounded-xl border border-violet-800/40 bg-violet-950/20 text-xs">
            <div className="font-bold text-white text-xs mb-2 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>The 5-Stage BrandShield Compliance Pipeline:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-violet-300 block">1. Ingestion</span>
                <span className="text-slate-400 text-[10px]">Title, copy & channel captured with versioning.</span>
              </div>
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-violet-300 block">2. AI Extraction</span>
                <span className="text-slate-400 text-[10px]">Ollama local LLM extracts exact UTF-16 spans.</span>
              </div>
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-violet-300 block">3. Verification</span>
                <span className="text-slate-400 text-[10px]">Deterministic comparison against facts & dossiers.</span>
              </div>
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-violet-300 block">4. Human Review</span>
                <span className="text-slate-400 text-[10px]">Reviewers authorize, override, or request changes.</span>
              </div>
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-violet-300 block">5. Pub Gate</span>
                <span className="text-slate-400 text-[10px]">Campaign blocked unless 100% claims approved.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 flex-wrap gap-2 text-xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDemoState}
            className="text-slate-400 hover:text-white text-xs"
          >
            Reset Demo Filters
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close Guide
            </Button>
            <Button variant="primary" size="sm" onClick={handleLaunchScenario}>
              Launch Scenario {activeTab === 1 ? "A" : activeTab === 2 ? "B" : "C"} in Ingestion →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
