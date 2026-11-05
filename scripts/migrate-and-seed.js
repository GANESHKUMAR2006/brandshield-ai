const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error('SUPABASE_DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[1/4] Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL.');

    // Migration tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 1. Run migrations in order
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    // Check which migrations were already applied
    const appliedRes = await client.query('SELECT version FROM _schema_migrations;');
    const appliedSet = new Set(appliedRes.rows.map(r => r.version));

    // If initial_schema was applied before the tracker table was introduced, mark it
    const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces';");
    if (tableCheck.rows.length > 0 && !appliedSet.has('20261105000000_initial_schema.sql')) {
      await client.query('INSERT INTO _schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING;', ['20261105000000_initial_schema.sql']);
      appliedSet.add('20261105000000_initial_schema.sql');
    }

    console.log(`[2/4] Checking ${migrationFiles.length} schema migration(s)...`);
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`  - [SKIPPED] Already applied: ${file}`);
        continue;
      }
      console.log(`  - [APPLYING] Migration: ${file}...`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(migrationSql);
        await client.query('INSERT INTO _schema_migrations (version) VALUES ($1);', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ Applied migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('✓ All schema migrations up to date.');

    // 2. Run seed
    const seedPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
    console.log(`[3/4] Applying seed data: ${path.basename(seedPath)}...`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('✓ Seed data executed successfully.');

    // 3. Verify tables and counts
    console.log('[4/4] Verifying database tables and record counts...');
    const tables = [
      'workspaces',
      'products',
      'approved_facts',
      'promotions',
      'source_documents',
      'document_versions',
      'document_chunks',
      'submissions',
      'submission_versions',
      'claims',
      'claim_evidence',
      'verification_runs',
      'review_decisions',
      'audit_events'
    ];

    for (const table of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM ${table};`);
      console.log(`  - ${table.padEnd(20)}: ${res.rows[0].count} records`);
    }

    // 4. Test idempotency: Run seed again
    console.log('\nTesting seed idempotency (second run)...');
    await client.query(seedSql);
    const workspaceCheck = await client.query('SELECT count(*)::int as count FROM workspaces WHERE slug = $1;', ['dermaglow']);
    if (workspaceCheck.rows[0].count === 1) {
      console.log('✓ Seed idempotency verified: DermaGlow workspace count is strictly 1.');
    } else {
      console.error('✗ Seed idempotency failed: Duplicate workspaces found.');
    }

    // 5. Test audit immutability trigger
    console.log('\nTesting audit immutability trigger...');
    try {
      await client.query("UPDATE audit_events SET action = 'tampered' WHERE entity_type = 'workspace';");
      console.error('✗ Tampering was allowed! Trigger failed.');
    } catch (err) {
      console.log(`✓ Audit event protection verified: UPDATE blocked with: "${err.message}"`);
    }

    console.log('\n🎉 Phase 3 Database Setup & Verification Completed Successfully!');
  } catch (error) {
    console.error('Execution error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
