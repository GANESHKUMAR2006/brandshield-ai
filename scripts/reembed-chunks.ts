/**
 * BrandShield AI — Document Chunks Re-Embedding & Vector Backfill Utility
 * Phase 7 & Production Embedding Maintenance
 *
 * Safe, repeatable, non-destructive background job to generate and backfill
 * 1536-dimensional pgvector embeddings for document chunks.
 *
 * Usage:
 *   npx tsx scripts/reembed-chunks.ts [--dry-run] [--force] [--batch-size=10]
 */

import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local when running standalone via tsx
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvLocal();

import {
  getConfiguredEmbeddingProvider,
  PGVECTOR_EMBEDDING_DIMENSION,
} from "../src/lib/rag/embeddings/embedding-provider";

interface ChunkRecord {
  id: string;
  document_version_id: string;
  chunk_index: number;
  content: string;
  has_embedding: boolean;
  current_dims: number | null;
}

async function resolveConnectionString(): Promise<string> {
  let connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("SUPABASE_DATABASE_URL=")) {
          connectionString = trimmed
            .substring("SUPABASE_DATABASE_URL=".length)
            .trim()
            .replace(/^["']|["']$/g, "");
          break;
        }
      }
    }
  }

  if (!connectionString) {
    throw new Error(
      "SUPABASE_DATABASE_URL is required to run re-embedding utility."
    );
  }

  // If using Supabase session pooler on port 5432, prefer transaction pooler on port 6543
  if (connectionString.includes(".pooler.supabase.com:5432")) {
    connectionString = connectionString.replace(":5432", ":6543");
  }

  return connectionString;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1], 10) : 10;

  console.log("========================================================================");
  console.log(" BrandShield AI — Document Chunks Re-Embedding Utility                  ");
  console.log("========================================================================");
  console.log(`Mode:       ${isDryRun ? "DRY-RUN (No database writes)" : "LIVE EXECUTION"}`);
  console.log(`Force:      ${isForce ? "Yes (re-embed all chunks)" : "No (only un-embedded chunks)"}`);
  console.log(`Batch Size: ${batchSize}`);

  // 1. Resolve Embedding Provider
  let provider;
  try {
    provider = getConfiguredEmbeddingProvider();
    console.log(`Provider:   ${provider.providerName} (${provider.modelIdentifier})`);
    console.log(`Dimensions: ${provider.dimension} (pgvector standard)`);
  } catch (err: unknown) {
    console.error(
      "\nFATAL: Unable to resolve embedding provider:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  if (provider.dimension !== PGVECTOR_EMBEDDING_DIMENSION) {
    console.error(
      `\nFATAL: Provider dimension (${provider.dimension}) does not match required pgvector schema (${PGVECTOR_EMBEDDING_DIMENSION}).`
    );
    process.exit(1);
  }

  // 2. Connect to Database
  const connectionString = await resolveConnectionString();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("\n✓ Connected to PostgreSQL database.");

  try {
    // 3. Inspect existing document_chunks
    const querySql = `
      SELECT 
        id,
        document_version_id,
        chunk_index,
        content,
        (embedding IS NOT NULL) as has_embedding,
        CASE WHEN embedding IS NOT NULL THEN vector_dims(embedding) ELSE null END as current_dims
      FROM document_chunks
      ORDER BY document_version_id, chunk_index;
    `;

    const res = await client.query<ChunkRecord>(querySql);
    const allChunks = res.rows;
    console.log(`Found ${allChunks.length} total document chunk(s) in database.`);

    const chunksToEmbed = allChunks.filter((c) => {
      if (isForce) return true;
      if (!c.has_embedding) return true;
      if (c.current_dims !== PGVECTOR_EMBEDDING_DIMENSION) return true;
      return false;
    });

    console.log(`Chunks requiring embeddings: ${chunksToEmbed.length}`);

    if (chunksToEmbed.length === 0) {
      console.log("\nAll chunks already possess valid 1536-dimensional embeddings. Nothing to do.");
      await client.end();
      return;
    }

    if (isDryRun) {
      console.log("\n[DRY-RUN PREVIEW] Would generate embeddings for the following chunks:");
      chunksToEmbed.forEach((c) => {
        const excerpt = c.content.replace(/\s+/g, " ").slice(0, 60);
        console.log(`  - Chunk ID: ${c.id} [v=${c.document_version_id}, idx=${c.chunk_index}] "${excerpt}..."`);
      });
      console.log("\nDry-run completed successfully. Run without --dry-run to apply changes.");
      await client.end();
      return;
    }

    // 4. Batch Embed & Update
    console.log("\nStarting vector generation and atomic chunk updates...");
    const startTime = Date.now();
    let updatedCount = 0;

    for (let i = 0; i < chunksToEmbed.length; i += batchSize) {
      const batch = chunksToEmbed.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} chunks)...`);

      const texts = batch.map((c) => c.content);
      const embeddings = await provider.generateBatchEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const vector = embeddings[j];

        if (!Array.isArray(vector) || vector.length !== PGVECTOR_EMBEDDING_DIMENSION) {
          throw new Error(
            `Generated vector length mismatch for chunk ${chunk.id}: expected ${PGVECTOR_EMBEDDING_DIMENSION}, got ${vector?.length}`
          );
        }

        const vectorString = `[${vector.join(",")}]`;
        await client.query(
          `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
          [vectorString, chunk.id]
        );
        updatedCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✓ Successfully updated ${updatedCount} chunk(s) in ${duration}s.`);

    // 5. Post-validation: Verify dimensions
    const verifyRes = await client.query<{
      total: string;
      with_valid_dims: string;
    }>(`
      SELECT 
        count(*) as total,
        count(CASE WHEN embedding IS NOT NULL AND vector_dims(embedding) = 1536 THEN 1 END) as with_valid_dims
      FROM document_chunks;
    `);

    const stats = verifyRes.rows[0];
    console.log("\n--- Verification Statistics ---");
    console.log(`Total Chunks:           ${stats.total}`);
    console.log(`Valid 1536-dim Vectors: ${stats.with_valid_dims}`);

    if (stats.total !== stats.with_valid_dims) {
      console.warn("WARNING: Some chunks still lack valid 1536-dimensional embeddings.");
    } else {
      console.log("✓ 100% of document chunks possess verified 1536-dimensional pgvector embeddings.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal error during re-embedding:", err);
  process.exit(1);
});
