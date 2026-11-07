"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Badge } from "@/components/ui/Badge";
import { formatPercent } from "@/lib/utils/formatters";
import { LiveClaimRecord, fetchClaims, verifyClaim } from "@/lib/api-client";
import { ClaimDetailModal } from "@/components/claims/ClaimDetailModal";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

const riskBadgeMap: Record<string, "danger" | "warning" | "default" | "success"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<LiveClaimRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected claim for detail modal
  const [selectedClaim, setSelectedClaim] = useState<LiveClaimRecord | null>(null);

  const loadClaims = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchClaims();
      setClaims(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load claims");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInlineVerify = async (claimId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setVerifyingId(claimId);
    setError(null);
    try {
      await verifyClaim(claimId);
      await loadClaims();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchClaims()
      .then((data) => {
        if (isMounted) {
          setClaims(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load claims");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (typeFilter !== "all" && claim.claim_type !== typeFilter) return false;
      if (statusFilter !== "all" && claim.verification_status !== statusFilter) return false;
      if (riskFilter !== "all" && claim.risk_level !== riskFilter) return false;
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase();
        const matchesText = claim.claim_text.toLowerCase().includes(query);
        const matchesProd = (claim.product_name || "").toLowerCase().includes(query);
        const matchesSub = (claim.submission_title || "").toLowerCase().includes(query);
        if (!matchesText && !matchesProd && !matchesSub) return false;
      }
      return true;
    });
  }, [claims, typeFilter, statusFilter, riskFilter, searchQuery]);

  // Metric counts
  const totalCount = claims.length;
  const unverifiedCount = claims.filter((c) => c.verification_status === "unverified").length;
  const supportedCount = claims.filter((c) => c.verification_status === "supported").length;
  const reviewCount = claims.filter(
    (c) => c.verification_status === "needs_review" || c.verification_status === "contradicted"
  ).length;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Marketing Claims</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registry of extracted marketing assertions, evidence verifications, and risk assessments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadClaims} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Claims
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Claims Analyzed</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total claims across campaigns</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Unverified Claims</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : unverifiedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pending evidence reconciliation</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Evidence Supported</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : supportedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Backed by approved records</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Awaiting Review / Flagged</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : reviewCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Requires human determination</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadClaims}>
            Retry
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search claims by text, product, or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors shadow-inner"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Claim Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 shadow-inner"
          >
            <option value="all">All Claim Types</option>
            <option value="efficacy">Efficacy</option>
            <option value="product_attribute">Product Attribute</option>
            <option value="pricing">Pricing</option>
            <option value="guarantee">Guarantee</option>
            <option value="promotion">Promotion</option>
            <option value="comparative">Comparative</option>
          </select>

          {/* Verification Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 shadow-inner"
          >
            <option value="all">All Statuses</option>
            <option value="supported">Supported</option>
            <option value="unverified">Unverified</option>
            <option value="contradicted">Contradicted</option>
            <option value="needs_review">Needs Review</option>
          </select>

          {/* Risk Level */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-violet-500 shadow-inner"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Claims List Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            Loading extracted claims...
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 text-xs">
            <p className="text-sm font-semibold text-white">No claims found</p>
            <p>No claims match your filter criteria. Try adjusting or clearing your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider bg-slate-950/50">
                  <th className="py-3 px-4">Claim Statement</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Campaign & Product</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredClaims.map((claim) => (
                  <tr
                    key={claim.id}
                    onClick={() => setSelectedClaim(claim)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Claim Text */}
                    <td className="py-3 px-4 max-w-md">
                      <div className="font-medium text-white group-hover:text-violet-300 transition-colors line-clamp-2">
                        &ldquo;{claim.claim_text}&rdquo;
                      </div>
                      {claim.suggested_correction && (
                        <div className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1">
                          <span className="font-semibold">Suggested:</span>
                          <span className="line-clamp-1 italic">{claim.suggested_correction}</span>
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {claim.claim_type.replace(/_/g, " ")}
                      </Badge>
                    </td>

                    {/* Campaign / Product */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">
                        {claim.submission_title || "General Copy"}
                      </div>
                      {claim.product_name && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {claim.product_name}
                        </div>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                      {formatPercent(claim.extraction_confidence)}
                    </td>

                    {/* Risk */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={claim.risk_level && riskBadgeMap[claim.risk_level] ? riskBadgeMap[claim.risk_level] : "default"}
                        className="uppercase text-[10px] font-bold"
                      >
                        {claim.risk_level || "unrated"}
                      </Badge>
                    </td>

                    {/* Verification Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusPill status={claim.verification_status} />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {claim.verification_status === "unverified" && (
                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={verifyingId === claim.id}
                            onClick={(e) => handleInlineVerify(claim.id, e)}
                            className="text-[10px] py-1 px-2 border-violet-800/80 text-violet-300 hover:bg-violet-950/60"
                          >
                            <Sparkles className="w-3 h-3 mr-1 text-cyan-400" />
                            Verify
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] text-slate-400 hover:text-white"
                          onClick={() => setSelectedClaim(claim)}
                        >
                          Details
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claim Detail Modal */}
      <ClaimDetailModal
        claim={selectedClaim}
        onClose={() => setSelectedClaim(null)}
        onVerified={loadClaims}
      />
    </AppLayout>
  );
}
