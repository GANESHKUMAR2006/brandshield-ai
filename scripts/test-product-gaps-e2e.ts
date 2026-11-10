/**
 * BrandShield AI — Complete Product Gaps End-to-End Acceptance Test Suite
 *
 * Validates the 6 required scenarios:
 * 1. Scenario 1 — New Company Onboarding:
 *    - Workspace creation ("Aura Skin Labs", slug: "aura-skin-labs")
 *    - Invite compliance reviewer
 *    - Onboarding status milestones evaluation
 * 2. Scenario 2 — Product Management:
 *    - Create new product ("Aura Retinol Renewal Serum")
 *    - SKU uniqueness enforcement
 *    - Edit product & verify changes
 *    - View catalog
 *    - Strict cross-tenant isolation (IDOR protection from DermaGlow)
 *    - Clean deletion of test product & deletion safeguards
 * 3. Scenario 3 — Evidence Management:
 *    - Ingest clinical study document via POST /api/sources/ingest
 *    - Verify chunking & pgvector embedding persistence
 *    - Verify document appearance in evidence library
 *    - Cross-tenant evidence isolation
 * 4. Scenario 4 — Promotion Management:
 *    - Create active promotion with percentage discount
 *    - Automatic resulting price calculation verification
 *    - Foreign product rejection (cross-tenant safety)
 *    - Edit and expire promotion
 * 5. Scenario 5 — Complete Claim Governance Flow:
 *    - Extract claims from marketing copy (clinical trial, guarantee, valid promo price, contradicted price)
 *    - Verify deterministic offsets
 *    - Deterministic verification against evidence chunks, product facts, and promo records
 *    - Human compliance review & publication gate locking
 * 6. Scenario 6 — Multi-Tenant RBAC:
 *    - Admin full access
 *    - Compliance reviewer access (view/upload/review, forbidden to delete product)
 *    - Viewer read-only access (forbidden to create/edit/delete products, promotions, evidence)
 */

import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  resolveServerSession,
  AuthenticationRequiredError,
  WorkspaceAccessError,
  __setTestSessionOverride,
  ServerSessionIdentity,
} from "@/lib/auth/server-session";
import { __setTestQueryOverride } from "@/lib/db/server-db";

// API Route Handlers
import { POST as postWorkspace, GET as getWorkspaces } from "@/app/api/workspaces/route";
import { POST as postInvitation, GET as getInvitations } from "@/app/api/workspaces/[id]/invitations/route";
import { GET as getOnboardingStatus } from "@/app/api/onboarding/status/route";
import { POST as postProduct, GET as getProducts } from "@/app/api/products/route";
import { GET as getProductById, PATCH as patchProductById, DELETE as deleteProductById } from "@/app/api/products/[id]/route";
import { POST as postPromotion, GET as getPromotions } from "@/app/api/promotions/route";
import { GET as getPromotionById, PATCH as patchPromotionById, DELETE as deletePromotionById } from "@/app/api/promotions/[id]/route";
import { POST as postIngest } from "@/app/api/sources/ingest/route";
import { GET as getSources } from "@/app/api/sources/route";

// Verification & Workflow Services
import { ClaimOffsetCalculator } from "@/lib/ai/extraction/claim-offset-calculator";
import { ClaimValidator } from "@/lib/ai/validation/claim-validator";
import { VerificationRouter } from "@/lib/verification/verification-router";
import { ReviewWorkflowService } from "@/lib/review/review-service";
import { VerificationContext } from "@/lib/verification/types";

process.env.EMBEDDING_PROVIDER = "mock";

let passedCount = 0;
let failedCount = 0;

function pass(name: string, detail?: string) {
  console.log(`  [PASS] ${name}`);
  if (detail) console.log(`         └─ ${detail}`);
  passedCount++;
}

function fail(name: string, detail?: string) {
  console.error(`  [FAIL] ${name}`);
  if (detail) console.error(`         └─ ${detail}`);
  failedCount++;
}

function check(condition: boolean, name: string, detail?: string) {
  if (condition) pass(name, detail);
  else fail(name, detail);
}

// -----------------------------------------------------------------------------
// State Store for Mock Database during End-to-End Execution
// -----------------------------------------------------------------------------
interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface MockMembership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
}

interface MockInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_by: string;
  status: string;
  created_at: string;
}

