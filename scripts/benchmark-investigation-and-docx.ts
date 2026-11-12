/**
 * BrandShield AI — Performance Discrepancy Investigation & DOCX Ingestion Suite
 *
 * Controlled benchmarks:
 * 1. 25 iterations of Sequential SQL queries
 * 2. 25 iterations of Concurrent SQL queries (Promise.all)
 * 3. 25 iterations of Complete HTTP API (/api/sources)
 *
 * Ingestion:
 * 4. Synthetic valid DOCX generation and full ingestion verification
 * 5. Supported vs Unsupported format gating (PDF, DOCX, TXT, MD vs CSV, PNG)
 * 6. Document content retrieval, metadata & citations via /api/sources/[id]/content
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { query, getDbPool } from "../src/lib/db/server-db";
import { DocumentIngestionService } from "../src/lib/rag/ingestion/document-ingestion-service";
import { DocxDocumentParser } from "../src/lib/rag/ingestion/docx-parser";
import { UnsupportedFormatError } from "../src/lib/rag/ingestion/parser-interface";

const BASE_URL = "http://localhost:3000";
const WORKSPACE_SLUG = "dermaglow";

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function calculateStats(latencies: number[]): { avg: number; median: number; p95: number; min: number; max: number } {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / sorted.length) * 10) / 10;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p95 = sorted[p95Idx] ?? sorted[sorted.length - 1];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { avg, median, p95, min, max };
}

// ---------------------------------------------------------------------------
// 5 Exact SQL Queries from /api/sources
// ---------------------------------------------------------------------------
const Q1 = `
  SELECT 
    sd.id, sd.title, sd.document_type, sd.description, sd.approval_status,
    sd.created_at, sd.updated_at, sd.current_version_id,
    dv.version_number as current_version_number, dv.storage_path, dv.content_hash,
    dv.approval_date, dv.valid_from, dv.valid_until,
    (dv.valid_until IS NOT NULL AND dv.valid_until < now()) as is_expired,
    (dv.superseded_at IS NOT NULL OR dv.approval_status = 'superseded') as is_superseded
  FROM source_documents sd
  LEFT JOIN document_versions dv ON sd.current_version_id = dv.id
  JOIN workspaces w ON sd.workspace_id = w.id
  WHERE w.slug = $1
  ORDER BY sd.created_at DESC;
`;

const Q2 = `
  SELECT 
    dv.id, dv.source_document_id, dv.version_number, dv.storage_path, dv.content_hash,
    dv.approval_date, dv.valid_from, dv.valid_until, dv.superseded_at, dv.approval_status,
    dv.created_at,
    (dv.valid_until IS NOT NULL AND dv.valid_until < now()) as is_expired,
    (dv.superseded_at IS NOT NULL OR dv.approval_status = 'superseded') as is_superseded,
    (sd.current_version_id = dv.id) as is_current
  FROM document_versions dv
  JOIN source_documents sd ON dv.source_document_id = sd.id
  JOIN workspaces w ON sd.workspace_id = w.id
  WHERE w.slug = $1
  ORDER BY dv.source_document_id, dv.version_number DESC;
`;

const Q3 = `
  SELECT 
    p.id, p.name, p.sku, p.description, p.category, p.reference_price,
    p.currency, p.status, p.created_at, p.updated_at
  FROM products p
  JOIN workspaces w ON p.workspace_id = w.id
  WHERE w.slug = $1
  ORDER BY p.name ASC;
`;

const Q4 = `
  SELECT 
    af.id, af.product_id, p.name as product_name, p.sku as product_sku,
    af.fact_key, af.fact_value, af.fact_type, af.approval_status,
    af.source_document_id, sd.title as source_document_title,
    af.valid_from, af.valid_until,
    (af.valid_until IS NOT NULL AND af.valid_until < now()) as is_expired,
    af.created_at
  FROM approved_facts af
  JOIN products p ON af.product_id = p.id
  JOIN workspaces w ON p.workspace_id = w.id
  LEFT JOIN source_documents sd ON af.source_document_id = sd.id
  WHERE w.slug = $1
  ORDER BY af.created_at ASC;
`;

const Q5 = `
  SELECT 
    pr.id, pr.product_id, p.name as product_name, pr.promotion_name,
    pr.discount_type, pr.discount_value, pr.resulting_price, pr.currency,
    pr.start_date, pr.end_date, pr.applicable_channels, pr.terms, pr.status,
    (now() BETWEEN pr.start_date AND pr.end_date AND pr.status = 'active') as is_currently_active,
    pr.created_at
  FROM promotions pr
  JOIN products p ON pr.product_id = p.id
  JOIN workspaces w ON p.workspace_id = w.id
  WHERE w.slug = $1
  ORDER BY pr.start_date DESC;
`;

async function executeSequential(slug: string): Promise<number> {
  const t0 = performance.now();
  await query(Q1, [slug]);
  await query(Q2, [slug]);
  await query(Q3, [slug]);
  await query(Q4, [slug]);
  await query(Q5, [slug]);
  return Math.round((performance.now() - t0) * 10) / 10;
}

async function executeConcurrent(slug: string): Promise<number> {
  const t0 = performance.now();
  await Promise.all([
    query(Q1, [slug]),
    query(Q2, [slug]),
    query(Q3, [slug]),
    query(Q4, [slug]),
    query(Q5, [slug]),
  ]);
  return Math.round((performance.now() - t0) * 10) / 10;
}

function createValidSyntheticDocx(xmlBody: string): Buffer {
  const fileName = "word/document.xml";
  const fileBytes = Buffer.from(xmlBody, "utf-8");
  const fileNameBytes = Buffer.from(fileName, "utf-8");

  // Local file header (30 bytes + fileName.length + fileBytes.length)
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0, 6);  // bit flag
  header.writeUInt16LE(0, 8);  // compression: 0 (Stored)
  header.writeUInt16LE(0, 10); // time
  header.writeUInt16LE(0, 12); // date
  header.writeUInt32LE(0, 14); // crc32
  header.writeUInt32LE(fileBytes.length, 18); // compressed size
  header.writeUInt32LE(fileBytes.length, 22); // uncompressed size
  header.writeUInt16LE(fileNameBytes.length, 26); // file name length
  header.writeUInt16LE(0, 28); // extra field length

  return Buffer.concat([header, fileNameBytes, fileBytes]);
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "elena.vance@dermaglow.com",
      password: "BrandShield2026!",
    }),
  });

  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
  return cookies.map((c) => (c || "").split(";")[0]).filter(Boolean).join("; ");
}

async function main() {
  console.log("================================================================================");
  console.log(" BRANDSHIELD AI: CONTROLLED PERFORMANCE DISCREPANCY & DOCX VERIFICATION         ");
  console.log("================================================================================\n");

  // Ensure DB connection is warm
  console.log("1. Warming up database connection pool...");
  await query("SELECT 1;");
  for (let i = 0; i < 3; i++) {
    await executeSequential(WORKSPACE_SLUG);
    await executeConcurrent(WORKSPACE_SLUG);
  }
  console.log("   Pool warmed up.\n");

  // ---------------------------------------------------------------------------
  // BENCHMARK A: 25 Iterations of Sequential Raw DB Execution
  // ---------------------------------------------------------------------------
  console.log("2. Running 25 Measured Iterations: SEQUENTIAL Database Execution...");
  const seqTimes: number[] = [];
  for (let i = 0; i < 25; i++) {
    const t = await executeSequential(WORKSPACE_SLUG);
    seqTimes.push(t);
  }
  const seqStats = calculateStats(seqTimes);
  console.log(`   Sequential DB Query Time:`);
  console.log(`   - Average: ${seqStats.avg} ms`);
  console.log(`   - Median:  ${seqStats.median} ms`);
  console.log(`   - p95:     ${seqStats.p95} ms`);
  console.log(`   - Min/Max: ${seqStats.min} ms / ${seqStats.max} ms\n`);

  // ---------------------------------------------------------------------------
  // BENCHMARK B: 25 Iterations of Concurrent Raw DB Execution (Promise.all)
  // ---------------------------------------------------------------------------
  console.log("3. Running 25 Measured Iterations: CONCURRENT Database Execution (Promise.all)...");
  const conTimes: number[] = [];
  for (let i = 0; i < 25; i++) {
    const t = await executeConcurrent(WORKSPACE_SLUG);
    conTimes.push(t);
  }
  const conStats = calculateStats(conTimes);
  console.log(`   Concurrent DB Query Time:`);
  console.log(`   - Average: ${conStats.avg} ms`);
  console.log(`   - Median:  ${conStats.median} ms`);
  console.log(`   - p95:     ${conStats.p95} ms`);
  console.log(`   - Min/Max: ${conStats.min} ms / ${conStats.max} ms\n`);

  const dbDeltaAvg = Math.round((seqStats.avg - conStats.avg) * 10) / 10;
  const dbImprovement = Math.round(((seqStats.avg - conStats.avg) / seqStats.avg) * 1000) / 10;
  console.log(`   >>> RAW DB LEVEL GAIN: Concurrent is ${dbDeltaAvg} ms faster (${dbImprovement}% reduction in DB query time) <<<\n`);

  // ---------------------------------------------------------------------------
  // BENCHMARK C: 25 Iterations of Complete HTTP API (/api/sources)
  // ---------------------------------------------------------------------------
  console.log("4. Running 25 Measured Iterations: Complete HTTP API (/api/sources) Latency...");
  const cookie = await login();

  // Warm-up 3 runs
  for (let i = 0; i < 3; i++) {
    await fetch(`${BASE_URL}/api/sources`, { headers: { Cookie: cookie }, cache: "no-store" });
  }

  const apiTimes: number[] = [];
  for (let i = 0; i < 25; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE_URL}/api/sources`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    const t = Math.round((performance.now() - t0) * 10) / 10;
    if (res.status === 200) apiTimes.push(t);
  }
  const apiStats = calculateStats(apiTimes);
  console.log(`   Complete API Response Time (/api/sources):`);
  console.log(`   - Average: ${apiStats.avg} ms`);
  console.log(`   - Median:  ${apiStats.median} ms`);
  console.log(`   - p95:     ${apiStats.p95} ms`);
  console.log(`   - Min/Max: ${apiStats.min} ms / ${apiStats.max} ms\n`);

  // ---------------------------------------------------------------------------
  // 5. VALID SYNTHETIC DOCX INGESTION & CONTENT VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("5. Testing Valid Synthetic DOCX Ingestion...");

  const docxXml = `
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
          <w:r><w:t>Clinical Trial Protocol — DermaGlow Vitamin C Efficacy</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>In an 8-week randomized double-blind clinical trial with 45 human subjects, topical application of 10% stabilised Vitamin C demonstrated significant improvement in skin radiance and barrier hydration.</w:t></w:r>
        </w:p>
        <w:p>
          <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
          <w:r><w:t>Safety and Tolerability Endpoints</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>Zero adverse dermatological events or erythema reported across the full treatment cohort.</w:t></w:r>
        </w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Cohort</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Patients</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Hydration Gain</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Active 10%</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>23</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>+38%</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Placebo</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>22</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>+4%</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `.trim();

  const validDocxBuffer = createValidSyntheticDocx(docxXml);
  const parser = new DocxDocumentParser();
  const parsedDocx = await parser.parse(validDocxBuffer, {
    title: "QA Synthetic Clinical Protocol (DOCX)",
    documentType: "clinical_dossier",
    filename: "synthetic-protocol.docx",
  });

  console.log(`   - Valid DOCX format accepted:   true`);
  console.log(`   - Extracted characters:         ${parsedDocx.totalCharacters}`);
  console.log(`   - Extracted sections count:     ${parsedDocx.sections.length}`);
  console.log(`   - Table structure parsed:       ${Boolean(parsedDocx.tables && parsedDocx.tables.length > 0 || parsedDocx.rawText.includes("| Cohort |"))}`);
  console.log(`   - Section 1 Heading:            "${parsedDocx.sections[0]?.heading}"`);
  console.log(`   - Section 2 Heading:            "${parsedDocx.sections[1]?.heading}"\n`);

  // Ingest through DocumentIngestionService
  const ingestionResult = await DocumentIngestionService.ingestDocument(validDocxBuffer, {
    title: "QA Synthetic Clinical Protocol (DOCX)",
    documentType: "clinical_dossier",
    format: "docx",
    filename: "synthetic-protocol.docx",
  });

  console.log(`   DocumentIngestionService Ingestion Result:`);
  console.log(`   - Format Detected: ${ingestionResult.format}`);
  console.log(`   - Total Characters: ${ingestionResult.totalCharacters}`);
  console.log(`   - Sections: ${ingestionResult.sections.length}`);
  console.log(`   - Verbatim Text Snippet: "${ingestionResult.rawText.substring(0, 80)}..."\n`);

  // ---------------------------------------------------------------------------
  // 6. CONTENT RETRIEVAL & CITATION NAVIGATION ON APPROVED EVIDENCE
  // ---------------------------------------------------------------------------
  console.log("6. Verifying Evidence Content Retrieval & Citations...");
  const sourcesRes = await fetch(`${BASE_URL}/api/sources`, {
    headers: { Cookie: cookie },
    cache: "no-store",
  });
  const sourcesJson = await sourcesRes.json();
  const activeDoc = sourcesJson.data.documents[0];

  const contentRes = await fetch(`${BASE_URL}/api/sources/${activeDoc.id}/content`, {
    headers: { Cookie: cookie },
  });
  const contentJson = await contentRes.json();

  console.log(`   - Document ID:             ${activeDoc.id}`);
  console.log(`   - Document Title:          "${contentJson.document?.title}"`);
  console.log(`   - Document Type:           ${contentJson.document?.documentType}`);
  console.log(`   - Current Version:         v${contentJson.document?.currentVersion?.versionNumber}`);
  console.log(`   - Total Document Pages:    ${contentJson.document?.totalPages}`);
  console.log(`   - Citation Spans Loaded:   ${contentJson.document?.pages?.length >= 1 ? "PASSED" : "FAILED"}\n`);

  // ---------------------------------------------------------------------------
  // 7. FORMAT BOUNDARIES RE-CONFIRMATION
  // ---------------------------------------------------------------------------
  console.log("7. Confirming Format Boundaries (Supported vs Unsupported)...");

  // Format 1: Markdown (Supported)
  const mdOk = await DocumentIngestionService.ingestDocument("# Title\nValid Markdown content", {
    title: "MD Test", documentType: "clinical_study", format: "md"
  }).then(() => true).catch(() => false);

  // Format 2: Plain Text (Supported)
  const txtOk = await DocumentIngestionService.ingestDocument("Valid Text content for dossier", {
    title: "TXT Test", documentType: "scientific_study", format: "txt"
  }).then(() => true).catch(() => false);

  // Format 3: PDF (Supported)
  const pdfOk = await DocumentIngestionService.ingestDocument(
    "PDF_FIXTURE: Clinical Trial Protocol digital text content",
    { title: "PDF Test", documentType: "clinical_dossier", format: "pdf" }
  ).then(() => true).catch(() => false);

  // Format 4: DOCX (Supported)
  const docxOk = await DocumentIngestionService.ingestDocument(validDocxBuffer, {
    title: "DOCX Test", documentType: "clinical_dossier", format: "docx"
  }).then(() => true).catch(() => false);

  // Format 5: CSV (Unsupported - must reject)
  let csvRejected = false;
  let csvError = "";
  try {
    await DocumentIngestionService.ingestDocument("col1,col2\nval1,val2", {
      title: "CSV Test", documentType: "lab_test_report", format: "csv"
    });
  } catch (err: any) {
    csvRejected = true;
    csvError = err.message;
  }

  // Format 6: PNG Image (Unsupported - must reject)
  let pngRejected = false;
  let pngError = "";
  try {
    await DocumentIngestionService.ingestDocument(Buffer.from("\x89PNG\r\n\x1a\n"), {
      title: "PNG Test", documentType: "scientific_study", format: "png"
    });
  } catch (err: any) {
    pngRejected = true;
    pngError = err.message;
  }

  console.log(`   - Markdown (.md) Supported:  ${mdOk ? "PASSED" : "FAILED"}`);
  console.log(`   - Plain Text (.txt) Supported: ${txtOk ? "PASSED" : "FAILED"}`);
  console.log(`   - PDF (.pdf) Supported:        ${pdfOk ? "PASSED" : "FAILED"}`);
  console.log(`   - DOCX (.docx) Supported:      ${docxOk ? "PASSED" : "FAILED"}`);
  console.log(`   - CSV (.csv) Rejected:         ${csvRejected ? "PASSED" : "FAILED"} ("${csvError}")`);
  console.log(`   - Image (.png) Rejected:       ${pngRejected ? "PASSED" : "FAILED"} ("${pngError}")\n`);

  console.log("================================================================================");
  console.log(" SUMMARY TABLE:");
  console.log("================================================================================");
  console.log(`| Execution Strategy | Average | Median | p95 | Min | Max | Iterations |`);
  console.log(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);
  console.log(`| **Sequential DB Queries** | ${seqStats.avg} ms | ${seqStats.median} ms | ${seqStats.p95} ms | ${seqStats.min} ms | ${seqStats.max} ms | 25 |`);
  console.log(`| **Concurrent DB Queries** | ${conStats.avg} ms | ${conStats.median} ms | ${conStats.p95} ms | ${conStats.min} ms | ${conStats.max} ms | 25 |`);
  console.log(`| **Complete API Response** | ${apiStats.avg} ms | ${apiStats.median} ms | ${apiStats.p95} ms | ${apiStats.min} ms | ${apiStats.max} ms | 25 |`);
  console.log("================================================================================");
}

main().catch(console.error);

