"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  fetchSourcesData,
  SourcesResponseData,
  LiveSourceDocument,
  LiveProduct,
  LivePromotion,
} from "@/lib/api-client";
import { DocumentVersionModal } from "@/components/sources/DocumentVersionModal";
import { UploadEvidenceModal } from "@/components/sources/UploadEvidenceModal";
import { RegisterProductModal } from "@/components/products/RegisterProductModal";
import { EditProductModal } from "@/components/products/EditProductModal";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { CreatePromotionModal } from "@/components/promotions/CreatePromotionModal";
import { EditPromotionModal } from "@/components/promotions/EditPromotionModal";
import { DeletePromotionDialog } from "@/components/promotions/DeletePromotionDialog";
import { formatDate } from "@/lib/utils/formatters";
import {
  FolderGit2,
  AlertTriangle,
  RefreshCw,
  Search,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  PackagePlus,
  Tag,
  UploadCloud,
} from "lucide-react";

type TabKey = "documents" | "facts" | "products" | "promotions";

export default function SourcesPage() {
  const [data, setData] = useState<SourcesResponseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<LiveSourceDocument | null>(null);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRegisterProductOpen, setIsRegisterProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LiveProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<LiveProduct | null>(null);

  const [isCreatePromoOpen, setIsCreatePromoOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<LivePromotion | null>(null);
  const [deletingPromo, setDeletingPromo] = useState<LivePromotion | null>(null);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Evidence Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Approved product facts, registered clinical dossiers, active promotions, and substantiation evidence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadSources} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Evidence
          </Button>
          <Button
            variant="primary"
            size="sm"
            data-tour="upload-evidence-btn"
            onClick={() => setIsUploadModalOpen(true)}
            className="cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 mr-1" />
            + Upload Evidence Dossier
          </Button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence Dossiers</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : data?.documents.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Indexed clinical dossiers</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Approved Facts</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : data?.approvedFacts.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ground truth assertions</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Master Catalog SKUs</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : data?.products.length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Commercial formulations</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Active Promotions</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : data?.promotions.filter((p) => p.is_currently_active).length ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Price exception rules</div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadSources}>
            Retry
          </Button>
        </div>
      )}

      {/* Interactive Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto shadow-inner" data-tour="evidence-tabs">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
              activeTab === "documents"
                ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Source Documents ({data?.documents.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("facts")}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
              activeTab === "facts"
                ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Approved Facts ({data?.approvedFacts.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
              activeTab === "products"
                ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Product Catalog ({data?.products.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("promotions")}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs ${
              activeTab === "promotions"
                ? "bg-violet-600 text-white font-semibold shadow-md shadow-violet-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Promotions ({data?.promotions.length ?? 0})
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
          />
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/60 text-center text-xs text-slate-400">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Loading live evidence records from Supabase PostgreSQL...</span>
        </div>
      )}

      {/* TAB 1: SOURCE DOCUMENTS */}
      {!isLoading && activeTab === "documents" && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden" data-tour="evidence-list">
          <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Verified Source Documents</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scientific papers, clinical trial results, and regulatory standards indexed for ground-truth verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUploadModalOpen(true)}
                className="cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Upload Dossier
              </Button>
              <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
                {filteredDocs.length} Document(s)
              </span>
            </div>
          </div>
          <div className="p-0">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No source documents matching &ldquo;{searchQuery}&rdquo;.
                <div className="mt-3">
                  <Button variant="primary" size="sm" onClick={() => setIsUploadModalOpen(true)}>
                    + Upload First Evidence Dossier
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Document Title</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Active Version</th>
                      <th className="py-3 px-4">Validity</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-white">{doc.title}</div>
                          {doc.description && (
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {doc.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded text-[11px] font-medium text-slate-300">
                            {doc.document_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={doc.approval_status} />
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-cyan-300 font-medium">
                            v{doc.current_version_number ?? 1}.0
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {doc.valid_from ? formatDate(doc.valid_from) : "Active"} —{" "}
                          {doc.valid_until ? formatDate(doc.valid_until) : "Indefinite"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedDoc(doc)}
                            className="text-violet-400 hover:text-violet-300 hover:bg-violet-950/50"
                          >
                            <Layers className="w-3.5 h-3.5 mr-1" />
                            Versions
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: APPROVED FACTS */}
      {!isLoading && activeTab === "facts" && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Approved Ground Truth Facts</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Atomic ground-truth specifications linked to clinical dossiers and validated product formulations.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full">
              {filteredFacts.length} Ground Truth Facts
            </span>
          </div>
          <div className="p-0">
            {filteredFacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No approved facts matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Fact Key & Type</th>
                      <th className="py-3 px-4">Associated Product</th>
                      <th className="py-3 px-4">Verified Fact Value</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Validity</th>
                      <th className="py-3 px-4 sm:px-6">Substantiating Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredFacts.map((fact) => (
                      <tr key={fact.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-white font-mono text-xs">{fact.fact_key}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                            {fact.fact_type}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{fact.product_name}</div>
                          <div className="text-[11px] text-slate-400">{fact.product_sku}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <pre className="text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800 font-mono text-cyan-300 whitespace-pre-wrap">
                            {typeof fact.fact_value === "object"
                              ? JSON.stringify(fact.fact_value, null, 1)
                              : String(fact.fact_value)}
                          </pre>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={fact.approval_status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(fact.valid_from)} —{" "}
                          {fact.valid_until ? formatDate(fact.valid_until) : "Indefinite"}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-slate-400">
                          {fact.source_document_title ? (
                            <span className="text-violet-400 font-medium hover:underline cursor-pointer">
                              {fact.source_document_title}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Direct Catalogue Fact</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT CATALOG */}
      {!isLoading && activeTab === "products" && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Commercial Product Catalogue</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Registered commercial products, reference retail prices, and regulatory statuses.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsRegisterProductOpen(true)}
                className="cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5 mr-1" />
                Register Product
              </Button>
              <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
                {filteredProducts.length} Product(s)
              </span>
            </div>
          </div>
          <div className="p-0">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No products found. Register your first product formulation above.
                <div className="mt-3">
                  <Button variant="primary" size="sm" onClick={() => setIsRegisterProductOpen(true)}>
                    + Register Product
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Product Name</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Reference Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Registered On</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-white">{p.name}</div>
                          {p.description && (
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <code className="text-violet-300 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {p.sku}
                          </code>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{p.category}</td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          ₹{Number(p.reference_price).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingProduct(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                              title="Edit product"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* TAB 4: ACTIVE PROMOTIONS */}
      {!isLoading && activeTab === "promotions" && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Pricing Promotions & Discount Exceptions</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Promotional pricing rules consulted by claim verification before flagging pricing discrepancies.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreatePromoOpen(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5 mr-1" />
                Create Promotion
              </Button>
              <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded-full">
                {filteredPromotions.length} Promotion(s)
              </span>
            </div>
          </div>
          <div className="p-0">
            {filteredPromotions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active promotional rules configured for this workspace.
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCreatePromoOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    + Create Promotion
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4 sm:px-6">Promotion Name</th>
                      <th className="py-3 px-4">Target Product</th>
                      <th className="py-3 px-4">Resulting Price</th>
                      <th className="py-3 px-4">Active Status</th>
                      <th className="py-3 px-4">Validity Window</th>
                      <th className="py-3 px-4">Applicable Channels</th>
                      <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredPromotions.map((promo) => (
                      <tr key={promo.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-white">{promo.promotion_name}</div>
                          {promo.terms && (
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {promo.terms}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          {promo.product_name}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-300 text-sm">
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
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(promo.start_date)} — {formatDate(promo.end_date)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          <span className="px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded text-[11px] font-medium text-slate-300">
                            {Array.isArray(promo.applicable_channels)
                              ? promo.applicable_channels.join(", ")
                              : String(promo.applicable_channels)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingPromo(promo)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                              title="Edit promotion"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingPromo(promo)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                              title="Delete promotion"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* MODALS */}

      {/* Document Version Inspection Modal */}
      <DocumentVersionModal
        sourceDoc={selectedDoc}
        versions={data?.documentVersions ?? []}
        onClose={() => setSelectedDoc(null)}
      />

      {/* Upload Evidence Dossier Modal */}
      <UploadEvidenceModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={loadSources}
      />

      {/* Register Product Modal */}
      <RegisterProductModal
        isOpen={isRegisterProductOpen}
        onClose={() => setIsRegisterProductOpen(false)}
        onSuccess={() => loadSources()}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => loadSources()}
      />

      {/* Delete Product Dialog */}
      <DeleteProductDialog
        product={deletingProduct}
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onSuccess={() => loadSources()}
      />

      {/* Create Promotion Modal */}
      <CreatePromotionModal
        isOpen={isCreatePromoOpen}
        onClose={() => setIsCreatePromoOpen(false)}
        onSuccess={() => loadSources()}
        products={data?.products ?? []}
      />

      {/* Edit Promotion Modal */}
      <EditPromotionModal
        promotion={editingPromo}
        isOpen={!!editingPromo}
        onClose={() => setEditingPromo(null)}
        onSuccess={() => loadSources()}
      />

      {/* Delete Promotion Dialog */}
      <DeletePromotionDialog
        promotion={deletingPromo}
        isOpen={!!deletingPromo}
        onClose={() => setDeletingPromo(null)}
        onSuccess={() => loadSources()}
      />
    </AppLayout>
  );
}
