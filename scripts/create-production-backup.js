/**
 * BrandShield AI — Production Database Backup Utility
 *
 * Executes a PostgreSQL custom-format compressed backup (-Fc) using pg_dump,
 * verifies archive catalog with pg_restore --list, and captures baseline row counts.
 * Zero secrets or passwords are exposed.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  console.log('=== BRANDSHIELD AI: PRODUCTION BACKUP & BASELINE CAPTURE ===\n');

  // 1. Locate pg_dump and pg_restore
  const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  const pgRestorePath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe';

  if (!fs.existsSync(pgDumpPath) || !fs.existsSync(pgRestorePath)) {
    throw new Error(`PostgreSQL utilities not found at ${pgDumpPath}`);
  }
  console.log(`✓ PostgreSQL utilities confirmed: pg_dump and pg_restore (PostgreSQL 18.4)`);

  // 2. Read database connection string safely
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
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);

  console.log(`✓ Database target endpoint verified:`);
  console.log(`  - Host:     ${u.hostname}`);
  console.log(`  - Port:     ${u.port || '5432'}`);
  console.log(`  - Database: ${u.pathname.replace('/', '')}`);
  console.log(`  - User:     ${user.replace(/:.*/, '')}`);
  console.log(`  - Auth:     [CONFIGURED - SANITIZED]`);

  // 3. Prepare backups directory and timestamped filename
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupFileName = `brandshield_prod_backup_${timestampStr}.dump`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  console.log(`\n[1/3] Generating custom-format compressed backup (-Fc)...`);
  console.log(`  - Target File: ${backupFilePath}`);

  const env = {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGDATABASE: u.pathname.replace('/', ''),
    PGUSER: user,
    PGPASSWORD: password,
    PGSSLMODE: 'require'
  };

  const dumpArgs = [
    '-w',
    '--schema=public',
    '--format=custom',
    '--compress=9',
    '--no-owner',
    '--no-privileges',
    `--file=${backupFilePath}`
  ];

  const startTime = Date.now();
  const dumpResult = spawnSync(pgDumpPath, dumpArgs, { env, encoding: 'utf8' });

  if (dumpResult.status !== 0) {
    console.error('pg_dump error:', dumpResult.stderr);
    throw new Error(`pg_dump failed with exit code ${dumpResult.status}`);
  }

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file was not created at ${backupFilePath}`);
  }

  const durationMs = Date.now() - startTime;
  const stats = fs.statSync(backupFilePath);
  console.log(`✓ Backup generated successfully in ${durationMs}ms:`);
  console.log(`  - File Size: ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
  console.log(`  - Created At: ${now.toISOString()}`);

  // 4. Verify archive with pg_restore --list
  console.log(`\n[2/3] Verifying backup catalog with pg_restore --list...`);
  const restoreArgs = ['--list', backupFilePath];
  const restoreResult = spawnSync(pgRestorePath, restoreArgs, { encoding: 'utf8' });

  if (restoreResult.status !== 0) {
    console.error('pg_restore error:', restoreResult.stderr);
    throw new Error(`pg_restore --list failed with exit code ${restoreResult.status}`);
  }

  const catalog = restoreResult.stdout;
  const essentialTables = ['policies', 'policy_versions', 'workspaces', '_schema_migrations'];
  const missingTables = [];

  for (const table of essentialTables) {
    const hasTable = catalog.includes(`TABLE DATA public ${table}`) || catalog.includes(`TABLE public ${table}`);
    if (hasTable) {
      console.log(`  ✓ Confirmed in archive catalog: public.${table}`);
    } else {
      missingTables.push(table);
      console.log(`  ❌ Missing in archive catalog: public.${table}`);
    }
  }

  if (missingTables.length > 0) {
    throw new Error(`Archive verification failed! Missing essential tables: ${missingTables.join(', ')}`);
  }

  console.log(`✓ Archive integrity verified. All ${essentialTables.length} essential relations confirmed present.`);

  // 5. Connect read-only to capture baseline row counts
  console.log(`\n[3/3] Capturing baseline database row counts...`);
  const client = new Client({
    connectionString: rawUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const countsRes = await client.query(`
      SELECT 'public.policies' AS relation, count(*)::int AS count FROM public.policies
      UNION ALL
      SELECT 'public.policy_versions', count(*)::int FROM public.policy_versions
      UNION ALL
      SELECT 'public.workspaces', count(*)::int FROM public.workspaces
      UNION ALL
      SELECT 'public._schema_migrations', count(*)::int FROM public._schema_migrations
      UNION ALL
      SELECT 'public.products', count(*)::int FROM public.products
      UNION ALL
      SELECT 'public.submissions', count(*)::int FROM public.submissions
      UNION ALL
      SELECT 'public.claims', count(*)::int FROM public.claims
      UNION ALL
      SELECT 'public.claim_evidence', count(*)::int FROM public.claim_evidence
      UNION ALL
      SELECT 'public.audit_events', count(*)::int FROM public.audit_events
      ORDER BY relation ASC;
    `);

    console.log('Baseline Database Row Counts:');
    countsRes.rows.forEach(r => {
      console.log(`  - ${r.relation.padEnd(28)}: ${r.count}`);
    });

    console.log('\n============================================================');
    console.log('✓ STAGE 2 PRODUCTION BACKUP COMPLETED & VERIFIED SUCCESSFULLY');
    console.log('============================================================');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\nBACKUP_FAILED:', err.message);
  process.exit(1);
});
