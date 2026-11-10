import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  let connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SUPABASE_DATABASE_URL=')) {
          connectionString = trimmed.substring('SUPABASE_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  }

  if (!connectionString) {
    console.error('SUPABASE_DATABASE_URL is missing.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to PostgreSQL.');

  // 1. Column info for document_chunks
  const colRes = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'document_chunks';
  `);
  console.log('\nColumns in document_chunks:', colRes.rows);

  // 2. Count chunks and check embedding dimensions
  const chunkRes = await client.query(`
    SELECT 
      id,
      chunk_index,
      document_version_id,
      vector_dims(embedding) as dims,
      metadata,
      SUBSTRING(content FROM 1 FOR 60) as excerpt
    FROM document_chunks
    LIMIT 10;
  `);
  console.log(`\nExisting document_chunks (${chunkRes.rows.length} sample):`);
  chunkRes.rows.forEach(r => {
    console.log(`- ID: ${r.id}, Dims: ${r.dims}, Excerpt: "${r.excerpt}...", Metadata:`, r.metadata);
  });

  const totalCount = await client.query('SELECT count(*) FROM document_chunks;');
  console.log('\nTotal document_chunks count:', totalCount.rows[0].count);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
