"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  fetchOnboardingStatus,
  fetchProducts,
  OnboardingStatusResponse,
  LiveProduct,
} from "@/lib/api-client";
import { RegisterProductModal } from "@/components/products/RegisterProductModal";
import { UploadEvidenceModal } from "@/components/sources/UploadEvidenceModal";
import { CreatePromotionModal } from "@/components/promotions/CreatePromotionModal";
import { InviteMemberModal } from "@/components/workspace/InviteMemberModal";
import { CreateSubmissionModal } from "@/components/submissions/CreateSubmissionModal";
import {
  Compass,
  CheckCircle2,
  Circle,
  ArrowRight,
  Building2,
  Users,
  PackagePlus,
  UploadCloud,
  Tag,
  ShieldCheck,
  FileCheck2,
  Sparkles,
  RefreshCw,
  Sliders,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

export default function OnboardingPage() {
  const [statusData, setStatusData] = useState<OnboardingStatusResponse | null>(null);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [status, prods] = await Promise.all([
        fetchOnboardingStatus(),
        fetchProducts().catch(() => []),
      ]);
      setStatusData(status);
      setProducts(prods);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load onboarding status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStepIcon = (id: string) => {
    switch (id) {
      case "create_workspace":
        return <Building2 className="w-5 h-5 text-violet-400" />;
      case "configure_details":
        return <Sliders className="w-5 h-5 text-violet-400" />;
      case "invite_team":
        return <Users className="w-5 h-5 text-cyan-400" />;
      case "register_products":
        return <PackagePlus className="w-5 h-5 text-emerald-400" />;
      case "upload_evidence":
        return <UploadCloud className="w-5 h-5 text-cyan-400" />;
      case "create_promotions":
        return <Tag className="w-5 h-5 text-amber-400" />;
      case "configure_policies":
        return <ShieldCheck className="w-5 h-5 text-purple-400" />;
      case "submit_content":
        return <FileCheck2 className="w-5 h-5 text-pink-400" />;
      case "extract_claims":
        return <Sparkles className="w-5 h-5 text-indigo-400" />;
      case "verify_claims":
      default:
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getStepAction = (step: NonNullable<typeof statusData>["steps"][0]) => {
    if (step.completed) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    }

    switch (step.id) {
      case "invite_team":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsInviteModalOpen(true)}
            className="cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            Invite Member
          </Button>
        );
      case "register_products":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsProductModalOpen(true)}
            className="cursor-pointer"
          >
            Register Product
          </Button>
        );
      case "upload_evidence":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsEvidenceModalOpen(true)}
            className="cursor-pointer"
          >
            Upload Evidence
          </Button>
        );
      case "create_promotions":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPromoModalOpen(true)}
            className="cursor-pointer bg-amber-600 hover:bg-amber-500 text-white"
          >
            Create Promotion
          </Button>
        );
      case "configure_policies":
        return (
          <Link href="/policies">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Open Policy Studio <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        );
      case "submit_content":
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmissionModalOpen(true)}
            className="cursor-pointer"
          >
            New Submission
          </Button>
        );
      case "extract_claims":
      case "verify_claims":
        return (
          <Link href="/submissions">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Verify in Submissions <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        );
      case "configure_details":
        return (
          <Link href="/settings">
            <Button variant="outline" size="sm" className="cursor-pointer">
              Settings <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        );
      default:
        return null;
    }
  };

  const progress = statusData?.progress;
  const workspace = statusData?.workspace;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
              Tenant Onboarding Workflow
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-violet-400" />
            Organization Governance Activation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            10-step self-service setup for <strong className="text-white">{workspace?.name || "your organization"}</strong> ({workspace?.slug || "workspace"}).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Status
          </Button>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Console Dashboard <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Progress Card */}
      {statusData && (
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/90 via-[#0B0F19] to-violet-950/20 p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Governance Readiness Progress
                </span>
                <Badge
                  variant={progress?.isFullyOnboarded ? "success" : "neutral"}
                  size="sm"
                >
                  {progress?.isFullyOnboarded ? "Fully Activated" : "In Progress"}
                </Badge>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
                {progress?.completedCount} of {progress?.totalSteps} Milestones Completed
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                {progress?.isFullyOnboarded
                  ? "Your organization workspace is fully configured with products, evidence, promotions, and claim verification capabilities."
                  : "Complete the remaining stages below to enable automated marketing claim extraction, clinical evidence linking, and deterministic verification."}
              </p>
            </div>

            <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6 shrink-0">
              <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-300">
                {progress?.percentage}%
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                Onboarding Health
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-800/80 rounded-full mt-5 overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
              style={{ width: `${progress?.percentage ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* 10 Milestone Cards */}
      <div className="space-y-3">
        {statusData?.steps.map((st) => (
          <div
            key={st.id}
            className={`rounded-xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              st.completed
                ? "bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80"
                : "bg-slate-900/80 border-violet-900/40 shadow-lg shadow-violet-950/10 hover:border-violet-700/60"
            }`}
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  st.completed
                    ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                    : "bg-slate-800/80 border-slate-700 text-slate-300"
                }`}
              >
                {st.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <span className="font-mono text-xs font-bold text-slate-300">
                    {st.step}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {st.step}. {st.title}
                  </h3>
                  <div className="p-1 rounded bg-slate-800/60 border border-slate-700/60">
                    {getStepIcon(st.id)}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {st.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
              {getStepAction(st)}
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      <RegisterProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <UploadEvidenceModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <CreatePromotionModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        onSuccess={() => loadData()}
        products={products}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        workspaceId={workspace?.id || ""}
        onClose={() => setIsInviteModalOpen(false)}
        onInvited={() => loadData()}
      />

      <CreateSubmissionModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        onSuccess={() => loadData()}
        products={products}
      />
    </AppLayout>
  );
}
