"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import {
  fetchPolicies,
  fetchPolicyById,
  createPolicy,
  activatePolicyVersion,
  archivePolicy,
  simulatePolicy,
} from "@/lib/api-client";
import { Policy, PolicyCategory, PolicySimulationResult, RuleSeverity } from "@/types";
import { formatDateTime } from "@/lib/utils/formatters";
import {
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Layers,
  Search,
  Filter,
  X,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  prohibited_claims: "Prohibited Claims",
  restricted_efficacy: "Restricted Efficacy",
  clinical_requirements: "Clinical Evidence",
  guarantee_restrictions: "Guarantee Restrictions",
  comparative_advertising: "Comparative Advertising",
  price_discount_rules: "Price & Discount Rules",
  promotion_validity: "Promotion Validity",
  required_disclaimers: "Required Disclaimers",
  mandatory_human_review: "Mandatory Review",
  product_restrictions: "Product Restrictions",
};

const SAMPLE_PRESETS = [
  {
    label: "Medical Disease Cure (Prohibited)",
    claim: "Cures eczema and permanently eliminates dermatitis within 3 days.",
    type: "efficacy",
  },
  {
    label: "Extreme Absolute Guarantee",
    claim: "Guaranteed 100% overnight dark spot eradication with miracle active botanicals.",
    type: "guarantee",
  },
  {
    label: "Comparative Superiority Claim",
    claim: "Clinical studies show our formulation is better than #1 leading dermatologist brand.",
    type: "comparative",
  },
  {
    label: "Percentage Efficacy without Clinical Dossier",
    claim: "Clinically proven 84% reduction in stubborn fine lines and wrinkles.",
    type: "efficacy",
  },
  {
    label: "Retinol Daytime Claim without SPF",
    claim: "Apply Retinol Renew Serum every morning routine for fresh radiant skin.",
    type: "product_attribute",
    productId: "00000000-0000-0000-0000-000000000101",
  },
  {
    label: "Fully Compliant Cosmetic Claim",
    claim: "Deeply hydrates and enhances skin barrier radiance. *Results may vary based on skin type.",
    type: "efficacy",
  },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "simulate">("list");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected policy for details drawer / modal
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Simulation Studio State
  const [simulationClaimText, setSimulationClaimText] = useState(SAMPLE_PRESETS[0].claim);
  const [simulationClaimType, setSimulationClaimType] = useState(SAMPLE_PRESETS[0].type);
  const [simulationProductId, setSimulationProductId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<PolicySimulationResult | null>(null);

  // New Policy Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyCode, setNewPolicyCode] = useState("");
  const [newPolicyCategory, setNewPolicyCategory] = useState<PolicyCategory>("prohibited_claims");
  const [newPolicyDesc, setNewPolicyDesc] = useState("");
  const [newPolicyPhrases, setNewPolicyPhrases] = useState("");
  const [newPolicySeverity, setNewPolicySeverity] = useState<RuleSeverity>("critical");
  const [isCreating, setIsCreating] = useState(false);

  const loadPolicies = useCallback(() => {
    fetchPolicies({
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      search: search.trim() ? search.trim() : undefined,
    })
      .then((res) => {
        setPolicies(res.data);
        setError(null);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load policies");
        setIsLoading(false);
      });
  }, [categoryFilter, statusFilter, search]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleOpenDetail = async (id: string) => {
    setIsDetailLoading(true);
    try {
      const fullPolicy = await fetchPolicyById(id);
      setSelectedPolicy(fullPolicy);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load policy details");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!simulationClaimText.trim()) return;
    setIsSimulating(true);
    try {
      const res = await simulatePolicy({
        sampleClaims: [
          {
            claim_text: simulationClaimText.trim(),
            claim_type: simulationClaimType,
            product_id: simulationProductId,
          },
        ],
      });
      setSimulationResult(res);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCreatePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyName || !newPolicyCode) return;
    setIsCreating(true);
    try {
      const phrases = newPolicyPhrases
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      await createPolicy({
        name: newPolicyName.trim(),
        code: newPolicyCode.trim().toUpperCase(),
        category: newPolicyCategory,
        description: newPolicyDesc.trim() || undefined,
        rules:
          phrases.length > 0
            ? [
                {
                  id: `RULE-${newPolicyCode.trim().toUpperCase()}-01`,
                  name: `${newPolicyName.trim()} Enforcement Rule`,
                  description: newPolicyDesc.trim() || "Automated phrase-level restriction",
                  category: newPolicyCategory,
                  severity: newPolicySeverity,
                  logic: "ANY",
                  action: newPolicySeverity === "critical" ? "flag_violation" : "require_human_review",
                  conditions: [
                    {
                      field: "claim_text",
                      operator: "contains_phrase",
                      value: phrases,
                    },
                  ],
                  mandatoryReviewerRole:
                    newPolicySeverity === "critical" ? "legal_reviewer" : "compliance_reviewer",
                  explanationTemplate: `Detected restricted phrase: {{phrase}}.`,
                },
              ]
            : [],
      });

      setShowCreateModal(false);
      setNewPolicyName("");
      setNewPolicyCode("");
      setNewPolicyPhrases("");
      setNewPolicyDesc("");
      loadPolicies();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create policy");
    } finally {
      setIsCreating(false);
    }
  };

  const handleActivateVersion = async (policyId: string, versionId: string) => {
    if (!confirm("Activate this policy version? Once active, rules become immutable.")) return;
    try {
      await activatePolicyVersion(policyId, versionId);
      loadPolicies();
      if (selectedPolicy && selectedPolicy.id === policyId) {
        handleOpenDetail(policyId);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to activate version");
    }
  };

  const handleArchivePolicy = async (policyId: string) => {
    if (!confirm("Are you sure you want to archive this policy? It will no longer evaluate active claims.")) return;
    try {
      await archivePolicy(policyId);
      loadPolicies();
      if (selectedPolicy && selectedPolicy.id === policyId) {
        setSelectedPolicy(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to archive policy");
    }
  };

  const activeCount = policies.filter((p) => p.status === "active").length;
  const productSpecificCount = policies.filter((p) => Boolean(p.product_id)).length;
  const totalRules = policies.reduce((acc, p) => acc + (p.rules_count || 0), 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]">
                Policy Intelligence Engine
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                Deterministic
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Compliance Policies & Governance Rules
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Machine-evaluable workspace policies, immutable version history, and zero-side-effect simulation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setActiveTab(activeTab === "list" ? "simulate" : "list")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "simulate"
                  ? "bg-violet-950/80 text-violet-300 border-violet-800/60 shadow-lg shadow-violet-950/40"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              {activeTab === "simulate" ? "View Policy Registry" : "Open Simulation Studio"}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md shadow-violet-950/40 border border-violet-500/30 transition-all cursor-pointer"
            >
              + Create Policy
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Policies</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">{activeCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1 font-medium">Currently enforced</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product Policies</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">{productSpecificCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Product-specific overrides</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine Rules</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">{totalRules}</div>
            <div className="text-[11px] text-violet-400 mt-1 font-medium">Deterministic evaluations</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Standard</div>
            <div className="text-sm font-bold text-white mt-2 truncate">DermaGlow Baseline v1</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Immutable triggered ledger</div>
          </div>
        </div>

        {activeTab === "simulate" ? (
          /* ========================================================================
             SIMULATION STUDIO
             ======================================================================== */
          <div className="space-y-6">
            <div className="rounded-xl border border-violet-800/50 bg-gradient-to-r from-violet-950/30 via-slate-900/60 to-slate-900/40 backdrop-blur-md p-5 shadow-xl">
              <div className="pb-3 border-b border-violet-900/40">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Policy Simulation Studio (Zero Side Effects)
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Test sample marketing copy against active workspace policies. Absolutely no database mutations, no review decisions, and no audit trail emissions occur during simulation.
                </p>
              </div>

              <div className="pt-4 space-y-4">
                {/* Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Select a sample test preset:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSimulationClaimText(preset.claim);
                          setSimulationClaimType(preset.type);
                          setSimulationProductId(preset.productId || null);
                          setSimulationResult(null);
                        }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-violet-500 text-slate-200 transition-all cursor-pointer shadow-inner"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Marketing Claim Text to Test
                    </label>
                    <textarea
                      rows={3}
                      value={simulationClaimText}
                      onChange={(e) => setSimulationClaimText(e.target.value)}
                      placeholder="e.g. Cures eczema and eliminates dark spots within 24 hours..."
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Claim Category
                      </label>
                      <select
                        value={simulationClaimType}
                        onChange={(e) => setSimulationClaimType(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
                      >
                        <option value="efficacy">Efficacy</option>
                        <option value="guarantee">Guarantee</option>
                        <option value="comparative">Comparative</option>
                        <option value="discount">Discount / Pricing</option>
                        <option value="ingredient">Ingredient / Attribute</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Target Product (Optional)
                      </label>
                      <select
                        value={simulationProductId || ""}
                        onChange={(e) => setSimulationProductId(e.target.value || null)}
                        className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
                      >
                        <option value="">Workspace-Wide (No Product Override)</option>
                        <option value="00000000-0000-0000-0000-000000000101">
                          DG-RET-01 (Retinol Renew Serum 0.5%)
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating || !simulationClaimText.trim()}
                    className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md shadow-violet-950/40 border border-violet-500/30 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSimulating ? "Evaluating Rules..." : "Run Policy Simulation"}
                  </button>
                </div>
              </div>
            </div>

            {/* Simulation Results Display */}
            {simulationResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl">
                <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Simulation Outcome & Rule Evaluation Breakdown
                  </h3>
                  <span className="text-xs text-slate-400">
                    Evaluated {simulationResult.evaluatedClaimsCount} claim(s)
                  </span>
                </div>
                <div className="pt-4 space-y-4">
                  {simulationResult.claimResults.map((res, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {res.complianceStatus === "compliant" && (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                              COMPLIANT
                            </span>
                          )}
                          {res.complianceStatus === "review_required" && (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                              REVIEW REQUIRED
                            </span>
                          )}
                          {res.complianceStatus === "non_compliant" && (
                            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                              NON-COMPLIANT
                            </span>
                          )}

                          {res.maxSeverity && (
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded uppercase ${
                                res.maxSeverity === "critical"
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/80"
                                  : res.maxSeverity === "high"
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {res.maxSeverity} Severity
                            </span>
                          )}
                        </div>

                        {res.mandatoryReviewerRoles.length > 0 && (
                          <div className="text-xs text-slate-400">
                            Mandatory Signoff:{" "}
                            <span className="font-semibold text-white">
                              {res.mandatoryReviewerRoles.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-white bg-slate-900 p-3 rounded-lg border border-slate-800">
                        &ldquo;{res.claimText}&rdquo;
                      </div>

                      <div className="text-xs text-slate-300 font-medium">
                        {res.summary}
                      </div>

                      {/* Triggered Rules */}
                      {res.triggeredRules.length > 0 ? (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Triggered Compliance Rules ({res.triggeredRules.length})
                          </div>
                          {res.triggeredRules.map((tr, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">
                                  [{tr.policyCode}] {tr.ruleName}
                                </span>
                                <span className="font-mono text-cyan-300 text-[11px]">
                                  v{tr.policyVersionNumber}
                                </span>
                              </div>
                              <div className="text-slate-300">{tr.explanation}</div>
                              {tr.matchedConditions.length > 0 && (
                                <div className="text-[11px] text-violet-300 font-mono bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                  Matched telemetry: {tr.matchedConditions.join("; ")}
                                </div>
                              )}
                              {tr.suggestedCorrection && (
                                <div className="text-emerald-300 font-medium bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/50">
                                  Correction recommendation: {tr.suggestedCorrection}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          No policy rule violations detected. Claim conforms with baseline workspace compliance standards.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================
             POLICY LIST & REGISTRY
             ======================================================================== */
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-3 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800/80 shadow-lg flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="w-full md:w-80 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search code, name, or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                >
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                    <option key={cat} value={cat}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="draft">Draft Only</option>
                  <option value="archived">Archived Only</option>
                </select>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Policies Grid */}
            {isLoading ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading compliance policies...
              </div>
            ) : policies.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/60">
                <ShieldAlert className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <div className="text-sm font-semibold text-white">No policies found</div>
                <div className="text-xs text-slate-400 mt-1">Try clearing filters or create a new policy.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {policies.map((policy) => (
                  <div key={policy.id} className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                          {policy.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {policy.status === "active" ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-[0_0_6px_rgba(52,211,153,0.3)]">
                              ACTIVE (v{policy.active_version_number || 1})
                            </span>
                          ) : policy.status === "draft" ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60">
                              DRAFT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              ARCHIVED
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">
                        {policy.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {policy.description || "No description provided."}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                        <span>
                          Category: <strong className="text-slate-200">{CATEGORY_LABELS[policy.category] || policy.category}</strong>
                        </span>
                        <span>
                          Rules: <strong className="text-white">{policy.rules_count || 0}</strong>
                        </span>
                      </div>

                      <div className="text-xs text-slate-400">
                        Applicability:{" "}
                        {policy.product_name ? (
                          <span className="text-amber-400 font-semibold">{policy.product_name}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">Workspace-Wide Standard</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleOpenDetail(policy.id)}
                          className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect Rules & Versions</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-2">
                          {policy.status !== "archived" && (
                            <button
                              onClick={() => handleArchivePolicy(policy.id)}
                              className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Policy Detail / Version History Drawer */}
        {selectedPolicy && (
          <div className="fixed inset-0 z-50 bg-[#090D16]/80 backdrop-blur-md flex justify-end">
            <div className="w-full max-w-2xl bg-[#0B0F19] h-full shadow-2xl p-6 overflow-y-auto space-y-6 text-slate-100 border-l border-slate-800">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                      {selectedPolicy.code}
                    </span>
                    <span className="text-xs text-slate-400">
                      {CATEGORY_LABELS[selectedPolicy.category] || selectedPolicy.category}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">{selectedPolicy.name}</h2>
                  {isDetailLoading && (
                    <span className="text-[11px] text-violet-400 font-medium">Refreshing details...</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                {selectedPolicy.description}
              </div>

              {/* Version History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Immutable Version History ({selectedPolicy.versions?.length || 1})
                  </h3>
                </div>

                <div className="space-y-3">
                  {(selectedPolicy.versions || [selectedPolicy.active_version]).filter(Boolean).map((v) => (
                    <div
                      key={v!.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        v!.status === "active"
                          ? "border-emerald-800/60 bg-emerald-950/20"
                          : v!.status === "draft"
                          ? "border-amber-800/60 bg-amber-950/20"
                          : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">Version {v!.version_number}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              v!.status === "active"
                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                                : v!.status === "draft"
                                ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {v!.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateTime(v!.created_at)}
                        </div>
                      </div>

                      <div className="text-slate-300">{v!.description || "Standard policy ruleset"}</div>

                      {/* Rules in this version */}
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-300">
                          Evaluated Rules ({v!.rules.length}):
                        </div>
                        {v!.rules.map((r, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{r.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-900 text-slate-300 border border-slate-700">
                                {r.severity}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px]">{r.description}</div>
                            {r.mandatoryReviewerRole && (
                              <div className="text-[10px] text-violet-300 font-semibold">
                                Required Reviewer: {r.mandatoryReviewerRole}
                              </div>
                            )}
                            {r.requiredEvidenceTypes && r.requiredEvidenceTypes.length > 0 && (
                              <div className="text-[10px] text-cyan-300 font-semibold">
                                Required Evidence: {r.requiredEvidenceTypes.join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {v!.status === "draft" && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleActivateVersion(selectedPolicy.id, v!.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
                          >
                            Activate This Version
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Policy Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-[#090D16]/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0B0F19] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-700/80 text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Create New Compliance Policy</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePolicySubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Policy Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Comparative Clinical Efficacy Requirement"
                    value={newPolicyName}
                    onChange={(e) => setNewPolicyName(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Policy Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. POL-DERMA-010"
                      value={newPolicyCode}
                      onChange={(e) => setNewPolicyCode(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono uppercase focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Category</label>
                    <select
                      value={newPolicyCategory}
                      onChange={(e) => setNewPolicyCategory(e.target.value as PolicyCategory)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                        <option key={cat} value={cat}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Rule Severity</label>
                    <select
                      value={newPolicySeverity}
                      onChange={(e) => setNewPolicySeverity(e.target.value as RuleSeverity)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Document regulatory purpose and compliance rationale..."
                    value={newPolicyDesc}
                    onChange={(e) => setNewPolicyDesc(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Restricted Phrases (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. instant cure, 100% eradication, treats acne"
                    value={newPolicyPhrases}
                    onChange={(e) => setNewPolicyPhrases(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Any matching phrase in extracted marketing claims will trigger this rule.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isCreating ? "Saving Draft..." : "Create Policy Draft"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
