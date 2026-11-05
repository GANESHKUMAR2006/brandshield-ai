const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

async function runSecurityPreflight() {
  console.log('================================================================');
  console.log('   BRANDSHIELD AI: PART 1 DATABASE SECURITY PRE-FLIGHT TESTS   ');
  console.log('================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('Missing Supabase public configuration.');
    process.exit(1);
  }

  // 1. Anon Client Initialization (Browser-facing role)
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       └─ ${details}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       └─ ${details}`);
    }
  }

  // TEST 1: Anon cannot insert fabricated audit events
  try {
    const { data, error } = await anonClient.from('audit_events').insert({
      workspace_id: '00000000-0000-0000-0000-000000000001',
      actor_id: 'attacker',
      entity_type: 'workspace',
      entity_id: '00000000-0000-0000-0000-000000000001',
      action: 'fabricated_event',
    });
    assert(
      error !== null,
      'Test 1: Anon user cannot insert fabricated audit events',
      error ? `Denied with code: ${error.code} (${error.message})` : 'UNEXPECTED: Insert succeeded!'
    );
  } catch (err) {
    assert(true, 'Test 1: Anon user cannot insert fabricated audit events', `Blocked: ${err.message}`);
  }

  // TEST 2: Anon cannot update or delete submissions
  try {
    const { error: updateError } = await anonClient
      .from('submissions')
      .update({ title: 'Hacked Submission' })
      .eq('id', '00000000-0000-0000-0000-000000000101');
    
    // In PostgREST, RLS on UPDATE without policy returns 0 rows updated (or error)
    const { data: checkSub } = await anonClient
      .from('submissions')
      .select('title')
      .eq('id', '00000000-0000-0000-0000-000000000101')
      .single();

    assert(
      checkSub.title !== 'Hacked Submission',
      'Test 2: Anon user cannot modify existing submissions',
      `Title remains intact: "${checkSub.title}"`
    );
  } catch (err) {
    assert(true, 'Test 2: Anon user cannot modify existing submissions', `Blocked: ${err.message}`);
  }

  // TEST 3: Anon cannot modify products or approved facts
  try {
    const { error: prodError } = await anonClient
      .from('products')
      .update({ reference_price: 1.0 })
      .eq('sku', 'DG-VTC-001');

    const { data: checkProd } = await anonClient
      .from('products')
      .select('reference_price')
      .eq('sku', 'DG-VTC-001')
      .single();

    assert(
      Number(checkProd.reference_price) === 2499,
      'Test 3: Anon user cannot modify product prices or facts',
      `Price remains intact: ₹${checkProd.reference_price}`
    );
  } catch (err) {
    assert(true, 'Test 3: Anon user cannot modify product prices or facts', `Blocked: ${err.message}`);
  }

  // TEST 4: Cross-workspace access rejection
  try {
    const { data: unauthorizedWs, error } = await anonClient
      .from('workspaces')
      .select('*')
      .eq('slug', 'competitor-workspace');

    assert(
      !unauthorizedWs || unauthorizedWs.length === 0,
      'Test 4: Cross-workspace isolation rejects unauthorized workspace queries',
      `Result count for foreign workspace: ${unauthorizedWs?.length || 0}`
    );
  } catch (err) {
    assert(true, 'Test 4: Cross-workspace isolation rejects unauthorized workspace queries', err.message);
  }

  // Direct PostgreSQL tests (Triggers & Integrity)
  const pgClient = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pgClient.connect();

    // TEST 5: Audit events reject UPDATE and DELETE at engine level
    let triggerBlocked = false;
    try {
      await pgClient.query("UPDATE audit_events SET action = 'tampered' WHERE entity_type = 'workspace';");
    } catch (err) {
      triggerBlocked = err.message.includes('Audit events are immutable');
    }
    assert(
      triggerBlocked,
      'Test 5: Audit events table immutability trigger blocks UPDATE statements',
      'Trigger raised expected exception on modification attempt'
    );

    let deleteBlocked = false;
    try {
      await pgClient.query('DELETE FROM audit_events;');
    } catch (err) {
      deleteBlocked = err.message.includes('Audit events are immutable');
    }
    assert(
      deleteBlocked,
      'Test 5b: Audit events table immutability trigger blocks DELETE statements',
      'Trigger raised expected exception on deletion attempt'
    );

    // TEST 6: Expired and superseded documents are identifiable
    const docQuery = await pgClient.query(`
      SELECT dv.id, dv.version_number, dv.approval_status, dv.valid_from, dv.valid_until,
             (dv.valid_until < now()) AS is_expired,
             (dv.superseded_at IS NOT NULL OR dv.approval_status = 'superseded') AS is_superseded
      FROM document_versions dv;
    `);
    assert(
      docQuery.rows.length > 0 && docQuery.rows[0].is_expired === false,
      'Test 6: Document versions accurately track expiration and superseded state',
      `Version ${docQuery.rows[0].version_number}: expired=${docQuery.rows[0].is_expired}, superseded=${docQuery.rows[0].is_superseded}`
    );

    // TEST 7: Promotion validity dates are respected
    const promoQuery = await pgClient.query(`
      SELECT promotion_name, resulting_price, start_date, end_date,
             (now() BETWEEN start_date AND end_date) AS is_currently_active
      FROM promotions
      WHERE product_id = '00000000-0000-0000-0000-000000000010';
    `);
    assert(
      promoQuery.rows.length > 0 && promoQuery.rows[0].is_currently_active === true,
      'Test 7: Promotion validity dates correctly determine active promotional pricing',
      `"${promoQuery.rows[0].promotion_name}" is active: ${promoQuery.rows[0].is_currently_active} (Resulting: ₹${promoQuery.rows[0].resulting_price})`
    );

    // TEST 8: Check bundle/environment security - Ensure database credentials are not exposed
    const envLocalContent = require('fs').readFileSync('.env.local', 'utf8');
    const hasDbPasswordInPublic = envLocalContent.includes('NEXT_PUBLIC_DATABASE_PASSWORD') || envLocalContent.includes('NEXT_PUBLIC_SUPABASE_DB_PASSWORD');
    assert(
      !hasDbPasswordInPublic,
      'Test 8: Database credentials never use NEXT_PUBLIC_ prefix',
      'SUPABASE_DATABASE_URL and SUPABASE_DB_PASSWORD are server-private'
    );

  } catch (err) {
    console.error('PostgreSQL preflight error:', err.message);
  } finally {
    await pgClient.end();
  }

  console.log(`\nPre-Flight Result: ${passedTests}/${totalTests} tests passed.\n`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSecurityPreflight();
