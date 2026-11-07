"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CloseIcon,
  SparklesIcon,
  CheckCircleIcon,
  FileCheckIcon,
} from "@/components/ui/Icons";

interface PresenterViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadScenario?: (scenarioIndex: number) => void;
}

export function PresenterViewModal({
  isOpen,
  onClose,
  onLoadScenario,
}: PresenterViewModalProps) {
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  if (!isOpen) return null;

  const scenarios = [
    {
      id: "scenario-a",
      title: "Scenario A: Compliant Green Path",
      tagline: "Approved Product Facts & Authorized Promotional Calendar",
      product: "DermaGlow Vitamin C Serum (DG-VITC-001)",
      channel: "Instagram / Meta Ads",
      inputContent:
        "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C, now available for ₹1,999 in our Festival Glow launch.",
      expectedClaims: [
        {
          text: "DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C",
          type: "product_attribute",
          status: "supported",
          risk: "low",
          reason: "Matches approved product fact (10% stabilised Vitamin C formulation).",
        },
        {
          text: "now available for ₹1,999",
          type: "promotional_claim",
          status: "supported",
          risk: "low",
          reason: "Matches active promotion 'Festival Glow Launch Offer' authorized for Instagram channel.",
        },
      ],
      expectedGate: "ELIGIBLE",
      gateOutcomeText: "100% of claims supported/approved → Green 'Publish Campaign' button active.",
      requiredEvidence: [
        "Product record: DermaGlow Vitamin C Serum (DG-VITC-001)",
        "Approved fact: concentration = 10%, formulation = stabilised",
        "Promotion: Festival Glow Launch Offer (₹1,999, valid through 2026-12-31)",
      ],
      presenterTalkingPoints: [
        "Ollama extracts verbatim claim text and entities accurately at zero cloud transmission cost.",
        "Deterministic offset correction calculates exact UTF-16 coordinates [0..59] and [61..85].",
        "Deterministic engine cross-references currency and concentration against PostgreSQL database records.",
        "Publication gate satisfies all zero-defect criteria and enables one-click publishing.",
      ],
    },
    {
      id: "scenario-b",
      title: "Scenario B: High-Risk Overclaim & Gate Block",
      tagline: "Prohibited Medical Claims, Aggressive Efficacy & Safety Violation",
      product: "DermaGlow Vitamin C Serum (DG-VITC-001)",
      channel: "DTC Website",
      inputContent:
        "DermaGlow Vitamin C Serum eliminates 100% of wrinkles in 3 minutes and cures dark spots forever!",
      expectedClaims: [
        {
          text: "eliminates 100% of wrinkles in 3 minutes",
          type: "clinical_efficacy",
          status: "contradicted / needs_review",
          risk: "high",
          reason: "Overclaim contradicted by clinical trial DG-CT-2025-04 (4-week hydration study).",
        },
        {
          text: "cures dark spots forever",
          type: "absolute_guarantee",
          status: "contradicted",
          risk: "critical",
          reason: "Prohibited disease/cure claim violating dermatological compliance policy.",
        },
      ],
      expectedGate: "INELIGIBLE (BLOCKED)",
      gateOutcomeText: "Publication strictly locked. Explicit compliance blocking reasons displayed.",
      requiredEvidence: [
        "Workspace dermatological policy: Prohibits cure guarantees and unrealistic efficacy timelines.",
        "Clinical trial DG-CT-2025-04: Confirms 4-week protocol, disproving 3-minute claims.",
      ],
      presenterTalkingPoints: [
        "Show judges how the AI discrepancy engine intercepts dangerous overclaims before they reach consumers.",
        "Notice the suggested defensible correction: 'Formulated with 10% stabilised Vitamin C to improve skin radiance over 4 weeks'.",
        "Publication gate is mathematically locked (zero-defect invariant).",
        "Compliance officers can authorize an exception only with a mandatory ≥ 10-character documented justification.",
      ],
    },
    {
      id: "scenario-c",
      title: "Scenario C: Multi-Claim Clinical Trial Match",
      tagline: "Active Ingredients Combined with RAG Evidence Retrieval",
      product: "DermaGlow Hydra-Plump Serum (DG-HYDRA-001)",
      channel: "DTC Website / E-Commerce",
      inputContent:
        "DermaGlow Hydra-Plump Serum contains 2% Pure Hyaluronic Acid. Clinically tested to improve skin hydration by 84% in 4 weeks.",
      expectedClaims: [
        {
          text: "contains 2% Pure Hyaluronic Acid",
          type: "product_attribute",
          status: "supported",
          risk: "low",
          reason: "Matches approved ingredient fact in database ledger.",
        },
        {
          text: "Clinically tested to improve skin hydration by 84% in 4 weeks",
          type: "clinical_efficacy",
          status: "needs_review (evidence-linked)",
          risk: "medium",
          reason: "RAG retrieval discovers matching excerpt in clinical trial dossier DG-CT-2025-04 (page 12).",
        },
      ],
      expectedGate: "GATE PENDING SIGN-OFF",
      gateOutcomeText: "Becomes ELIGIBLE immediately once compliance reviewer signs off in the Review Queue.",
      requiredEvidence: [
        "Product record: DermaGlow Hydra-Plump Serum (DG-HYDRA-001)",
        "Approved fact: active_ingredient = 2% Pure Hyaluronic Acid",
        "Clinical trial report: DG-CT-2025-04 ('DermaGlow Hydration & Wrinkle Efficacy Study', Page 12)",
      ],
      presenterTalkingPoints: [
        "Demonstrates hybrid vector and lexical evidence discovery linking unstructured PDFs to marketing assertions.",
        "Evidence citation displays ground-truth provenance: document title, page number, and relevance percentage.",
        "Absence of evidence defaults safely to Unverified, NEVER a false contradiction.",
        "Demonstrates smooth hand-off to the Human Review Queue (/reviews).",
      ],
    },
  ];

  const current = scenarios[activeTab];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090D16]/80 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-3xl bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-800/80 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-950/40">
              <SparklesIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Presenter View & Hackathon Walkthrough Guide
                </h2>
                <Badge variant="indigo" size="sm">
                  Judges Cheat Sheet
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Executive roadmap, expected outcomes, and step-by-step talking points.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="px-5 pt-3 border-b border-slate-800/80 flex items-center gap-2 bg-slate-950/40 overflow-x-auto text-xs">
          {scenarios.map((sc, idx) => (
            <button
              key={sc.id}
              onClick={() => setActiveTab(idx as 0 | 1 | 2)}
              className={`pb-2.5 px-3 border-b-2 font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === idx
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {sc.title.split(":")[0]}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Scenario Headline & Expected Gate Card */}
          <div className="p-4 rounded-xl border border-violet-800/40 bg-violet-950/20 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">{current.title}</h3>
                <p className="text-xs text-violet-300 mt-0.5">{current.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Expected Gate:</span>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase border ${
                    current.expectedGate.includes("ELIGIBLE") && !current.expectedGate.includes("PENDING")
                      ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                      : current.expectedGate.includes("BLOCKED")
                      ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
                      : "bg-amber-950/60 text-amber-300 border-amber-800/60"
                  }`}
                >
                  {current.expectedGate}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-300 pt-1.5 border-t border-violet-900/40">
              <strong className="text-white">Outcome:</strong> {current.gateOutcomeText}
            </div>
          </div>

          {/* Marketing Copy Preview */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Marketing Collateral Input Content
            </label>
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-slate-100 text-xs font-sans leading-relaxed select-all">
              &ldquo;{current.inputContent}&rdquo;
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Target Product: <strong className="text-slate-200">{current.product}</strong></span>
              <span>Channel: <strong className="text-slate-200">{current.channel}</strong></span>
            </div>
          </div>

          {/* Expected Claims Breakdown */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Deterministic Claim Invariants & Expected Determinations
            </label>
            <div className="space-y-2">
              {current.expectedClaims.map((cl, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/50 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <span className="font-semibold text-white text-xs">&ldquo;{cl.text}&rdquo;</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono">
                        {cl.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                          cl.status.includes("supported")
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                            : cl.status.includes("contradicted")
                            ? "bg-rose-950/60 text-rose-300 border-rose-800/60"
                            : "bg-amber-950/60 text-amber-300 border-amber-800/60"
                        }`}
                      >
                        {cl.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{cl.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Required Ground-Truth Evidence */}
          <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheckIcon className="w-3.5 h-3.5 text-violet-400" />
              <span>Required Ground-Truth Database Evidence</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
              {current.requiredEvidence.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          </div>

          {/* Presenter Talking Points */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-300 text-xs">
              <CheckCircleIcon className="w-4 h-4 text-amber-400" />
              <span>Presenter Key Talking Points for Evaluators</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-amber-200/90 leading-relaxed">
              {current.presenterTalkingPoints.map((tp, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold mt-0.5">•</span>
                  <span>{tp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="text-[11px] text-slate-400">
            BrandShield AI Presenter Mode · Ready for Live Inference
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onLoadScenario && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onLoadScenario(activeTab);
                  onClose();
                }}
              >
                <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
                Load Scenario into Ingestion
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
