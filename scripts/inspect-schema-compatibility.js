const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function check() {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  let url = '';
  for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('SUPABASE_DATABASE_URL=')) {
      url = line.trim().substring('SUPABASE_DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('--- 1. Live columns on policies ---');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'policies' AND table_schema = 'public'
    ORDER BY ordinal_position;
  `);
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable}, default: ${r.column_default})`));

  console.log('\n--- 2. Live constraints on policy_versions ---');
  const cons = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'policy_versions';
  `);
  cons.rows.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

  console.log('\n--- 3. Live indexes on policies and policy_versions ---');
  const idx = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('policies', 'policy_versions')
    ORDER BY tablename, indexname;
  `);
  idx.rows.forEach(r => console.log(`  [${r.tablename}] ${r.indexname}: ${r.indexdef}`));

  console.log('\n--- 4. Current data in policies and policy_versions ---');
  const polCount = await client.query('SELECT count(*)::int as count FROM policies;');
  const verCount = await client.query('SELECT count(*)::int as count FROM policy_versions;');
  const distinctStatuses = await client.query('SELECT DISTINCT status FROM policy_versions;');
  console.log(`  policies count: ${polCount.rows[0].count}`);
  console.log(`  policy_versions count: ${verCount.rows[0].count}`);
  console.log(`  existing policy_versions statuses: ${distinctStatuses.rows.map(r => r.status).join(', ')}`);

  console.log('\n--- 5. Test specific catalog check query ---');
  const catCheck = await client.query(`
    SELECT conname, conrelid::regclass::text as tablename, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conname = 'policy_versions_status_check'
      AND conrelid = 'public.policy_versions'::regclass;
  `);
  console.log('  Catalog check match count:', catCheck.rows.length);
  if (catCheck.rows.length > 0) {
    console.log('  Matched constraint:', catCheck.rows[0]);
  }

  await client.end();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
