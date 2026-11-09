/**
 * BrandShield AI — Dedicated Pending Migration Runner
 *
 * Executes unapplied schema migrations tracked in public._schema_migrations.
 * Preserves all existing data, never reseeds, and tracks history safely.
 *
 * Usage:
 *   node scripts/apply-pending-migrations.js [--dry-run]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const isDryRun = process.argv.includes('--dry-run');

  // Read database URL safely from environment or .env.local
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
    console.error('ERROR: SUPABASE_DATABASE_URL is missing.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log(`[1/3] Connecting to Supabase database (mode: ${isDryRun ? 'DRY-RUN (read-only)' : 'LIVE EXECUTION'})...`);
    await client.connect();
    console.log('✓ Connected successfully.');

    // 1. Ensure tracking table exists
    const trackerCheck = await client.query("SELECT to_regclass('public._schema_migrations') as tbl;");
    if (!trackerCheck.rows[0].tbl) {
      throw new Error('Fatal: public._schema_migrations does not exist. Cannot determine migration history safely.');
    }

    // 2. Read applied migrations
    const appliedRes = await client.query('SELECT version, applied_at FROM public._schema_migrations ORDER BY version ASC;');
    const appliedVersions = appliedRes.rows.map(r => r.version);
    const appliedSet = new Set(appliedVersions);

    console.log(`\nApplied migrations in database (${appliedVersions.length}):`);
    appliedRes.rows.forEach(r => console.log(`  ✓ ${r.version} (applied ${r.applied_at.toISOString()})`));

    // Confirm Phases 1-6 are present
    const expectedPhases1To6 = [
      '20261105000000_initial_schema.sql',
      '20261105010000_phase3_submissions_enhancements.sql',
      '20261105020000_phase4_extraction_engine.sql',
      '20261105030000_phase5_verification_engine.sql',
      '20261105040000_phase6_review_workflow.sql'
    ];

    const missingPrevious = expectedPhases1To6.filter(f => !appliedSet.has(f));
    if (missingPrevious.length > 0) {
      throw new Error(`Safety violation: Required previous migrations are missing from _schema_migrations: ${missingPrevious.join(', ')}`);
    }

    // 3. Scan local migrations directory
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    const pendingFiles = allFiles.filter(f => !appliedSet.has(f));

    console.log(`\n[2/3] Migration status analysis:`);
    console.log(`  - Total local migration files: ${allFiles.length}`);
    console.log(`  - Previously applied:          ${appliedVersions.length}`);
    console.log(`  - Pending to execute:          ${pendingFiles.length}`);

    if (pendingFiles.length === 0) {
      console.log('\n✓ Database is already up to date. No pending migrations.');
      return;
    }

    console.log('\nPending migrations to execute:');
    pendingFiles.forEach((f, idx) => console.log(`  ${idx + 1}. ${f}`));

    // Safety verify: all pending files must be valid SQL files
    const allValidSql = pendingFiles.every(f => f.endsWith('.sql'));
    if (!allValidSql) {
      throw new Error(`Safety violation: Invalid non-SQL files found in pending migrations: ${JSON.stringify(pendingFiles)}`);
    }

    if (isDryRun) {
      console.log('\n[DRY-RUN COMPLETE] Preflight passed successfully. Zero changes were made.');
      return;
    }

    // 4. Execute pending migrations sequentially with individual transaction wrappers
    console.log('\n[3/3] Executing pending migrations...');
    for (const file of pendingFiles) {
      console.log(`\n--> Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Verify no top-level standalone transaction statements that would break client transaction control
      const hasStandaloneCommit = /^\s*COMMIT\s*;/im.test(sql);
      const hasStandaloneBegin = /^\s*BEGIN\s*;/im.test(sql);
      if (hasStandaloneCommit || hasStandaloneBegin) {
        throw new Error(`Safety error in ${file}: Contains top-level standalone BEGIN/COMMIT statement. Must be handled safely.`);
      }

      const startTime = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public._schema_migrations (version, applied_at) VALUES ($1, now());', [file]);
        await client.query('COMMIT');
        const elapsed = Date.now() - startTime;
        console.log(`✓ Successfully applied and recorded: ${file} (${elapsed}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Migration failed on ${file}:`);
        console.error(err.message);
        throw err;
      }
    }

    console.log('\n🎉 All pending migrations applied and recorded successfully!');

  } catch (error) {
    console.error('\nEXECUTION_HALTED:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
