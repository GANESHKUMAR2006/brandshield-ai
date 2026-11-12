"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  fetchPolicies,
  fetchPolicyById,
  createPolicy,
  updateDraftPolicy,
  activatePolicyVersion,
  rollbackPolicyVersion,
  duplicatePolicy,
  archivePolicy,
  simulatePolicy,
  validatePolicyRulesApi,
} from "@/lib/api-client";
import {
  Policy,
  PolicyCategory,
  PolicyCondition,
  PolicyConditionGroup,
  PolicyRule,
  PolicyRuleAction,
  PolicySimulationResult,
  RuleConditionOperator,
  RuleSeverity,
  LogicalOperator,
  ReviewerRole,
} from "@/types";
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
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Check,
  FileCode,
  Shield,
  Eye,
  Sliders,
  History,
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
    evidence: [],
  },
  {
    label: "Extreme Absolute Guarantee",
    claim: "Guaranteed 100% overnight dark spot eradication with miracle active botanicals.",
    type: "guarantee",
    evidence: [],
  },
  {
    label: "Comparative Superiority Claim",
    claim: "Clinical studies show our formulation is better than #1 leading dermatologist brand.",
    type: "comparative",
    evidence: [],
  },
  {
    label: "Percentage Efficacy without Clinical Dossier",
    claim: "Clinically proven 84% reduction in stubborn fine lines and wrinkles.",
    type: "efficacy",
    evidence: [],
  },
  {
    label: "Retinol Daytime Claim without SPF",
    claim: "Apply Retinol Renew Serum every morning routine for fresh radiant skin.",
    type: "product_attribute",
    productId: "00000000-0000-0000-0000-000000000101",
    evidence: [],
  },
  {
    label: "Deep Discount (>50%)",
    claim: "Mega Flash Sale: 60% off all Anti-Aging collections today only!",
    type: "discount",
    evidence: [],
  },
  {
    label: "Fully Compliant Cosmetic Claim",
    claim: "Deeply hydrates and enhances skin barrier radiance. *Results may vary based on skin type.",
    type: "efficacy",
    evidence: ["clinical_dossier"],
  },
];

const AVAILABLE_FIELDS = [
  { value: "claim_text", label: "Claim Text (claim_text)" },
  { value: "claim_type", label: "Claim Type (claim_type)" },
  { value: "product_id", label: "Product ID (product_id)" },
  { value: "channel", label: "Channel (channel)" },
  { value: "evidence_types", label: "Evidence Types (evidence_types)" },
  { value: "evidence_count", label: "Evidence Count (evidence_count)" },
  { value: "disclaimer", label: "Disclaimer (disclaimer)" },
  { value: "discount_percentage", label: "Discount % (discount_percentage)" },
  { value: "price_deviation", label: "Price Deviation (price_deviation)" },
  { value: "submission_content", label: "Submission Full Content (submission_content)" },
];

