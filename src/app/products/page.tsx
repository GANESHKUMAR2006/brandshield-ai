"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { fetchProducts, LiveProduct } from "@/lib/api-client";
import { RegisterProductModal } from "@/components/products/RegisterProductModal";
import { EditProductModal } from "@/components/products/EditProductModal";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { formatDate } from "@/lib/utils/formatters";
import {
  Package,
  PackagePlus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function ProductsPage() {
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LiveProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<LiveProduct | null>(null);

  const loadProducts = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Unique categories
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  // Filtered products
  const queryText = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      !queryText ||
      p.name.toLowerCase().includes(queryText) ||
      p.sku.toLowerCase().includes(queryText) ||
      p.category.toLowerCase().includes(queryText) ||
      p.description?.toLowerCase().includes(queryText);

    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;

    return matchesQuery && matchesCategory;
  });

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Package className="w-6 h-6 text-violet-400" />
            Commercial Products & Formulations
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registered master catalog SKUs, commercial pricing, and clinical specifications for this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadProducts} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRegisterOpen(true)}
            className="cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5 mr-1" />
            + Register Product
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Catalog SKUs</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1.5 tracking-tight">
            {isLoading ? "..." : products.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Formulations registered</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Active Commercial</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : products.filter((p) => p.status === "active").length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Marketable products</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Categories</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-violet-300 mt-1.5 tracking-tight">
            {isLoading ? "..." : categories.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Therapeutic segments</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-lg">
          <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Evidence Library</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-300 mt-1.5 tracking-tight flex items-center justify-between">
            <span>Dossiers</span>
            <Link href="/sources" className="text-xs font-medium text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
              View <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Clinical dossiers & facts</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadProducts}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              categoryFilter === "all"
                ? "bg-violet-600 border-violet-500 text-white font-semibold shadow-md"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-violet-600 border-violet-500 text-white font-semibold shadow-md"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 shadow-inner"
          />
        </div>
      </div>

      {/* Products Table Card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800/80 flex flex-row items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Active Workspace Products</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target products referenced by marketing submissions and pricing exception rules.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-violet-300 bg-violet-950/60 border border-violet-800/60 px-2.5 py-0.5 rounded-full">
            {filteredProducts.length} Product(s)
          </span>
        </div>

        <div className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Loading products...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No products found</p>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No products matched "${searchQuery}".`
                  : "Your workspace does not have any commercial products registered yet."}
              </p>
              <div className="mt-4">
                <Button variant="primary" size="sm" onClick={() => setIsRegisterOpen(true)}>
                  <PackagePlus className="w-3.5 h-3.5 mr-1" />
                  Register First Product
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Product Formulation</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Reference Retail Price</th>
                    <th className="py-3 px-4">Commercial Status</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="font-semibold text-white">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
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
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                            title="Edit product formulation"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProduct(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                            title="Delete product formulation"
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

      {/* Modals */}
      <RegisterProductModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => loadProducts()}
      />

      <EditProductModal
        product={editingProduct}
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => loadProducts()}
      />

      <DeleteProductDialog
        product={deletingProduct}
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onSuccess={() => loadProducts()}
      />
    </AppLayout>
  );
}
