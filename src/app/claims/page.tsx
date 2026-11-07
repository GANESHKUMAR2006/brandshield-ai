"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
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
  Layers,
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
            <span>Claim Ledger & Forensic Analysis</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-950/70 text-violet-300 border border-violet-800/60 shadow-[0_0_8px_rgba(139,92,246,0.3)]">
              Live PostgreSQL 17
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Enterprise registry of extracted marketing assertions, UTF-16 character spans, and RAG ground-truth provenance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadClaims} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Registered Claims</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Active claims in database</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Unverified Claims</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : unverifiedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Awaiting RAG clinical verification</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Fully Supported</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : supportedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Backed by clinical dossiers</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Contradicted / Flagged</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : reviewCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Requires human review adjustments</div>
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

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Claim Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto shadow-inner">
            {[
              { id: "all", label: "All Types" },
              { id: "product_attribute", label: "Product Attribute" },
              { id: "price", label: "Price" },
              { id: "discount", label: "Discount" },
              { id: "efficacy", label: "Efficacy" },
              { id: "guarantee", label: "Guarantee" },
              { id: "comparative", label: "Comparative" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
                  typeFilter === tab.id
                    ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
          >
            <option value="all">All Statuses</option>
            <option value="unverified">Unverified</option>
            <option value="supported">Supported</option>
            <option value="contradicted">Contradicted</option>
            <option value="outdated">Outdated</option>
            <option value="needs_review">Needs Review</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer shadow-inner"
          >
            <option value="all">All Risk Levels</option>
            <option value="critical">Critical Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search claim text or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
          />
        </div>
      </div>

      {/* Claims Table Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Extracted Claims Registry</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Factual statements extracted by AI engine with exact UTF-16 character positions & clinical groundings.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
            {filteredClaims.length} Claims Listed
          </span>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading claims from database...
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No claims match the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Extracted Marketing Claim</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Status & Risk</th>
                    <th className="py-3 px-4">AI Confidence</th>
                    <th className="py-3 px-4">Associated Product</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 max-w-md">
                        <div className="font-semibold text-white leading-snug text-[13px]">
                          &ldquo;{claim.claim_text}&rdquo;
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>Campaign: <strong className="text-slate-300 font-medium">{claim.submission_title || "General"}</strong></span>
                          {claim.text_start !== null && claim.text_end !== null && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.2 rounded text-[10px]">
                                span [{claim.text_start}..{claim.text_end}]
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="capitalize px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-medium text-[11px] whitespace-nowrap">
                          {claim.claim_type.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusPill status={claim.verification_status} />
                          {claim.risk_level && (
                            <Badge variant={riskBadgeMap[claim.risk_level] || "default"} size="sm">
                              {claim.risk_level}
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.4)]"
                              style={{ width: `${Math.round(claim.extraction_confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatPercent(claim.extraction_confidence)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {claim.product_name ? (
                          <div className="max-w-[160px] truncate">
                            <span className="font-medium text-white">{claim.product_name}</span>
                            {claim.product_sku && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {claim.product_sku}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassociated</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => handleInlineVerify(claim.id, e)}
                            isLoading={verifyingId === claim.id}
                          >
                            Verify
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClaim(claim)}
                          >
                            Details
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