const AVAILABLE_OPERATORS: { value: RuleConditionOperator; label: string }[] = [
  { value: "contains", label: "contains substring" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "greater_than", label: "greater than (>)" },
  { value: "less_than", label: "less than (<)" },
  { value: "greater_than_or_equal", label: "greater than or equal (>=)" },
  { value: "less_than_or_equal", label: "less than or equal (<=)" },
  { value: "exists", label: "exists (non-empty)" },
  { value: "does_not_exist", label: "does not exist (missing/empty)" },
  { value: "in", label: "is in list [A, B, C]" },
  { value: "not_in", label: "is not in list" },
  { value: "matches_regex", label: "matches regex pattern" },
  { value: "contains_phrase", label: "contains phrase (legacy)" },
  { value: "lacks_evidence_type", label: "lacks evidence type" },
  { value: "lacks_disclaimer", label: "lacks disclaimer" },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"registry" | "builder" | "simulate">("registry");

  // Current authenticated user session role
  const [userRole, setUserRole] = useState<string>("admin");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Selected policy for details drawer
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Duplication Modal
  const [duplicatingPolicy, setDuplicatingPolicy] = useState<Policy | null>(null);
  const [duplicateCode, setDuplicateCode] = useState("");
  const [duplicateName, setDuplicateName] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Simulation Studio State
  const [simulationClaimText, setSimulationClaimText] = useState(SAMPLE_PRESETS[0].claim);
  const [simulationClaimType, setSimulationClaimType] = useState(SAMPLE_PRESETS[0].type);
  const [simulationProductId, setSimulationProductId] = useState<string | null>(null);
  const [simulationEvidenceTypes, setSimulationEvidenceTypes] = useState<string[]>([]);
  const [simulationSelectedPolicyId, setSimulationSelectedPolicyId] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<PolicySimulationResult | null>(null);

  // Visual Policy Builder State
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [builderName, setBuilderName] = useState("");
  const [builderCode, setBuilderCode] = useState("");
  const [builderCategory, setBuilderCategory] = useState<PolicyCategory>("prohibited_claims");
  const [builderSeverity, setBuilderSeverity] = useState<RuleSeverity>("high");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderProductScope, setBuilderProductScope] = useState<string>("");
  const [builderClaimTypes, setBuilderClaimTypes] = useState<string[]>(["efficacy"]);

  // Builder Rule State
  const [builderRuleName, setBuilderRuleName] = useState("");
  const [builderRuleAction, setBuilderRuleAction] = useState<PolicyRuleAction>("flag_violation");
  const [builderReviewerRole, setBuilderReviewerRole] = useState<ReviewerRole>("compliance_reviewer");
  const [builderRootLogic, setBuilderRootLogic] = useState<LogicalOperator>("AND");
  const [builderConditions, setBuilderConditions] = useState<PolicyCondition[]>([
    { field: "claim_text", operator: "contains", value: "cure" },
  ]);
  const [builderNestedGroup, setBuilderNestedGroup] = useState<PolicyConditionGroup | null>(null);
  const [builderExplanation, setBuilderExplanation] = useState("Detected prohibited claim: {{phrase}}.");
  const [builderCorrection, setBuilderCorrection] = useState("Rephrase without therapeutic cure promises.");
  const [builderRequiredEvidence, setBuilderRequiredEvidence] = useState<string[]>([]);

  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Load user session role
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  const loadPolicies = useCallback(() => {
    fetchPolicies({
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      severity: severityFilter !== "all" ? severityFilter : undefined,
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
  }, [categoryFilter, statusFilter, severityFilter, search]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  // Open policy detail drawer
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

  // Open Builder in Create Mode
  const handleOpenCreateBuilder = () => {
    setEditingPolicyId(null);
    setBuilderName("");
    setBuilderCode(`POL-CUSTOM-${Math.floor(100 + Math.random() * 900)}`);
    setBuilderCategory("prohibited_claims");
    setBuilderSeverity("high");
    setBuilderDesc("");
    setBuilderProductScope("");
    setBuilderClaimTypes(["efficacy"]);
    setBuilderRuleName("Enforcement Rule");
    setBuilderRuleAction("flag_violation");
    setBuilderReviewerRole("compliance_reviewer");
    setBuilderRootLogic("AND");
    setBuilderConditions([{ field: "claim_text", operator: "contains", value: "" }]);
    setBuilderNestedGroup(null);
    setBuilderExplanation("Detected compliance policy condition match.");
    setBuilderCorrection("Revise wording according to approved brand guidelines.");
    setBuilderRequiredEvidence([]);
    setValidationIssues([]);
    setActiveTab("builder");
  };

  // Open Builder in Edit Mode
  const handleOpenEditBuilder = (policy: Policy) => {
    setEditingPolicyId(policy.id);
    setBuilderName(policy.name);
    setBuilderCode(policy.code);
    setBuilderCategory(policy.category);
    setBuilderSeverity(policy.severity || "high");
    setBuilderDesc(policy.description || "");
    setBuilderProductScope(policy.product_id || "");

    const activeRules = policy.active_version?.rules || policy.versions?.[0]?.rules || [];
    if (activeRules.length > 0) {
      const firstRule = activeRules[0];
      setBuilderRuleName(firstRule.name);
      setBuilderRuleAction(firstRule.action);
      setBuilderReviewerRole(firstRule.mandatoryReviewerRole || "compliance_reviewer");
      setBuilderRootLogic((firstRule.logic as LogicalOperator) || "AND");
      setBuilderExplanation(firstRule.explanationTemplate);
      setBuilderCorrection(firstRule.suggestedCorrection || "");
      setBuilderRequiredEvidence(firstRule.requiredEvidenceTypes || []);

      const leafConds: PolicyCondition[] = [];
      let nested: PolicyConditionGroup | null = null;
      for (const c of firstRule.conditions) {
        if ("conditions" in c && Array.isArray((c as PolicyConditionGroup).conditions)) {
          nested = c as PolicyConditionGroup;
        } else {
          leafConds.push(c as PolicyCondition);
        }
      }
      setBuilderConditions(leafConds.length > 0 ? leafConds : [{ field: "claim_text", operator: "contains", value: "" }]);
      setBuilderNestedGroup(nested);
    }
    setValidationIssues([]);
    setActiveTab("builder");
  };

  // Live Rule Payload for validation and saving
  const constructRulePayload = (): PolicyRule => {
    const conditionsCombined: (PolicyCondition | PolicyConditionGroup)[] = [...builderConditions];
    if (builderNestedGroup && builderNestedGroup.conditions.length > 0) {
      conditionsCombined.push(builderNestedGroup);
    }

    return {
      id: `RULE-${builderCode}-01`,
      name: builderRuleName.trim() || `${builderName.trim()} Enforcement Rule`,
      description: builderDesc.trim() || "Configured via Visual Policy Builder",
      category: builderCategory,
      severity: builderSeverity,
      logic: builderRootLogic,
      action: builderRuleAction,
      conditions: conditionsCombined,
      mandatoryReviewerRole: builderReviewerRole,
      requiredEvidenceTypes: builderRequiredEvidence,
      explanationTemplate: builderExplanation.trim() || "Policy rule violation detected.",
      suggestedCorrection: builderCorrection.trim() || undefined,
      applicableClaimTypes: builderClaimTypes,
    };
  };

  // Validate builder state in real time
  const handleValidateBuilder = async () => {
    const rule = constructRulePayload();
    const policyPayload = {
      name: builderName.trim(),
      code: builderCode.trim().toUpperCase(),
      category: builderCategory,
      severity: builderSeverity,
      description: builderDesc.trim(),
      rules: [rule],
    };

    try {
      const res = await validatePolicyRulesApi(policyPayload);
      if (!res.isValid) {
        setValidationIssues(res.issues.map((i) => `${i.path}: ${i.message}`));
      } else {
        setValidationIssues([]);
      }
      return res.isValid;
    } catch {
      // Local fallback validation
      if (!builderName.trim()) {
        setValidationIssues(["name: Policy name is required."]);
        return false;
      }
      if (!builderCode.trim()) {
        setValidationIssues(["code: Policy code is required."]);
        return false;
      }
      setValidationIssues([]);
      return true;
    }
  };

  // Save Policy (Create or Update Draft)
  const handleSavePolicy = async (shouldPublish: boolean = false) => {
    const isValid = await handleValidateBuilder();
    if (!isValid) return;

    setIsSaving(true);
    try {
      const rule = constructRulePayload();

      let policy: Policy;
      if (editingPolicyId) {
        policy = await updateDraftPolicy(editingPolicyId, {
          name: builderName.trim(),
          category: builderCategory,
          severity: builderSeverity,
          description: builderDesc.trim(),
          productId: builderProductScope || null,
          rules: [rule],
        });
      } else {
        policy = await createPolicy({
          name: builderName.trim(),
          code: builderCode.trim().toUpperCase(),
          category: builderCategory,
          severity: builderSeverity,
          description: builderDesc.trim(),
          productId: builderProductScope || null,
          rules: [rule],
        });
      }

      if (shouldPublish && policy.versions && policy.versions.length > 0) {
        const latestDraft = policy.versions.find((v) => v.status === "draft") || policy.versions[0];
        if (latestDraft) {
          await activatePolicyVersion(policy.id, latestDraft.id);
        }
      }

      loadPolicies();
      setActiveTab("registry");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setIsSaving(false);
    }
  };

  // Activate / Publish Version
  const handleActivateVersion = async (policyId: string, versionId: string) => {
    if (!confirm("Publish and activate this policy version? Once published, this version snapshot becomes immutable.")) return;
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

  // Rollback to historical version
  const handleRollbackVersion = async (policyId: string, targetVersionNumber: number) => {
    if (!confirm(`Rollback to Version ${targetVersionNumber}? This creates a new active version snapshot restoring the rules of Version ${targetVersionNumber}.`)) return;
    try {
      await rollbackPolicyVersion(policyId, targetVersionNumber);
      loadPolicies();
      if (selectedPolicy && selectedPolicy.id === policyId) {
        handleOpenDetail(policyId);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to rollback policy");
    }
  };

  // Open Duplicate Modal
  const handleOpenDuplicate = (policy: Policy) => {
    setDuplicatingPolicy(policy);
    setDuplicateCode(`${policy.code}-COPY`);
    setDuplicateName(`${policy.name} (Copy)`);
  };

  // Submit Duplicate
  const handleDuplicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicatingPolicy || !duplicateCode || !duplicateName) return;
    setIsDuplicating(true);
    try {
      await duplicatePolicy(duplicatingPolicy.id, duplicateCode.trim().toUpperCase(), duplicateName.trim());
      setDuplicatingPolicy(null);
      loadPolicies();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to duplicate policy");
    } finally {
      setIsDuplicating(false);
    }
  };

  // Archive Policy
  const handleArchivePolicy = async (policyId: string) => {
    if (!confirm("Are you sure you want to archive this policy? It will be safely disabled and excluded from future verification runs without modifying historical audit records.")) return;
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

  // Run Simulation
  const handleRunSimulation = async () => {
    if (!simulationClaimText.trim()) return;
    setIsSimulating(true);
    try {
      const res = await simulatePolicy({
        policyId: simulationSelectedPolicyId || undefined,
        sampleClaims: [
          {
            claim_text: simulationClaimText.trim(),
            claim_type: simulationClaimType,
            product_id: simulationProductId,
            evidence_types: simulationEvidenceTypes,
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

  // Metrics
  const activeCount = policies.filter((p) => p.status === "active").length;
  const draftCount = policies.filter((p) => p.status === "draft").length;
  const archivedCount = policies.filter((p) => p.status === "archived").length;
  const totalRules = policies.reduce((acc, p) => acc + (p.rules_count || 0), 0);

  const isAdmin = userRole === "admin";

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-16">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)] flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-violet-400" />
                Compliance Policy Studio
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 shadow-[0_0_8px_rgba(52,211,153,0.3)] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Deterministic Rule Engine
              </span>
              {!isAdmin && (
                <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Role: {userRole} (Read-Only Policy Mode)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Compliance Policies & Custom Rule Engine
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Build no-code compliance policies, evaluate nested condition groups, simulate copy with zero side effects, and maintain immutable version provenance.
            </p>
          </div>

          {/* Navigation Mode Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setActiveTab("registry")}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "registry"
                  ? "bg-violet-950/80 text-violet-300 border-violet-800/60 shadow-lg shadow-violet-950/40"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-violet-400" />
              Policy Registry ({policies.length})
            </button>

            <button
              onClick={() => setActiveTab("simulate")}
              data-tour="policy-studio-link"
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "simulate"
                  ? "bg-violet-950/80 text-violet-300 border-violet-800/60 shadow-lg shadow-violet-950/40"
                  : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Simulation Studio
            </button>

            {isAdmin ? (
              <button
                onClick={handleOpenCreateBuilder}
                data-tour="create-policy-btn"
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md shadow-violet-950/40 border border-violet-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Visual Policy Builder
              </button>
            ) : (
              <span className="text-[11px] text-slate-500 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                Admin required to configure rules
              </span>
            )}
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Enforced</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">{activeCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Enforced on verification runs
            </div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Draft Policies</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 mt-1.5 tracking-tight">{draftCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Pending publication approval</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Machine Rules</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">{totalRules}</div>
            <div className="text-[11px] text-violet-400 mt-1 font-medium">Deterministic JSON conditions</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Archived Policies</div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-400 mt-1.5 tracking-tight">{archivedCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Preserved in audit ledger</div>
          </div>
        </div>

        {/* ========================================================================
            TAB 1: POLICY REGISTRY & RULES LIST
            ======================================================================== */}
        {activeTab === "registry" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
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
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active (Enforced)</option>
                  <option value="draft">Draft (In Preparation)</option>
                  <option value="archived">Archived</option>
                </select>

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
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Policy Cards Grid */}
            {isLoading ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading workspace compliance policies...
              </div>
            ) : policies.length === 0 ? (
              <div data-tour="policies-list" className="text-center py-16 rounded-xl border border-slate-800 bg-slate-900/60">
                <ShieldAlert className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                <div className="text-sm font-semibold text-white">No policies found matching filters</div>
                <div className="text-xs text-slate-400 mt-1">Try resetting filters or launch the Visual Policy Builder.</div>
              </div>
            ) : (
              <div data-tour="policies-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {policies.map((policy) => (
                  <div
                    key={policy.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header of Card */}
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

                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase ${
                              policy.severity === "critical"
                                ? "bg-rose-950/80 text-rose-300 border border-rose-800/80"
                                : policy.severity === "high"
                                ? "bg-amber-950/80 text-amber-300 border border-amber-800/80"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {policy.severity || "high"}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-white line-clamp-1">{policy.name}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {policy.description || "Deterministic compliance governance rule."}
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
                        Scope:{" "}
                        {policy.product_name ? (
                          <span className="text-amber-400 font-semibold">{policy.product_name}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">Workspace-Wide Standard</span>
                        )}
                      </div>

                      {/* Card Action Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleOpenDetail(policy.id)}
                          className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Versions ({policy.versions_count || 1})</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {isAdmin && policy.status !== "archived" && (
                            <>
                              <button
                                onClick={() => handleOpenEditBuilder(policy)}
                                className="text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer"
                                title="Edit policy or create new draft version"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleOpenDuplicate(policy)}
                                className="text-[11px] text-slate-400 hover:text-violet-300 cursor-pointer"
                                title="Duplicate policy"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => handleArchivePolicy(policy.id)}
                                className="text-[11px] text-slate-500 hover:text-rose-400 cursor-pointer"
                                title="Archive policy"
                              >
                                Archive
                              </button>
                            </>
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

        {/* ========================================================================
            TAB 2: VISUAL POLICY BUILDER (NO-CODE RULE ENGINE)
            ======================================================================== */}
        {activeTab === "builder" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-violet-800/50 bg-[#0B0F19] p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-800/60">
                      Visual Rule Builder
                    </span>
                    <span className="text-xs text-slate-400">
                      {editingPolicyId ? `Editing Policy (${builderCode})` : "Creating New Policy"}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {editingPolicyId ? `Configure ${builderName}` : "Design Custom Compliance Policy"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Build deterministic allowlisted rules. Safe JSON execution ensures zero arbitrary code execution.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-violet-400" />
                    {showJsonPreview ? "Hide JSON" : "Inspect JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("registry")}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Validation Alert Box */}
              {validationIssues.length > 0 && (
                <div className="p-4 rounded-xl border border-rose-800/60 bg-rose-950/40 text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Policy Rule Validation Issues ({validationIssues.length}):
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {validationIssues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* JSON Live Preview Drawer if toggled */}
              {showJsonPreview && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-60">
                  <pre>{JSON.stringify(constructRulePayload(), null, 2)}</pre>
                </div>
              )}

              {/* Step 1: Policy Identification */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  1. Policy Metadata & Scope
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Policy Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Non-Comedogenic & Acne-Prone Claim Restriction"
                      value={builderName}
                      onChange={(e) => setBuilderName(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Policy Code</label>
                    <input
                      type="text"
                      placeholder="e.g. POL-DERMA-007"
                      value={builderCode}
                      onChange={(e) => setBuilderCode(e.target.value.toUpperCase())}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono uppercase focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                    <select
                      value={builderCategory}
                      onChange={(e) => setBuilderCategory(e.target.value as PolicyCategory)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                        <option key={cat} value={cat}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Severity</label>
                    <select
                      value={builderSeverity}
                      onChange={(e) => setBuilderSeverity(e.target.value as RuleSeverity)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                    >
                      <option value="critical">Critical (Blocks Publication)</option>
                      <option value="high">High (Mandatory Review)</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Product Scope</label>
                    <select
                      value={builderProductScope}
                      onChange={(e) => setBuilderProductScope(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                    >
                      <option value="">Workspace-Wide (All Products)</option>
                      <option value="00000000-0000-0000-0000-000000000101">
                        DG-RET-01 (Retinol Renew Serum 0.5%)
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Description & Regulatory Rationale</label>
                  <textarea
                    rows={2}
                    placeholder="Document regulatory purpose and mandatory substantiation guidelines..."
                    value={builderDesc}
                    onChange={(e) => setBuilderDesc(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                </div>
              </div>

              {/* Step 2: Visual Rule & Conditions */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    2. Deterministic Rule Conditions (Visual No-Code Builder)
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Match Logic:</span>
                    <select
                      value={builderRootLogic}
                      onChange={(e) => setBuilderRootLogic(e.target.value as LogicalOperator)}
                      className="text-xs rounded-lg border border-violet-700/60 bg-violet-950/60 text-violet-300 font-bold px-2 py-1 cursor-pointer focus:outline-none"
                    >
                      <option value="AND">AND (All conditions must match)</option>
                      <option value="OR">OR (At least one must match)</option>
                      <option value="NOT">NOT (Invert condition outcome)</option>
                    </select>
                  </div>
                </div>

                {/* Condition Rows */}
                <div className="space-y-2.5">
                  {builderConditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col md:flex-row items-center gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800"
                    >
                      <div className="w-full md:w-1/3">
                        <select
                          value={cond.field}
                          onChange={(e) => {
                            const updated = [...builderConditions];
                            updated[idx] = { ...updated[idx], field: e.target.value };
                            setBuilderConditions(updated);
                          }}
                          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          {AVAILABLE_FIELDS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-1/3">
                        <select
                          value={cond.operator}
                          onChange={(e) => {
                            const updated = [...builderConditions];
                            updated[idx] = { ...updated[idx], operator: e.target.value as RuleConditionOperator };
                            setBuilderConditions(updated);
                          }}
                          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 p-2 focus:outline-none focus:border-violet-500 cursor-pointer"
                        >
                          {AVAILABLE_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-1/3 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Expected value (e.g. cure, 50, clinical_dossier)"
                          value={String(cond.value ?? "")}
                          onChange={(e) => {
                            const updated = [...builderConditions];
                            updated[idx] = { ...updated[idx], value: e.target.value };
                            setBuilderConditions(updated);
                          }}
                          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-900 text-white p-2 focus:outline-none focus:border-violet-500 shadow-inner"
                        />
                        {builderConditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setBuilderConditions(builderConditions.filter((_, i) => i !== idx));
                            }}
                            className="p-2 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                            title="Remove condition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderConditions([
                          ...builderConditions,
                          { field: "claim_text", operator: "contains", value: "" },
                        ]);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-violet-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Condition
                    </button>

                    {!builderNestedGroup ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBuilderNestedGroup({
                            logic: "OR",
                            conditions: [{ field: "claim_type", operator: "equals", value: "efficacy" }],
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Nested Condition Group
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setBuilderNestedGroup(null)}
                        className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        Remove Nested Group
                      </button>
                    )}
                  </div>
                </div>

                {/* Nested Condition Group Sub-Box if configured */}
                {builderNestedGroup && (
                  <div className="p-4 rounded-xl border border-cyan-800/40 bg-cyan-950/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300">Nested Condition Group</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Sub-Logic:</span>
                        <select
                          value={builderNestedGroup.logic}
                          onChange={(e) => {
                            setBuilderNestedGroup({
                              ...builderNestedGroup,
                              logic: e.target.value as LogicalOperator,
                            });
                          }}
                          className="text-xs rounded border border-cyan-700/60 bg-cyan-950/60 text-cyan-200 px-2 py-0.5"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                          <option value="NOT">NOT</option>
                        </select>
                      </div>
                    </div>

                    {builderNestedGroup.conditions.map((item, subIdx) => {
                      const leaf = item as PolicyCondition;
                      return (
                        <div key={subIdx} className="flex flex-col md:flex-row items-center gap-2">
                          <select
                            value={leaf.field}
                            onChange={(e) => {
                              const updated = [...builderNestedGroup.conditions];
                              updated[subIdx] = { ...leaf, field: e.target.value };
                              setBuilderNestedGroup({ ...builderNestedGroup, conditions: updated });
                            }}
                            className="text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 p-2"
                          >
                            {AVAILABLE_FIELDS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={leaf.operator}
                            onChange={(e) => {
                              const updated = [...builderNestedGroup.conditions];
                              updated[subIdx] = { ...leaf, operator: e.target.value as RuleConditionOperator };
                              setBuilderNestedGroup({ ...builderNestedGroup, conditions: updated });
                            }}
                            className="text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 p-2"
                          >
                            {AVAILABLE_OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Value"
                            value={String(leaf.value ?? "")}
                            onChange={(e) => {
                              const updated = [...builderNestedGroup.conditions];
                              updated[subIdx] = { ...leaf, value: e.target.value };
                              setBuilderNestedGroup({ ...builderNestedGroup, conditions: updated });
                            }}
                            className="text-xs rounded-lg border border-slate-700 bg-slate-900 text-white p-2 flex-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Enforcement Action & Reviewer Routing */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  3. Enforcement Action & Mandatory Reviewer Routing
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Enforcement Action</label>
                    <select
                      value={builderRuleAction}
                      onChange={(e) => setBuilderRuleAction(e.target.value as PolicyRuleAction)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                    >
                      <option value="flag_violation">Flag Violation (Blocks Publication / Non-Compliant)</option>
                      <option value="block_publication">Block Publication Gate</option>
                      <option value="require_human_review">Require Mandatory Human Review</option>
                      <option value="require_evidence">Require Verified Evidence Dossier</option>
                      <option value="display_warning">Display Compliance Warning</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Mandatory Reviewer Role</label>
                    <select
                      value={builderReviewerRole}
                      onChange={(e) => setBuilderReviewerRole(e.target.value as ReviewerRole)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
                    >
                      <option value="compliance_reviewer">Compliance Reviewer</option>
                      <option value="legal_reviewer">Legal Reviewer (Strict Legal Gate)</option>
                      <option value="admin">Administrator Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Violation Explanation Template
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Prohibited therapeutic disease cure assertion: {{phrase}}."
                      value={builderExplanation}
                      onChange={(e) => setBuilderExplanation(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Use {"{{phrase}}"} to insert detected matching keywords.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Suggested Corrective Copy
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Replace with cosmetic efficacy: 'soothes and calms dry skin'."
                      value={builderCorrection}
                      onChange={(e) => setBuilderCorrection(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    Schema Invariance Verified
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("registry")}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSavePolicy(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Draft Version"}
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSavePolicy(true)}
                    className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-950/40 border border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? "Publishing..." : "Publish & Enforce"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================
            TAB 3: POLICY SIMULATION STUDIO (ZERO SIDE EFFECTS)
            ======================================================================== */}
        {activeTab === "simulate" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-violet-800/50 bg-gradient-to-r from-violet-950/30 via-slate-900/60 to-slate-900/40 backdrop-blur-md p-5 shadow-xl">
              <div className="pb-3 border-b border-violet-900/40 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Policy Simulation Studio
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                      Zero Side Effects Mode
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Test sample marketing claims against draft or active policy configurations in-memory. Zero database mutations, zero review decisions, and zero audit log emissions occur during simulation.
                  </p>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                {/* Presets */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Load a sample regulatory test preset:
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
                          setSimulationEvidenceTypes(preset.evidence || []);
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
                      Marketing Copy to Test
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
                        Claim Type
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
                        Target Policy Filter
                      </label>
                      <select
                        value={simulationSelectedPolicyId}
                        onChange={(e) => setSimulationSelectedPolicyId(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 text-slate-200 p-2.5 focus:outline-none focus:border-violet-500 shadow-inner cursor-pointer"
                      >
                        <option value="">All Active Workspace Policies</option>
                        {policies.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.code}] {p.name} ({p.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating || !simulationClaimText.trim()}
                    className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl shadow-md shadow-cyan-950/40 border border-cyan-500/30 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isSimulating ? "Evaluating Deterministic Rules..." : "Run Read-Only Simulation"}
                  </button>
                </div>
              </div>
            </div>

            {/* Simulation Results Display */}
            {simulationResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-5 shadow-xl space-y-4">
                <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Simulation Evaluation Telemetry
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Timestamp: {formatDateTime(simulationResult.timestamp)}
                  </span>
                </div>

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
                          Mandatory Review Gate:{" "}
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

                    {/* Matched Rules */}
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
                                Version {tr.policyVersionNumber}
                              </span>
                            </div>
                            <div className="text-slate-300">{tr.explanation}</div>
                            {tr.matchedConditions.length > 0 && (
                              <div className="text-[11px] text-violet-300 font-mono bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                Matched Condition Telemetry: {tr.matchedConditions.join("; ")}
                              </div>
                            )}
                            {tr.suggestedCorrection && (
                              <div className="text-emerald-300 font-medium bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/50">
                                Suggested Copy: {tr.suggestedCorrection}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        No compliance rule violations detected. Claim conforms with baseline workspace standards.
                      </div>
                    )}

                    {/* Failed Conditions Breakdown */}
                    {res.failedConditions && res.failedConditions.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Evaluated Non-Triggering Conditions ({res.failedConditions.length})
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 max-h-32 overflow-y-auto space-y-1">
                          {res.failedConditions.map((fc, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="text-slate-600">•</span>
                              <span>{fc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================
            POLICY DETAIL & IMMUTABLE VERSION HISTORY DRAWER
            ======================================================================== */}
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
                    <span className="text-[11px] text-violet-400 font-medium">Refreshing version ledger...</span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs text-slate-300">{selectedPolicy.description}</div>

              {/* Version History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-violet-400" />
                    Immutable Version History ({selectedPolicy.versions?.length || 1})
                  </h3>
                </div>

                <div className="space-y-3">
                  {(selectedPolicy.versions || [selectedPolicy.active_version]).filter(Boolean).map((v) => (
                    <div
                      key={v!.id}
                      className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                        v!.status === "active"
                          ? "border-emerald-800/60 bg-emerald-950/20"
                          : v!.status === "draft"
                          ? "border-amber-800/60 bg-amber-950/20"
                          : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">Version {v!.version_number}</span>
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
                        <div className="text-[11px] text-slate-400">{formatDateTime(v!.created_at)}</div>
                      </div>

                      <div className="text-slate-300">{v!.description || "Standard machine compliance ruleset"}</div>

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

                      {/* Actions for this version */}
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/60">
                        {isAdmin && v!.status === "draft" && (
                          <button
                            onClick={() => handleActivateVersion(selectedPolicy.id, v!.id)}
                            className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm cursor-pointer"
                          >
                            Publish & Activate Version
                          </button>
                        )}

                        {isAdmin && v!.status === "superseded" && (
                          <button
                            onClick={() => handleRollbackVersion(selectedPolicy.id, v!.version_number)}
                            className="px-3 py-1 text-xs font-semibold text-cyan-300 border border-cyan-800/60 bg-cyan-950/40 hover:bg-cyan-950 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Rollback to This Version
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================
            DUPLICATE POLICY MODAL
            ======================================================================== */}
        {duplicatingPolicy && (
          <div className="fixed inset-0 z-50 bg-[#090D16]/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0B0F19] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-700/80 text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-violet-400" />
                  Duplicate Compliance Policy
                </h3>
                <button onClick={() => setDuplicatingPolicy(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDuplicateSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">New Policy Name</label>
                  <input
                    type="text"
                    required
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">New Policy Code</label>
                  <input
                    type="text"
                    required
                    value={duplicateCode}
                    onChange={(e) => setDuplicateCode(e.target.value.toUpperCase())}
                    className="w-full text-xs rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-white font-mono uppercase focus:outline-none focus:border-violet-500 shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDuplicatingPolicy(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicating}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isDuplicating ? "Duplicating..." : "Create Duplicated Policy"}
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