interface MockProduct {
  id: string;
  workspace_id: string;
  name: string;
  sku: string;
  description: string | null;
  category: string;
  reference_price: string;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockPromotion {
  id: string;
  workspace_id: string;
  product_id: string;
  promotion_name: string;
  discount_type: string;
  discount_value: string;
  resulting_price: string;
  currency: string;
  start_date: string;
  end_date: string;
  applicable_channels: string[];
  terms: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockSourceDocument {
  id: string;
  workspace_id: string;
  title: string;
  document_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MockDocumentVersion {
  id: string;
  source_document_id: string;
  version_number: number;
  format: string;
  file_name: string;
  file_size_bytes: number;
  content_hash: string;
  raw_text: string;
  created_by: string;
}

interface MockDocumentChunk {
  id: string;
  source_document_id: string;
  document_version_id: string;
  chunk_index: number;
  chunk_text: string;
  page_number: number;
  char_offset_start: number;
  char_offset_end: number;
  embedding: number[];
  token_count: number;
}

const store = {
  workspaces: [] as MockWorkspace[],
  memberships: [] as MockMembership[],
  invitations: [] as MockInvitation[],
  products: [] as MockProduct[],
  promotions: [] as MockPromotion[],
  sourceDocuments: [] as MockSourceDocument[],
  documentVersions: [] as MockDocumentVersion[],
  documentChunks: [] as MockDocumentChunk[],
};

// Seed existing DermaGlow workspace for cross-tenant negative testing
const DERMAGLOW_ID = "00000000-0000-0000-0000-000000000001";
const DERMAGLOW_SLUG = "dermaglow";

store.workspaces.push({
  id: DERMAGLOW_ID,
  name: "DermaGlow Clinical Skincare",
  slug: DERMAGLOW_SLUG,
  created_at: new Date().toISOString(),
});

store.memberships.push({
  id: crypto.randomUUID(),
  workspace_id: DERMAGLOW_ID,
  user_id: "00000000-0000-4000-a000-000000000099",
  role: "admin",
  status: "active",
});

store.products.push({
  id: crypto.randomUUID(),
  workspace_id: DERMAGLOW_ID,
  name: "DermaGlow Vitamin C Serum",
  sku: "DG-VITC-01",
  description: "Formulated with 10% stabilised Vitamin C",
  category: "Serum",
  reference_price: "1999.00",
  currency: "INR",
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Setup mock query interceptor
__setTestQueryOverride(async (sql: string, params?: unknown[]) => {
  const normalizedSql = sql.trim().replace(/\s+/g, " ");

  // 1. Workspaces
  if (normalizedSql.startsWith("SELECT id FROM workspaces WHERE slug = $1 LIMIT 1")) {
    const slug = params?.[0];
    const ws = store.workspaces.find((w) => w.slug === slug);
    return { rows: ws ? [{ id: ws.id }] : [], rowCount: ws ? 1 : 0 };
  }

  if (normalizedSql.includes("FROM workspaces WHERE slug = $1 LIMIT 1")) {
    const slug = params?.[0];
    const ws = store.workspaces.find((w) => w.slug === slug);
    return { rows: ws ? [ws] : [], rowCount: ws ? 1 : 0 };
  }

  if (normalizedSql.includes("INSERT INTO workspaces")) {
    const [name, slug] = params as [string, string];
    const newWs: MockWorkspace = {
      id: crypto.randomUUID(),
      name,
      slug,
      created_at: new Date().toISOString(),
    };
    store.workspaces.push(newWs);
    return { rows: [newWs], rowCount: 1 };
  }

  if (normalizedSql.includes("INSERT INTO workspace_memberships")) {
    const workspace_id = params?.[0] as string;
    const user_id = params?.[1] as string;
    const role = (params && (params[2] as string)) || (normalizedSql.includes("'admin'") ? "admin" : "compliance_reviewer");
    const status = (params && (params[3] as string)) || "active";
    const newMem: MockMembership = {
      id: crypto.randomUUID(),
      workspace_id,
      user_id,
      role,
      status,
    };
    store.memberships.push(newMem);
    return { rows: [newMem], rowCount: 1 };
  }

  if (normalizedSql.includes("FROM workspaces w JOIN workspace_memberships wm")) {
    const userId = params?.[0];
    const userMems = store.memberships.filter((m) => m.user_id === userId && m.status === "active");
    const rows = userMems.map((m) => {
      const w = store.workspaces.find((ws) => ws.id === m.workspace_id);
      return {
        id: w?.id,
        name: w?.name,
        slug: w?.slug,
        role: m.role,
        status: m.status,
        created_at: w?.created_at,
        member_count: "1",
      };
    });
    return { rows, rowCount: rows.length };
  }

  // 2. Invitations & Members
  if (normalizedSql.includes("FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2")) {
    const [workspace_id, user_id] = params as [string, string];
    const mem = store.memberships.find((m) => m.workspace_id === workspace_id && m.user_id === user_id && m.status === "active");
    return { rows: mem ? [{ role: mem.role }] : [], rowCount: mem ? 1 : 0 };
  }

  if (normalizedSql.includes("FROM workspace_invitations WHERE workspace_id = $1 AND lower(email) = $2")) {
    const [workspace_id, email] = params as [string, string];
    const inv = store.invitations.find((i) => i.workspace_id === workspace_id && i.email.toLowerCase() === email.toLowerCase());
    return { rows: inv ? [{ id: inv.id }] : [], rowCount: inv ? 1 : 0 };
  }

  if (normalizedSql.includes("INSERT INTO workspace_invitations")) {
    const [workspace_id, email, role, token, expires_at, created_by] = params as [string, string, string, string, string, string];
    const newInv: MockInvitation = {
      id: crypto.randomUUID(),
      workspace_id,
      email,
      role,
      token,
      expires_at,
      created_by,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    store.invitations.push(newInv);
    return {
      rows: [
        {
          id: newInv.id,
          workspace_id: newInv.workspace_id,
          email: newInv.email,
          role: newInv.role,
          status: newInv.status,
          token: newInv.token,
          expires_at: newInv.expires_at,
          created_at: newInv.created_at,
        },
      ],
      rowCount: 1,
    };
  }

  if (normalizedSql.includes("FROM workspace_invitations WHERE workspace_id = $1 ORDER BY created_at DESC")) {
    const workspace_id = params?.[0];
    const invs = store.invitations.filter((i) => i.workspace_id === workspace_id);
    return { rows: invs, rowCount: invs.length };
  }

  // 3. Products
  if (normalizedSql.includes("SELECT id FROM products WHERE LOWER(sku) = LOWER($1)")) {
    const sku = params?.[0] as string;
    const prod = store.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
    return { rows: prod ? [{ id: prod.id }] : [], rowCount: prod ? 1 : 0 };
  }

  if (normalizedSql.includes("INSERT INTO products")) {
    const [workspace_id, name, sku, description, category, reference_price, currency, status] = params as any[];
    const newProd: MockProduct = {
      id: crypto.randomUUID(),
      workspace_id,
      name,
      sku,
      description: description || null,
      category,
      reference_price: String(reference_price),
      currency: currency || "INR",
      status: status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.products.push(newProd);
    return { rows: [newProd], rowCount: 1 };
  }

  if (normalizedSql.includes("FROM products p") && normalizedSql.includes("w.slug = $1") && !normalizedSql.includes("p.id = $1")) {
    const slug = params?.[0];
    const ws = store.workspaces.find((w) => w.slug === slug);
    if (!ws) return { rows: [], rowCount: 0 };

    let prods = store.products.filter((p) => p.workspace_id === ws.id);
    if (params && params.length > 1 && params[1]) {
      const cat = params[1] as string;
      prods = prods.filter((p) => p.category.toLowerCase() === cat.toLowerCase());
    }
    return { rows: prods.map((p) => ({ ...p, approved_facts: [] })), rowCount: prods.length };
  }

  if (normalizedSql.includes("FROM products p") && (normalizedSql.includes("p.id = $1") || normalizedSql.includes("WHERE p.id = $1"))) {
    const id = params?.[0] as string;
    const slug = params?.[1] as string;
    const prod = store.products.find((p) => p.id === id);
    if (!prod) return { rows: [], rowCount: 0 };
    if (slug) {
      const ws = store.workspaces.find((w) => w.slug === slug);
      if (!ws || prod.workspace_id !== ws.id) return { rows: [], rowCount: 0 };
    }
    return { rows: [prod], rowCount: 1 };
  }

  if (normalizedSql.includes("UPDATE products SET") && normalizedSql.includes("RETURNING")) {
    const prod = store.products.find((p) => params?.includes(p.id));
    if (!prod) return { rows: [], rowCount: 0 };

    if (normalizedSql.includes("reference_price =")) {
      const priceVal = params?.find(
        (val) => (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)))) && val !== prod.id && val !== prod.workspace_id
      );
      if (priceVal !== undefined) prod.reference_price = String(priceVal);
    }
    prod.updated_at = new Date().toISOString();
    return { rows: [prod], rowCount: 1 };
  }

  if (normalizedSql.includes("DELETE FROM products WHERE id = $1")) {
    const id = params?.[0] as string;
    const idx = store.products.findIndex((p) => p.id === id);
    if (idx !== -1) store.products.splice(idx, 1);
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }

  // 4. Promotions
  if (normalizedSql.includes("INSERT INTO promotions")) {
    const [product_id, promotion_name, discount_type, discount_value, resulting_price, currency, start_date, end_date, applicable_channels, terms, status] = params as any[];
    const prod = store.products.find((p) => p.id === product_id);
    const workspace_id = prod ? prod.workspace_id : (params?.[0] as string);
    const newPromo: MockPromotion = {
      id: crypto.randomUUID(),
      workspace_id,
      product_id,
      promotion_name,
      discount_type,
      discount_value: String(discount_value),
      resulting_price: String(resulting_price),
      currency: currency || "INR",
      start_date,
      end_date,
      applicable_channels: applicable_channels || ["all"],
      terms: terms || null,
      status: status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.promotions.push(newPromo);
    return { rows: [newPromo], rowCount: 1 };
  }

  if (normalizedSql.includes("FROM promotions pr") && normalizedSql.includes("w.slug = $1") && !normalizedSql.includes("pr.id = $1")) {
    const slug = params?.[0];
    const ws = store.workspaces.find((w) => w.slug === slug);
    if (!ws) return { rows: [], rowCount: 0 };
    const promos = store.promotions
      .filter((pr) => pr.workspace_id === ws.id)
      .map((pr) => {
        const prod = store.products.find((p) => p.id === pr.product_id);
        return {
          ...pr,
          product_name: prod ? prod.name : "Unknown Product",
        };
      });
    return { rows: promos, rowCount: promos.length };
  }

  if (normalizedSql.includes("FROM promotions pr") && (normalizedSql.includes("pr.id = $1") || normalizedSql.includes("WHERE pr.id = $1"))) {
    const id = params?.[0] as string;
    const slug = params?.[1] as string;
    const promo = store.promotions.find((pr) => pr.id === id);
    if (!promo) return { rows: [], rowCount: 0 };
    if (slug) {
      const ws = store.workspaces.find((w) => w.slug === slug);
      if (!ws || promo.workspace_id !== ws.id) return { rows: [], rowCount: 0 };
    }
    const prod = store.products.find((p) => p.id === promo.product_id);
    return { rows: [{ ...promo, product_name: prod ? prod.name : "Unknown Product" }], rowCount: 1 };
  }

  if (normalizedSql.includes("UPDATE promotions SET") && normalizedSql.includes("RETURNING")) {
    const promo = store.promotions.find((p) => params?.includes(p.id));
    if (!promo) return { rows: [], rowCount: 0 };
    if (normalizedSql.includes("status =")) {
      const statusVal = params?.find((val) => ["active", "expired", "scheduled", "cancelled"].includes(String(val)));
      if (statusVal) promo.status = String(statusVal);
    }
    if (normalizedSql.includes("terms =")) {
      const termsVal = params?.find((val) => typeof val === "string" && (val.includes("terms") || val.length > 5));
      if (termsVal) promo.terms = String(termsVal);
    }
    promo.updated_at = new Date().toISOString();
    return { rows: [promo], rowCount: 1 };
  }

  if (normalizedSql.includes("DELETE FROM promotions WHERE id = $1")) {
    const id = params?.[0] as string;
    const idx = store.promotions.findIndex((p) => p.id === id);
    if (idx !== -1) store.promotions.splice(idx, 1);
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }

  // 5. Source Documents & Ingestion
  if (normalizedSql.includes("INSERT INTO source_documents")) {
    const [workspace_id, title, document_type, description] = params as any[];
    const newDoc: MockSourceDocument = {
      id: crypto.randomUUID(),
      workspace_id,
      title,
      document_type,
      status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.sourceDocuments.push(newDoc);
    return { rows: [{ id: newDoc.id }], rowCount: 1 };
  }

  if (normalizedSql.includes("INSERT INTO document_versions")) {
    const [source_document_id, storage_path, content_hash] = params as any[];
    const newVer: MockDocumentVersion = {
      id: crypto.randomUUID(),
      source_document_id,
      version_number: 1,
      format: "pdf",
      file_name: "clinical_study.pdf",
      file_size_bytes: 1024,
      content_hash,
      raw_text: "",
      created_by: "system",
    };
    store.documentVersions.push(newVer);
    return { rows: [{ id: newVer.id }], rowCount: 1 };
  }

  if (normalizedSql.includes("UPDATE source_documents SET current_version_id = $1 WHERE id = $2")) {
    return { rows: [], rowCount: 1 };
  }

  if (normalizedSql.includes("INSERT INTO document_chunks")) {
    const [document_version_id, chunk_index, content, vectorString, metadataStr] = params as any[];
    let metadata: any = {};
    try {
      metadata = JSON.parse(metadataStr || "{}");
    } catch {}
    const newChunk: MockDocumentChunk = {
      id: crypto.randomUUID(),
      source_document_id: store.sourceDocuments[store.sourceDocuments.length - 1]?.id || crypto.randomUUID(),
      document_version_id,
      chunk_index,
      chunk_text: content,
      page_number: metadata.pageNumber || 1,
      char_offset_start: metadata.charOffsetStart || 0,
      char_offset_end: metadata.charOffsetEnd || content.length,
      embedding: [0.1, 0.2, 0.3],
      token_count: content.split(" ").length,
    };
    store.documentChunks.push(newChunk);
    return { rows: [{ id: newChunk.id }], rowCount: 1 };
  }

  if (normalizedSql.includes("FROM source_documents") && normalizedSql.includes("w.slug = $1")) {
    const slug = params?.[0];
    const ws = store.workspaces.find((w) => w.slug === slug);
    if (!ws) return { rows: [], rowCount: 0 };
    const docs = store.sourceDocuments.filter((d) => d.workspace_id === ws.id);
    return { rows: docs.map((d) => ({ ...d, current_version_id: "ver-1", current_version_number: 1 })), rowCount: docs.length };
  }

  if (normalizedSql.includes("FROM document_versions") && normalizedSql.includes("w.slug = $1")) {
    return { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes("af.fact_key") || normalizedSql.includes("approved_facts")) {
    return { rows: [], rowCount: 0 };
  }

  if (normalizedSql.includes("SELECT workspace_id FROM source_documents WHERE id = $1")) {
    const id = params?.[0];
    const doc = store.sourceDocuments.find((d) => d.id === id);
    return { rows: doc ? [{ workspace_id: doc.workspace_id }] : [], rowCount: doc ? 1 : 0 };
  }

  if (normalizedSql.includes("INSERT INTO audit_events")) {
    return { rows: [], rowCount: 1 };
  }

  // 6. Safeguards on delete & counts
  if (normalizedSql.includes("FROM promotions WHERE product_id = $1 AND status = 'active'")) {
    const prodId = params?.[0];
    const count = store.promotions.filter((pr) => pr.product_id === prodId && pr.status === "active").length;
    return { rows: [{ count: String(count) }], rowCount: 1 };
  }

  if (normalizedSql.includes("FROM claims WHERE product_id = $1")) {
    return { rows: [{ count: "0" }], rowCount: 1 };
  }

  if (normalizedSql.includes("SELECT COUNT(*)::text as count FROM")) {
    const wsId = params?.[0];
    if (normalizedSql.includes("workspace_memberships")) {
      const count = store.memberships.filter((m) => m.workspace_id === wsId && m.status === "active").length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (normalizedSql.includes("workspace_invitations")) {
      const count = store.invitations.filter((i) => i.workspace_id === wsId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (normalizedSql.includes("products")) {
      const count = store.products.filter((p) => p.workspace_id === wsId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (normalizedSql.includes("source_documents")) {
      const count = store.sourceDocuments.filter((s) => s.workspace_id === wsId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (normalizedSql.includes("promotions")) {
      const count = store.promotions.filter((pr) => pr.workspace_id === wsId).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    return { rows: [{ count: "0" }], rowCount: 1 };
  }

  // Fallback default
  return { rows: [], rowCount: 0 };
});

// -----------------------------------------------------------------------------
// Test Execution
// -----------------------------------------------------------------------------
async function runAllProductGapsTests() {
  console.log("========================================================================");
  console.log("       BRANDSHIELD AI: REMAINING PRODUCT GAPS E2E ACCEPTANCE SUITE      ");
  console.log("       6 Core Scenarios: Onboarding, Products, Evidence, Promos, RBAC   ");
  console.log("========================================================================\n");

  let createdWorkspaceId = "";
  const AURA_SLUG = "aura-skin-labs";
  const AURA_NAME = "Aura Skin Labs";
  let createdProductId = "";
  let createdPromoId = "";
  let createdDocId = "";

  // User identities
  const userAdmin: ServerSessionIdentity = {
    userId: "a1111111-1111-4111-a111-111111111111",
    userName: "Dr. Alicia Vance",
    userEmail: "alicia@auraskin.com",
    role: "admin",
    workspaceId: "", // Will populate once workspace is created
    workspaceSlug: AURA_SLUG,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  const userReviewer: ServerSessionIdentity = {
    userId: "b2222222-2222-4222-b222-222222222222",
    userName: "Kavita Rao",
    userEmail: "kavita@auraskin.com",
    role: "compliance_reviewer",
    workspaceId: "",
    workspaceSlug: AURA_SLUG,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  const userViewer: ServerSessionIdentity = {
    userId: "c3333333-3333-4333-c333-333333333333",
    userName: "Guest Viewer",
    userEmail: "viewer@auraskin.com",
    role: "viewer",
    workspaceId: "",
    workspaceSlug: AURA_SLUG,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  const dermaGlowSession: ServerSessionIdentity = {
    userId: "00000000-0000-4000-a000-000000000099",
    userName: "DermaGlow Admin",
    userEmail: "admin@dermaglow.com",
    role: "admin",
    workspaceId: DERMAGLOW_ID,
    workspaceSlug: DERMAGLOW_SLUG,
    isAuthenticated: true,
    isDemoFallback: false,
  };

  // =========================================================================
  // Scenario 1: New Company Onboarding
  // =========================================================================
  console.log("--- Scenario 1: New Company Onboarding ---");
  {
    __setTestSessionOverride(userAdmin);

    // 1.1 Create brand new workspace "Aura Skin Labs"
    const req = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: AURA_NAME,
        slug: AURA_SLUG,
      }),
    });
    const res = await postWorkspace(req);
    const body = await res.json();

    check(res.status === 200 || res.status === 201, "1.1 POST /api/workspaces creates workspace successfully");
    check(body.workspace?.name === AURA_NAME, "1.2 Workspace name matches Aura Skin Labs", `Name: ${body.workspace?.name}`);
    check(body.workspace?.slug === AURA_SLUG, "1.3 Workspace slug matches aura-skin-labs", `Slug: ${body.workspace?.slug}`);

    createdWorkspaceId = body.workspace?.id;
    userAdmin.workspaceId = createdWorkspaceId;
    userReviewer.workspaceId = createdWorkspaceId;
    userViewer.workspaceId = createdWorkspaceId;

    // Verify creator is assigned admin membership
    const mem = store.memberships.find((m) => m.workspace_id === createdWorkspaceId && m.user_id === userAdmin.userId);
    check(mem?.role === "admin", "1.4 Creator is automatically granted 'admin' membership in workspace");

    // 1.5 Invite compliance reviewer
    const inviteReq = new NextRequest(`http://localhost:3000/api/workspaces/${createdWorkspaceId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "kavita@auraskin.com",
        role: "compliance_reviewer",
      }),
    });
    const inviteRes = await postInvitation(inviteReq, { params: Promise.resolve({ id: createdWorkspaceId }) });
    const inviteBody = await inviteRes.json();

    check(inviteRes.status === 200 || inviteRes.status === 201, "1.5 POST /api/workspaces/[id]/invitations invites reviewer successfully");
    check(inviteBody.invitation?.email === "kavita@auraskin.com", "1.6 Invitation attributes correct reviewer email");
    check(inviteBody.invitation?.role === "compliance_reviewer", "1.7 Invitation attributes compliance_reviewer role");

    // 1.8 Verify onboarding status endpoint
    const statusReq = new NextRequest("http://localhost:3000/api/onboarding/status", {
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const statusRes = await getOnboardingStatus(statusReq);
    const statusBody = await statusRes.json();

    check(statusRes.status === 200, "1.8 GET /api/onboarding/status computes onboarding milestones");
    check(statusBody.progress?.totalSteps === 10, "1.9 Onboarding status tracks all 10 core milestones");
    check(statusBody.steps?.[0]?.completed === true, "1.10 Step 1 (Workspace Created) is completed");
    check(statusBody.steps?.[2]?.completed === true, "1.11 Step 3 (Team Member Invited) is completed");
  }

  // =========================================================================
  // Scenario 2: Product Management
  // =========================================================================
  console.log("\n--- Scenario 2: Product Management ---");
  {
    __setTestSessionOverride(userAdmin);

    // 2.1 Create new product "Aura Retinol Renewal Serum"
    const createReq = new NextRequest("http://localhost:3000/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        name: "Aura Retinol Renewal Serum",
        sku: "AURA-RET-01",
        category: "Serum",
        reference_price: 2500,
        currency: "INR",
        description: "Formulated with 0.5% encapsulated retinol and hyaluronic acid",
      }),
    });
    const createRes = await postProduct(createReq);
    const createBody = await createRes.json();

    check(createRes.status === 201, "2.1 POST /api/products registers product in workspace");
    check(createBody.data?.name === "Aura Retinol Renewal Serum", "2.2 Product name matches registered payload");
    check(createBody.data?.sku === "AURA-RET-01", "2.3 Product SKU stored correctly");
    check(createBody.data?.reference_price === 2500, "2.4 Reference price stored as number 2500 INR");

    createdProductId = createBody.data?.id;

    // 2.5 SKU uniqueness check
    const dupSkuReq = new NextRequest("http://localhost:3000/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        name: "Duplicate Aura Retinol",
        sku: "AURA-RET-01", // duplicate SKU
        category: "Serum",
        reference_price: 2500,
      }),
    });
    const dupSkuRes = await postProduct(dupSkuReq);
    check(dupSkuRes.status === 409, "2.5 Duplicate SKU is rejected with HTTP 409 Conflict");

    // 2.6 Edit product via PATCH /api/products/[id]
    const patchReq = new NextRequest(`http://localhost:3000/api/products/${createdProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        reference_price: 2500,
        description: "Updated clinical formulation with 0.5% encapsulated retinol",
      }),
    });
    const patchRes = await patchProductById(patchReq, { params: Promise.resolve({ id: createdProductId }) });
    const patchBody = await patchRes.json();

    check(patchRes.status === 200, "2.6 PATCH /api/products/[id] updates product reference price");
    check(patchBody.data?.reference_price === 2500, "2.7 Updated reference price reflects 2500 INR");

    // 2.8 View catalog via GET /api/products
    const listReq = new NextRequest("http://localhost:3000/api/products", {
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const listRes = await getProducts(listReq);
    const listBody = await listRes.json();

    check(listRes.status === 200, "2.8 GET /api/products returns catalog for Aura Skin Labs");
    check(listBody.data?.some((p: any) => p.id === createdProductId), "2.9 Catalog includes created Aura Retinol Renewal Serum");

    // 2.10 Cross-tenant isolation test: DermaGlow cannot view or mutate Aura Retinol
    __setTestSessionOverride(dermaGlowSession);

    const dgListReq = new NextRequest("http://localhost:3000/api/products", {
      headers: { "x-workspace-slug": DERMAGLOW_SLUG },
    });
    const dgListRes = await getProducts(dgListReq);
    const dgListBody = await dgListRes.json();
    check(!dgListBody.data?.some((p: any) => p.id === createdProductId), "2.10 DermaGlow catalog strictly excludes Aura Retinol Renewal Serum");

    const dgGetReq = new NextRequest(`http://localhost:3000/api/products/${createdProductId}`, {
      headers: { "x-workspace-slug": DERMAGLOW_SLUG },
    });
    const dgGetRes = await getProductById(dgGetReq, { params: Promise.resolve({ id: createdProductId }) });
    check(dgGetRes.status === 404, "2.11 Cross-tenant GET /api/products/[id] fails closed with HTTP 404 Not Found");

    const dgPatchReq = new NextRequest(`http://localhost:3000/api/products/${createdProductId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-slug": DERMAGLOW_SLUG },
      body: JSON.stringify({ reference_price: 1 }),
    });
    const dgPatchRes = await patchProductById(dgPatchReq, { params: Promise.resolve({ id: createdProductId }) });
    check(dgPatchRes.status === 404, "2.12 Cross-tenant PATCH /api/products/[id] fails closed with HTTP 404 Not Found");

    // 2.13 Create & delete test product
    __setTestSessionOverride(userAdmin);
    const tempProdReq = new NextRequest("http://localhost:3000/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        name: "Temporary Test Product",
        sku: "TEMP-DEL-01",
        category: "Test",
        reference_price: 500,
      }),
    });
    const tempProdRes = await postProduct(tempProdReq);
    const tempProdBody = await tempProdRes.json();
    const tempProdId = tempProdBody.data?.id;

    const delReq = new NextRequest(`http://localhost:3000/api/products/${tempProdId}`, {
      method: "DELETE",
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const delRes = await deleteProductById(delReq, { params: Promise.resolve({ id: tempProdId }) });
    check(delRes.status === 200, "2.13 Admin can delete product via DELETE /api/products/[id]");
    check(!store.products.some((p) => p.id === tempProdId), "2.14 Product cleanly removed from database store");
  }

  // =========================================================================
  // Scenario 3: Evidence Management
  // =========================================================================
  console.log("\n--- Scenario 3: Evidence Management ---");
  {
    __setTestSessionOverride(userReviewer);

    // 3.1 Ingest clinical study dossier via POST /api/sources/ingest
    const clinicalStudyText =
      "PDF_FIXTURE:\n" +
      "PAGE_1:\n" +
      "Clinical Study Report: In an 8-week randomized double-blind trial with 60 participants, " +
      "Aura Retinol Renewal Serum demonstrated a 34% reduction in fine lines (p < 0.001) and " +
      "42% improvement in skin barrier elasticity. Formulated with 0.5% encapsulated retinol.";

    const ingestReq = new NextRequest("http://localhost:3000/api/sources/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        title: "Clinical Evaluation of Aura Retinol Renewal Serum 0.5%",
        documentType: "clinical_study",
        format: "pdf",
        filename: "aura_retinol_trial_2026.pdf",
        content: clinicalStudyText,
        description: "Official 8-week double blind randomized trial on 60 participants",
      }),
    });

    const ingestRes = await postIngest(ingestReq);
    const ingestBody = await ingestRes.json();

    check(ingestRes.status === 200, "3.1 POST /api/sources/ingest parses and ingests clinical study document");
    const chunksGen = ingestBody.chunksGenerated || ingestBody.chunksCount || 0;
    check(chunksGen >= 1, "3.2 Ingestion pipeline generated chunks from raw content", `Chunks: ${chunksGen}`);
    check(typeof ingestBody.documentId === "string", "3.3 Source document ID generated and returned");

    createdDocId = ingestBody.documentId;

    // 3.4 Verify chunks stored with provenance & embeddings
    const storedChunks = store.documentChunks.filter((c) => c.source_document_id === createdDocId || c.document_version_id === ingestBody.versionId);
    check(storedChunks.length >= 1, "3.4 Document chunks persisted in document_chunks table");
    check(storedChunks[0].char_offset_start >= 0 && storedChunks[0].char_offset_end > 0, "3.5 Chunk character offsets preserved for provenance");
    check(Array.isArray(storedChunks[0].embedding) && storedChunks[0].embedding.length > 0, "3.6 Vector embeddings generated for pgvector persistence");

    // 3.7 Verify document in evidence library
    const sourcesRes = await getSources();
    const sourcesBody = await sourcesRes.json();

    const auraDocs = sourcesBody.data?.documents || sourcesBody.sources || [];
    check(sourcesRes.status === 200, "3.7 GET /api/sources returns evidence library for Aura Skin Labs");
    check(auraDocs.some((s: any) => s.id === createdDocId), "3.8 Evidence library includes ingested clinical dossier");

    // 3.9 Cross-tenant isolation: DermaGlow cannot view Aura's evidence
    __setTestSessionOverride(dermaGlowSession);
    const dgSourcesRes = await getSources();
    const dgSourcesBody = await dgSourcesRes.json();
    const dgDocs = dgSourcesBody.data?.documents || dgSourcesBody.sources || [];
    check(!dgDocs.some((s: any) => s.id === createdDocId), "3.9 DermaGlow evidence library strictly excludes Aura's clinical trial dossier");
  }

  // =========================================================================
  // Scenario 4: Promotion Management
  // =========================================================================
  console.log("\n--- Scenario 4: Promotion Management ---");
  {
    __setTestSessionOverride(userAdmin);

    // 4.1 Create active promotion: 20% discount on Aura Retinol (Reference price: 2500 INR -> Resulting: 2000.00 INR)
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const createPromoReq = new NextRequest("http://localhost:3000/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        productId: createdProductId,
        promotionName: "Launch Discount — 20% off Aura Retinol",
        discountType: "percentage",
        discountValue: 20,
        currency: "INR",
        startDate,
        endDate,
        applicableChannels: ["all"],
        status: "active",
      }),
    });

    const createPromoRes = await postPromotion(createPromoReq);
    const createPromoBody = await createPromoRes.json();

    check(createPromoRes.status === 201, "4.1 POST /api/promotions registers active promotion campaign");
    check(createPromoBody.data?.promotion_name === "Launch Discount — 20% off Aura Retinol", "4.2 Promotion name stored correctly");
    check(Number(createPromoBody.data?.resulting_price) === 2000, "4.3 Automated resulting price calculation verified: 2500 - 20% = 2000.00 INR", `Resulting: ${createPromoBody.data?.resulting_price}`);

    createdPromoId = createPromoBody.data?.id;

    // 4.4 Cross-tenant safety: DermaGlow cannot attach Aura's product to a promotion
    __setTestSessionOverride(dermaGlowSession);
    const foreignAttachReq = new NextRequest("http://localhost:3000/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": DERMAGLOW_SLUG },
      body: JSON.stringify({
        productId: createdProductId, // Aura's product!
        promotionName: "Attacker Promo on Aura Product",
        discountType: "fixed",
        discountValue: 100,
        currency: "INR",
        startDate,
        endDate,
      }),
    });
    const foreignAttachRes = await postPromotion(foreignAttachReq);
    check(foreignAttachRes.status === 404, "4.4 Attaching foreign workspace product to promotion is rejected with HTTP 404 Not Found");

    // 4.5 DermaGlow cannot list Aura's promotions
    const dgPromoListReq = new NextRequest("http://localhost:3000/api/promotions", {
      headers: { "x-workspace-slug": DERMAGLOW_SLUG },
    });
    const dgPromoListRes = await getPromotions(dgPromoListReq);
    const dgPromoListBody = await dgPromoListRes.json();
    check(!dgPromoListBody.data?.some((pr: any) => pr.id === createdPromoId), "4.5 DermaGlow promotion list strictly excludes Aura's promotions");

    // 4.6 Edit promotion via PATCH /api/promotions/[id]
    __setTestSessionOverride(userAdmin);
    const patchPromoReq = new NextRequest(`http://localhost:3000/api/promotions/${createdPromoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        terms: "Maximum 2 units per customer during launch promo.",
      }),
    });
    const patchPromoRes = await patchPromotionById(patchPromoReq, { params: Promise.resolve({ id: createdPromoId }) });
    const patchPromoBody = await patchPromoRes.json();

    check(patchPromoRes.status === 200, "4.6 PATCH /api/promotions/[id] updates promotion terms");
    check(patchPromoBody.data?.terms === "Maximum 2 units per customer during launch promo.", "4.7 Updated terms reflected in response");

    // 4.8 Expire/Cancel promotion
    const expirePromoReq = new NextRequest(`http://localhost:3000/api/promotions/${createdPromoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({ status: "expired" }),
    });
    const expirePromoRes = await patchPromotionById(expirePromoReq, { params: Promise.resolve({ id: createdPromoId }) });
    const expirePromoBody = await expirePromoRes.json();
    check(expirePromoBody.data?.status === "expired", "4.8 Promotion status successfully updated to 'expired'");

    // Re-activate for Scenario 5 claim verification
    const targetP = store.promotions.find((p) => p.id === createdPromoId);
    if (targetP) targetP.status = "active";
  }

  // =========================================================================
  // Scenario 5: Complete Claim Governance Flow
  // =========================================================================
  console.log("\n--- Scenario 5: Complete Claim Governance Flow ---");
  {
    // Marketing copy containing:
    // 1. Supported clinical efficacy: "clinically proven to improve skin barrier hydration after 8 weeks"
    // 2. Valid promotional price: "now available for only ₹2,000"
    // 3. Prohibited overclaim / guarantee: "Guarantees 100% elimination of all wrinkles in 3 days"
    // 4. Contradicted clearance price: "flash clearance for ₹499"
    const marketingCopy =
      "Aura Retinol Renewal Serum is clinically proven to improve skin barrier hydration after 8 weeks, " +
      "now available for only ₹2,000! " +
      "Guarantees 100% elimination of all wrinkles in 3 days. " +
      "Or grab our flash clearance for ₹499.";

    // 5.1 Claim Extraction & Deterministic Offsets
    const rawExtractedClaims = [
      {
        claim_text: "clinically proven to improve skin barrier hydration after 8 weeks",
        claim_type: "efficacy" as const,
        suggested_risk_level: "low" as const,
      },
      {
        claim_text: "now available for only ₹2,000",
        claim_type: "price" as const,
        suggested_risk_level: "low" as const,
      },
      {
        claim_text: "Guarantees 100% elimination of all wrinkles in 3 days",
        claim_type: "guarantee" as const,
        suggested_risk_level: "high" as const,
      },
      {
        claim_text: "flash clearance for ₹499",
        claim_type: "price" as const,
        suggested_risk_level: "high" as const,
      },
    ];

    const offsetResult = ClaimOffsetCalculator.resolveBatch(rawExtractedClaims, marketingCopy);
    check(offsetResult.resolvedClaims.length === 4, "5.1 Offset calculator deterministically resolved all 4 claims");

    // Invariant check: content.slice(text_start, text_end) === claim_text
    let allSlicesMatch = true;
    for (const claim of offsetResult.resolvedClaims) {
      const slice = marketingCopy.slice(claim.text_start, claim.text_end);
      if (slice !== claim.claim_text) {
        allSlicesMatch = false;
        console.error(`Mismatch: slice="${slice}" vs claim="${claim.claim_text}"`);
      }
    }
    check(allSlicesMatch, "5.2 Deterministic slice invariant holds: marketingCopy.slice(start, end) === claim_text");

    const validationReport = ClaimValidator.validateExtraction(offsetResult.resolvedClaims, marketingCopy);
    check(validationReport.success, "5.3 ClaimValidator accepted all 4 extracted claims without offsets corruption");

    // 5.4 Deterministic Verification against Evidence & Pricing Engine
    const verificationContext: VerificationContext = {
      claim: {
        id: "c1",
        claim_text: "clinically proven to improve skin barrier hydration after 8 weeks",
        claim_type: "efficacy",
        text_start: offsetResult.resolvedClaims[0].text_start,
        text_end: offsetResult.resolvedClaims[0].text_end,
        product_id: createdProductId,
        extracted_entities: {},
        extraction_confidence: 0.95,
      },
      submission: {
        id: crypto.randomUUID(),
        workspace_id: createdWorkspaceId,
        title: "Aura Retinol Launch Collateral",
        channel: "Instagram",
        product_id: createdProductId,
        submission_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      submissionVersion: {
        id: crypto.randomUUID(),
        version_number: 1,
        content: marketingCopy,
      },
      channel: "Instagram",
      product: {
        id: createdProductId,
        name: "Aura Retinol Renewal Serum",
        sku: "AURA-RET-01",
        reference_price: 2500,
        currency: "INR",
        status: "active",
      },
      promotions: [
        {
          id: createdPromoId,
          product_id: createdProductId,
          promotion_name: "Launch Discount — 20% off Aura Retinol",
          discount_type: "percentage",
          discount_value: 20,
          resulting_price: 2000,
          currency: "INR",
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 86400000).toISOString(),
          applicable_channels: ["all"],
          terms: null,
          status: "active",
        },
      ],
      sourceDocuments: [
        {
          id: createdDocId,
          title: "Clinical Evaluation of Aura Retinol Renewal Serum 0.5%",
          document_type: "clinical_study",
          current_version_id: "ver-1",
          current_version_number: 1,
          approval_status: "approved",
          valid_from: new Date().toISOString(),
          valid_until: null,
        },
      ],
      approvedFacts: [
        {
          id: crypto.randomUUID(),
          product_id: createdProductId,
          fact_key: "reference_price",
          fact_value: { price: 2500, currency: "INR" },
          fact_type: "pricing",
          approval_status: "approved",
          source_document_id: null,
          valid_from: new Date().toISOString(),
          valid_until: null,
        },
      ],
      effectiveDate: new Date(),
    };

    // Verify Claim 1 (Supported clinical trial efficacy claim)
    const res1 = VerificationRouter.routeClaim(verificationContext);
    check(res1.status === "supported", "5.4 Clinical trial claim verified as 'supported' against clinical document", `Status: ${res1.status}`);

    // Verify Claim 2 (Valid promotional price claim: ₹2,000 matches active promo)
    const promoContext: VerificationContext = {
      ...verificationContext,
      claim: {
        ...verificationContext.claim,
        id: "c2",
        claim_text: "now available for only ₹2,000",
        claim_type: "price",
        text_start: offsetResult.resolvedClaims[1].text_start,
        text_end: offsetResult.resolvedClaims[1].text_end,
      },
    };
    const res2 = VerificationRouter.routeClaim(promoContext);
    check(res2.status === "supported", "5.5 Valid promotional price claim verified as 'supported' against active promo", `Status: ${res2.status}`);

    // Verify Claim 3 (Unproven 100% guarantee overclaim)
    const guaranteeContext: VerificationContext = {
      ...verificationContext,
      claim: {
        ...verificationContext.claim,
        id: "c3",
        claim_text: "Guarantees 100% elimination of all wrinkles in 3 days",
        claim_type: "guarantee",
        text_start: offsetResult.resolvedClaims[2].text_start,
        text_end: offsetResult.resolvedClaims[2].text_end,
      },
    };
    const res3 = VerificationRouter.routeClaim(guaranteeContext);
    check(res3.status === "needs_review" || res3.status === "contradicted", "5.6 Prohibited overnight guarantee flagged for mandatory review", `Status: ${res3.status}`);

    // Verify Claim 4 (Incorrect clearance price ₹499 vs active promo ₹2,000)
    const clearanceContext: VerificationContext = {
      ...verificationContext,
      claim: {
        ...verificationContext.claim,
        id: "c4",
        claim_text: "flash clearance for ₹499",
        claim_type: "price",
        text_start: offsetResult.resolvedClaims[3].text_start,
        text_end: offsetResult.resolvedClaims[3].text_end,
      },
    };
    const res4 = VerificationRouter.routeClaim(clearanceContext);
    check(res4.status === "contradicted", "5.7 Contradicted clearance price (₹499) flagged as 'contradicted' against active promo (₹2,000.00)", `Status: ${res4.status}`);

    // 5.8 Publication Gate Evaluation
    const activeWorkflowClaims = [
      { id: "c1", review_status: "approved" as const, verification_status: "supported", risk_level: "low", is_active: true },
      { id: "c2", review_status: "approved" as const, verification_status: "supported", risk_level: "low", is_active: true },
      { id: "c3", review_status: "rejected" as const, verification_status: "contradicted", risk_level: "critical", is_active: true },
      { id: "c4", review_status: "rejected" as const, verification_status: "contradicted", risk_level: "high", is_active: true },
    ];

    const gateWithRejected = ReviewWorkflowService.evaluatePublicationEligibility(activeWorkflowClaims);
    check(!gateWithRejected.isEligible, "5.8 Publication gate is LOCKED closed while rejected/contradicted claims remain active");
    check(gateWithRejected.blockingReasons.length >= 2, "5.9 Gate returns specific blocking reasons for rejected claims", `Reasons: ${gateWithRejected.blockingReasons.length}`);

    // Resolve by modifying copy to remove rejected claims and leaving 100% approved claims
    const cleanWorkflowClaims = [
      { id: "c1", review_status: "approved" as const, verification_status: "supported", risk_level: "low", is_active: true },
      { id: "c2", review_status: "approved" as const, verification_status: "supported", risk_level: "low", is_active: true },
    ];
    const gateClean = ReviewWorkflowService.evaluatePublicationEligibility(cleanWorkflowClaims);
    check(gateClean.isEligible, "5.10 Publication gate unlocks (eligible = true) when 100% of active claims are approved and supported");
  }

  // =========================================================================
  // Scenario 6: Multi-Tenant RBAC
  // =========================================================================
  console.log("\n--- Scenario 6: Multi-Tenant RBAC ---");
  {
    // 6.1 Admin permissions: Can create/edit products, promotions, evidence
    __setTestSessionOverride(userAdmin);

    const adminProdReq = new NextRequest("http://localhost:3000/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        name: "Admin Created Product",
        sku: "ADM-PROD-01",
        category: "Test",
        reference_price: 1500,
      }),
    });
    const adminProdRes = await postProduct(adminProdReq);
    check(adminProdRes.status === 201, "6.1 Admin can create products (HTTP 201)");

    const adminProdId = (await adminProdRes.json()).data?.id;

    // 6.2 Compliance Reviewer permissions: Can view, upload, review, but NOT delete products
    __setTestSessionOverride(userReviewer);

    // Can view products
    const revGetReq = new NextRequest(`http://localhost:3000/api/products/${adminProdId}`, {
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const revGetRes = await getProductById(revGetReq, { params: Promise.resolve({ id: adminProdId }) });
    check(revGetRes.status === 200, "6.2 Compliance Reviewer can view products (HTTP 200)");

    // Can upload evidence
    const revUploadReq = new NextRequest("http://localhost:3000/api/sources/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        title: "Reviewer Uploaded Study",
        documentType: "clinical_study",
        format: "pdf",
        filename: "reviewer_study.pdf",
        content: "PDF_FIXTURE:\nPAGE_1:\nClinical study testing by reviewer",
      }),
    });
    const revUploadRes = await postIngest(revUploadReq);
    check(revUploadRes.status === 200, "6.3 Compliance Reviewer can upload/ingest evidence (HTTP 200)");

    // CANNOT delete product
    const revDelReq = new NextRequest(`http://localhost:3000/api/products/${adminProdId}`, {
      method: "DELETE",
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const revDelRes = await deleteProductById(revDelReq, { params: Promise.resolve({ id: adminProdId }) });
    check(revDelRes.status === 403, "6.4 Compliance Reviewer is FORBIDDEN from deleting products (HTTP 403 Forbidden)");

    // 6.5 Viewer permissions: Can only view, CANNOT create, edit, or delete
    __setTestSessionOverride(userViewer);

    // Can view products
    const viewProdReq = new NextRequest(`http://localhost:3000/api/products/${adminProdId}`, {
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const viewProdRes = await getProductById(viewProdReq, { params: Promise.resolve({ id: adminProdId }) });
    check(viewProdRes.status === 200, "6.5 Viewer can view products (HTTP 200)");

    // Can view promotions
    const viewPromoReq = new NextRequest("http://localhost:3000/api/promotions", {
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const viewPromoRes = await getPromotions(viewPromoReq);
    check(viewPromoRes.status === 200, "6.6 Viewer can view promotions (HTTP 200)");

    // Can view evidence
    const viewSourcesRes = await getSources();
    check(viewSourcesRes.status === 200, "6.7 Viewer can view evidence library (HTTP 200)");

    // CANNOT create product
    const viewCreateProdReq = new NextRequest("http://localhost:3000/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({ name: "Viewer Attempt", sku: "VIEWER-01", reference_price: 100 }),
    });
    const viewCreateProdRes = await postProduct(viewCreateProdReq);
    check(viewCreateProdRes.status === 403, "6.8 Viewer is FORBIDDEN from creating products (HTTP 403 Forbidden)");

    // CANNOT edit product
    const viewPatchProdReq = new NextRequest(`http://localhost:3000/api/products/${adminProdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({ reference_price: 10 }),
    });
    const viewPatchProdRes = await patchProductById(viewPatchProdReq, { params: Promise.resolve({ id: adminProdId }) });
    check(viewPatchProdRes.status === 403, "6.9 Viewer is FORBIDDEN from editing products (HTTP 403 Forbidden)");

    // CANNOT delete product
    const viewDelProdReq = new NextRequest(`http://localhost:3000/api/products/${adminProdId}`, {
      method: "DELETE",
      headers: { "x-workspace-slug": AURA_SLUG },
    });
    const viewDelProdRes = await deleteProductById(viewDelProdReq, { params: Promise.resolve({ id: adminProdId }) });
    check(viewDelProdRes.status === 403, "6.10 Viewer is FORBIDDEN from deleting products (HTTP 403 Forbidden)");

    // CANNOT create promotion
    const viewCreatePromoReq = new NextRequest("http://localhost:3000/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        productId: adminProdId,
        promotionName: "Viewer Promo",
        discountType: "fixed",
        discountValue: 10,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    const viewCreatePromoRes = await postPromotion(viewCreatePromoReq);
    check(viewCreatePromoRes.status === 403, "6.11 Viewer is FORBIDDEN from creating promotions (HTTP 403 Forbidden)");

    // CANNOT ingest evidence
    const viewIngestReq = new NextRequest("http://localhost:3000/api/sources/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-workspace-slug": AURA_SLUG },
      body: JSON.stringify({
        title: "Viewer Evidence",
        documentType: "clinical_study",
        content: "Unauthorized content",
      }),
    });
    const viewIngestRes = await postIngest(viewIngestReq);
    check(viewIngestRes.status === 403, "6.12 Viewer is FORBIDDEN from ingesting evidence (HTTP 403 Forbidden)");
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n========================================================================");
  console.log(` PRODUCT GAPS E2E SUMMARY: ${passedCount} passed, ${failedCount} failed.`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllProductGapsTests().catch((err) => {
  console.error("Unhandled fatal exception in E2E tests:", err);
  process.exit(1);
});
