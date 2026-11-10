import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function auditDatabase() {
  console.log('=== BRANDSHIELD AI: PRODUCTION DATABASE AUDIT ===\n');

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
    await client.connect();
    console.log('✓ Connected to Supabase PostgreSQL.\n');

    // 1. PostgreSQL version
    const versionRes = await client.query('SELECT version();');
    console.log('PostgreSQL Version:', versionRes.rows[0].version);

    // 2. Tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(`\nPublic Tables (${tablesRes.rows.length}):`);
    tablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // 3. Applied migrations
    const migrationsRes = await client.query(`
      SELECT version, applied_at 
      FROM public._schema_migrations 
      ORDER BY version ASC;
    `);
    console.log(`\nApplied Migrations in _schema_migrations (${migrationsRes.rows.length}):`);
    migrationsRes.rows.forEach(r => console.log(`  ✓ ${r.version} (${r.applied_at.toISOString()})`));

    // 4. Check pending migrations from local directory
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const localFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const appliedSet = new Set(migrationsRes.rows.map(r => r.version));
    const pending = localFiles.filter(f => !appliedSet.has(f));
    console.log(`\nLocal migrations total: ${localFiles.length}, Pending: ${pending.length}`);
    pending.forEach(p => console.log(`  [PENDING] ${p}`));

    // 5. Workspaces and memberships
    const wsRes = await client.query(`SELECT id, name, slug, created_at FROM workspaces ORDER BY created_at;`);
    console.log(`\nWorkspaces (${wsRes.rows.length}):`);
    wsRes.rows.forEach(w => console.log(`  - ${w.name} (slug: ${w.slug}, id: ${w.id})`));

    const memRes = await client.query(`
      SELECT wm.id, wm.workspace_id, w.slug, wm.user_id, wm.role, wm.status 
      FROM workspace_memberships wm 
      JOIN workspaces w ON wm.workspace_id = w.id 
      ORDER BY w.slug, wm.role;
    `);
    console.log(`\nWorkspace Memberships (${memRes.rows.length}):`);
    memRes.rows.forEach(m => console.log(`  - User: ${m.user_id} | Workspace: ${m.slug} | Role: ${m.role} | Status: ${m.status}`));

    // 6. Row-Level Security (RLS) status
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.log(`\nRow-Level Security Status:`);
    rlsRes.rows.forEach(r => console.log(`  - ${r.tablename}: RLS ${r.rowsecurity ? 'ENABLED' : 'DISABLED'}`));

    // 7. Policies in public schema
    const polRes = await client.query(`
      SELECT tablename, policyname, permissive, roles, cmd 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname;
    `);
    console.log(`\nRLS Policies Defined (${polRes.rows.length}):`);
    polRes.rows.forEach(p => console.log(`  - ${p.tablename}: "${p.policyname}" (${p.cmd}, roles: ${p.roles})`));

    // 8. Foreign keys
    const fkRes = await client.query(`
      SELECT c.conname, c.conrelid::regclass AS table_from, c.confrelid::regclass AS table_to, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE c.contype = 'f' AND n.nspname = 'public'
      ORDER BY c.conrelid::text, c.conname;
    `);
    console.log(`\nForeign Key Constraints (${fkRes.rows.length}):`);
    fkRes.rows.forEach(fk => console.log(`  - ${fk.table_from} -> ${fk.table_to} (${fk.conname}): ${fk.def}`));

    // 9. Inspect policies and policy_versions schema
    const policiesCols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'policies' 
      ORDER BY ordinal_position;
    `);
    console.log(`\nTable 'policies' Columns (${policiesCols.rows.length}):`);
    policiesCols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default})`));

    const hasSeverity = policiesCols.rows.some(c => c.column_name === 'severity');
    console.log(`  -> policies.severity exists in production DB: ${hasSeverity ? 'YES' : 'NO (Pending Phase 3 migration)'}`);

    const pvCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'policy_versions' 
      ORDER BY ordinal_position;
    `);
    console.log(`\nTable 'policy_versions' Columns (${pvCols.rows.length}):`);
    pvCols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`));

    const pvConstraints = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'policy_versions'::regclass;
    `);
    console.log(`\nConstraints on 'policy_versions':`);
    pvConstraints.rows.forEach(c => console.log(`  - ${c.conname}: ${c.def}`));

    // 10. Table row counts
    const countTables = [
      'workspaces', 'workspace_memberships', 'workspace_invitations',
      'products', 'submissions', 'submission_versions', 'claims',
      'source_documents', 'document_versions', 'claim_evidence', 'approved_facts',
      'policies', 'policy_versions', 'audit_events'
    ];
    console.log(`\nTable Row Counts:`);
    for (const t of countTables) {
      try {
        const cntRes = await client.query(`SELECT count(*) as count FROM public."${t}";`);
        console.log(`  - ${t}: ${cntRes.rows[0].count}`);
      } catch (err: any) {
        console.log(`  - ${t}: [ERROR: ${err.message}]`);
      }
    }

    // 11. Relationships sample check
    const relRes = await client.query(`
      SELECT 
        s.id AS submission_id,
        s.title AS submission_title,
        p.name AS product_name,
        w.name AS workspace_name,
        count(DISTINCT c.id) AS claim_count
      FROM submissions s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN claims c ON c.submission_id = s.id
      GROUP BY s.id, s.title, p.name, w.name
      LIMIT 5;
    `);
    console.log(`\nSample Submission -> Product -> Workspace -> Claims Relationships:`);
    relRes.rows.forEach(r => console.log(`  - Sub: "${r.submission_title}" (${r.submission_id}) | Product: ${r.product_name} | Workspace: ${r.workspace_name} | Claims: ${r.claim_count}`));

  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    await client.end();
  }
}

auditDatabase();
