/**
 * BrandShield AI — Isolated QA Database Backup Utility
 *
 * Captures a complete logical snapshot of all public tables, row counts,
 * and JSON-serialized state into backups/ prior to migration execution.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  console.log('=== BRANDSHIELD AI: ISOLATED QA DATABASE BACKUP ===\n');

  let rawUrl = process.env.SUPABASE_DATABASE_URL;
  if (!rawUrl) {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SUPABASE_DATABASE_URL=')) {
          rawUrl = trimmed.substring('SUPABASE_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  }

  if (!rawUrl) {
    throw new Error('SUPABASE_DATABASE_URL is missing.');
  }

  const u = new URL(rawUrl);
  console.log('Target QA Database:');
  console.log(`  - Host:      ${u.hostname}`);
  console.log(`  - Port:      ${u.port || '5432'}`);
  console.log(`  - Database:  ${u.pathname.replace('/', '')}`);
  console.log(`  - User:      ${decodeURIComponent(u.username).replace(/:.*/, '')}`);
  console.log(`  - Auth:      [CONFIGURED - SANITIZED]\n`);

  const client = new Client({
    connectionString: rawUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const backupData = {
    captured_at: new Date().toISOString(),
    environment: 'qa_isolated',
    target_host: u.hostname,
    tables: {}
  };

  console.log(`Capturing ${tablesRes.rows.length} public tables:`);
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    const dataRes = await client.query(`SELECT * FROM public."${tableName}"`);
    backupData.tables[tableName] = {
      count: dataRes.rows.length,
      rows: dataRes.rows
    };
    console.log(`  ✓ ${tableName.padEnd(28)} : ${String(dataRes.rows.length).padStart(4)} rows`);
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupFileName = `brandshield_qa_backup_${timestampStr}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  const stats = fs.statSync(backupFilePath);

  console.log(`\n✓ QA Backup completed successfully:`);
  console.log(`  - File:     ${backupFilePath}`);
  console.log(`  - Size:     ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);

  await client.end();
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

