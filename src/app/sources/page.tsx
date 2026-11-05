"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  FolderGit2Icon,
  AlertCircleIcon,
} from "@/components/ui/Icons";
import {
  fetchSourcesData,
  SourcesResponseData,
  LiveSourceDocument,
} from "@/lib/api-client";
import { DocumentVersionModal } from "@/components/sources/DocumentVersionModal";
import { formatDate } from "@/lib/utils/formatters";

type TabKey = "documents" | "facts" | "products" | "promotions";

export default function SourcesPage() {
  const [data, setData] = useState<SourcesResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<LiveSourceDocument | null>(null);

  const loadSources = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchSourcesData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load source library data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchSourcesData()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load source library data");
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered lists
  const queryText = searchQuery.trim().toLowerCase();

  const filteredDocs = (data?.documents || []).filter((d) => {
    if (!queryText) return true;
    return (
      d.title.toLowerCase().includes(queryText) ||
      d.document_type.toLowerCase().includes(queryText) ||
      d.description?.toLowerCase().includes(queryText)
    );
  });

  const filteredFacts = (data?.approvedFacts || []).filter((f) => {
    if (!queryText) return true;
    return (
      f.fact_key.toLowerCase().includes(queryText) ||
      f.product_name.toLowerCase().includes(queryText) ||
      f.fact_type.toLowerCase().includes(queryText)
    );
  });

  const filteredProducts = (data?.products || []).filter((p) => {
    if (!queryText) return true;
    return (
      p.name.toLowerCase().includes(queryText) ||
      p.sku.toLowerCase().includes(queryText) ||
      p.category.toLowerCase().includes(queryText)
    );
  });

  const filteredPromotions = (data?.promotions || []).filter((pr) => {
    if (!queryText) return true;
    return (
      pr.promotion_name.toLowerCase().includes(queryText) ||
      pr.product_name.toLowerCase().includes(queryText)
    );
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Source Library & Ground Truth Vault
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live PostgreSQL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Approved product facts, registered clinical dossiers, active promotions, and versioned substantiation evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadSources} isLoading={isLoading}>
            Refresh Live Data
          </Button>
          <Button variant="primary" size="sm">
            + Upload New Dossier
          </Button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Source Dossiers</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {isLoading ? "..." : data?.documents.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Versioned PDF studies</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Approved Facts</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {isLoading ? "..." : data?.approvedFacts.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Ground truth assertions</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Master Catalog SKUs</div>
          <div className="text-2xl font-bold text-indigo-700 mt-1">
            {isLoading ? "..." : data?.products.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">DermaGlow formulations</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="text-xs font-medium text-slate-500">Active Promotions</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {isLoading ? "..." : data?.promotions.filter((p) => p.is_currently_active).length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Price exception rules</div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadSources}>
            Retry
          </Button>
        </div>
      )}

      {/* Interactive Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "documents"
                ? "bg-white text-slate-900 font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Source Documents ({data?.documents.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("facts")}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "facts"
                ? "bg-white text-slate-900 font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Approved Facts ({data?.approvedFacts.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "products"
                ? "bg-white text-slate-900 font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Product Catalog ({data?.products.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("promotions")}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "promotions"
                ? "bg-white text-slate-900 font-semibold shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Promotions ({data?.promotions.length ?? 0})
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <Card className="p-8 text-center text-xs text-slate-500">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading live evidence records from Supabase PostgreSQL...</span>
        </Card>
      )}

      {/* TAB 1: SOURCE DOCUMENTS */}
      {!isLoading && activeTab === "documents" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Clinical Dossiers & Substantiation Studies</CardTitle>
              <CardDescription>
                Live versioned scientific evidence and regulatory dossier repository
              </CardDescription>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {filteredDocs.length} Document(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No source documents matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Document Title</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Approved Version</th>
                      <th className="py-3 px-4">Approval Date</th>
                      <th className="py-3 px-4">Validity Period</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md shrink-0">
                              <FolderGit2Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 line-clamp-1">
                                {doc.title}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>ID: {doc.id.substring(0, 8)}...</span>
                                <span className="text-emerald-700 font-medium bg-emerald-50 px-1.5 rounded">
                                  Seeded Ground Truth
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {doc.document_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">
                              v{doc.current_version_number ?? 1}
                            </span>
                            <Badge variant={doc.is_expired ? "warning" : "success"} size="sm">
                              {doc.is_expired ? "Expired" : "Approved"}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {doc.approval_date ? formatDate(doc.approval_date) : "Pending"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {doc.valid_from ? formatDate(doc.valid_from) : "—"} to{" "}
                          {doc.valid_until ? formatDate(doc.valid_until) : "Indefinite"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDoc(doc)}
                          >
                            Inspect Versions
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 2: APPROVED FACTS */}
      {!isLoading && activeTab === "facts" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Registered Approved Product Facts</CardTitle>
              <CardDescription>
                Ground-truth formulation parameters, safety profiles, and pricing catalogue
              </CardDescription>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {filteredFacts.length} Fact(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {filteredFacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No approved facts matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Fact Key</th>
                      <th className="py-3 px-4">Associated Product</th>
                      <th className="py-3 px-4">Approved Fact Value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Validity Window</th>
                      <th className="py-3 px-4 sm:px-6">Source Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredFacts.map((fact) => (
                      <tr key={fact.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-indigo-700">
                          {fact.fact_key}
                          <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                            Type: {fact.fact_type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{fact.product_name}</div>
                          <div className="text-[11px] text-slate-400">{fact.product_sku}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <pre className="text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200 font-mono text-slate-800 whitespace-pre-wrap">
                            {typeof fact.fact_value === "object"
                              ? JSON.stringify(fact.fact_value, null, 1)
                              : String(fact.fact_value)}
                          </pre>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={fact.approval_status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(fact.valid_from)} —{" "}
                          {fact.valid_until ? formatDate(fact.valid_until) : "Indefinite"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-600">
                          {fact.source_document_title ? (
                            <span className="text-indigo-600 font-medium hover:underline cursor-pointer">
                              {fact.source_document_title}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Direct Catalogue Fact</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PRODUCT CATALOG */}
      {!isLoading && activeTab === "products" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>DermaGlow Product Catalogue</CardTitle>
              <CardDescription>
                Registered commercial products, reference retail prices, and regulatory statuses
              </CardDescription>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {filteredProducts.length} Product(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No products matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Reference Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 sm:px-6">Registered On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <code className="text-slate-800 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.sku}
                          </code>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{p.category}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          ₹{Number(p.reference_price).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-500">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: ACTIVE PROMOTIONS */}
      {!isLoading && activeTab === "promotions" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Active Pricing Promotions & Discount Exceptions</CardTitle>
              <CardDescription>
                Promotional pricing rules consulted by claim verification before flagging pricing discrepancies
              </CardDescription>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {filteredPromotions.length} Promotion(s)
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {filteredPromotions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No promotions matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Promotion Name</th>
                      <th className="py-3 px-4">Target Product</th>
                      <th className="py-3 px-4">Resulting Price</th>
                      <th className="py-3 px-4">Active Status</th>
                      <th className="py-3 px-4">Validity Window</th>
                      <th className="py-3 px-4 sm:px-6">Applicable Channels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPromotions.map((promo) => (
                      <tr key={promo.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-slate-900">{promo.promotion_name}</div>
                          {promo.terms && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {promo.terms}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium">
                          {promo.product_name}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700 text-sm">
                          ₹{Number(promo.resulting_price).toLocaleString("en-IN")}{" "}
                          <span className="text-[10px] text-slate-400 font-normal">
                            (-₹{Number(promo.discount_value).toLocaleString("en-IN")})
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={promo.is_currently_active ? "success" : "neutral"}
                            size="sm"
                          >
                            {promo.is_currently_active ? "Currently Active" : promo.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(promo.start_date)} — {formatDate(promo.end_date)}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-600">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-700">
                            {Array.isArray(promo.applicable_channels)
                              ? promo.applicable_channels.join(", ")
                              : String(promo.applicable_channels)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Version Inspection Modal */}
      <DocumentVersionModal
        sourceDoc={selectedDoc}
        versions={data?.documentVersions ?? []}
        onClose={() => setSelectedDoc(null)}
      />
    </AppLayout>
  );
}
