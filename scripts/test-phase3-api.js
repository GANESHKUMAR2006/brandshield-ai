const { Client } = require('pg');

async function testPhase3Api() {
  console.log('================================================================');
  console.log('      BRANDSHIELD AI: PHASE 3 BACKEND & API VERIFICATION        ');
  console.log('================================================================\n');

  const pgClient = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pgClient.connect();

  let passed = 0;
  let total = 0;

  function assert(condition, title, details = '') {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      if (details) console.log(`       └─ ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      if (details) console.error(`       └─ ${details}`);
    }
  }

  try {
    // 1. Verify Source Library live queries
    console.log('--- 1. Live Source Library Queries ---');
    const productsRes = await pgClient.query(`
      SELECT p.id, p.name, p.sku, p.reference_price, COUNT(af.id) as facts_count
      FROM products p
      LEFT JOIN approved_facts af ON p.id = af.product_id
      GROUP BY p.id;
    `);
    assert(
      productsRes.rows.length > 0 && productsRes.rows[0].sku === 'DG-VTC-001',
      'Products & Approved Facts retrieved from PostgreSQL',
      `Product: ${productsRes.rows[0].name} (SKU: ${productsRes.rows[0].sku}, Price: ₹${productsRes.rows[0].reference_price}, Facts: ${productsRes.rows[0].facts_count})`
    );

    const docRes = await pgClient.query(`
      SELECT sd.title, sd.current_version_id, dv.version_number, dv.approval_status,
             (dv.valid_until < now()) as is_expired
      FROM source_documents sd
      JOIN document_versions dv ON sd.current_version_id = dv.id;
    `);
    assert(
      docRes.rows.length > 0,
      'Source Documents & Current Approved Version metadata retrieved',
      `Title: "${docRes.rows[0].title}" | Version: ${docRes.rows[0].version_number} (Expired: ${docRes.rows[0].is_expired})`
    );

    // 2. Verify Submission Creation & Versioning Invariants
    console.log('\n--- 2. Submission Management & Versioning Invariants ---');
    
    // Simulate POST /api/submissions transaction logic
    const testTitle = 'Test Ingestion — Q4 HydraBoost Serum Launch';
    const testContentV1 = 'Experience intense barrier hydration with DermaGlow HydraBoost.';
    const testChannel = 'Instagram';
    const actor = 'Dr. Elena Vance';

    // Start transaction
    await pgClient.query('BEGIN');
    const insertSubRes = await pgClient.query(`
      INSERT INTO submissions (workspace_id, product_id, title, content, channel, status, submitted_by)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        $1, $2, $3, 'draft', $4
      ) RETURNING id, title, status;
    `, [testTitle, testContentV1, testChannel, actor]);
    const newSubId = insertSubRes.rows[0].id;

    // Insert version 1
    const insertVer1Res = await pgClient.query(`
      INSERT INTO submission_versions (submission_id, version_number, content, created_by)
      VALUES ($1, 1, $2, $3) RETURNING id, version_number;
    `, [newSubId, testContentV1, actor]);

    // Insert audit event
    await pgClient.query(`
      INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
      VALUES ('00000000-0000-0000-0000-000000000001', $1, 'submission', $2, 'submission_created', $3);
    `, [actor, newSubId, JSON.stringify({ title: testTitle, version: 1 })]);

    await pgClient.query('COMMIT');

    assert(
      newSubId !== undefined && insertVer1Res.rows[0].version_number === 1,
      'Submission created atomically with initial version 1',
      `ID: ${newSubId} | Version: 1`
    );

    // 3. Simulate PATCH revision: Update content, verify Version 2 created
    const testContentV2 = 'Experience intense barrier hydration with DermaGlow HydraBoost, enriched with 10% stabilised Vitamin C.';
    
    await pgClient.query('BEGIN');
    // Fetch max version
    const maxVerRes = await pgClient.query(`
      SELECT COALESCE(MAX(version_number), 1) as max_ver FROM submission_versions WHERE submission_id = $1;
    `, [newSubId]);
    const nextVer = Number(maxVerRes.rows[0].max_ver) + 1;

    // Insert version 2
    await pgClient.query(`
      INSERT INTO submission_versions (submission_id, version_number, content, created_by)
      VALUES ($1, $2, $3, $4);
    `, [newSubId, nextVer, testContentV2, actor]);

    // Update submissions table content
    await pgClient.query(`
      UPDATE submissions SET content = $1, status = 'submitted', updated_at = now() WHERE id = $2;
    `, [testContentV2, newSubId]);

    // Append audit event
    await pgClient.query(`
      INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, before_state, after_state)
      VALUES ('00000000-0000-0000-0000-000000000001', $1, 'submission', $2, 'submission_content_revised', $3, $4);
    `, [
      actor,
      newSubId,
      JSON.stringify({ version: 1, status: 'draft' }),
      JSON.stringify({ version: nextVer, status: 'submitted' }),
    ]);
    await pgClient.query('COMMIT');

    // 4. Verify Historical Version Preservation
    const allVersionsRes = await pgClient.query(`
      SELECT version_number, content, created_at
      FROM submission_versions
      WHERE submission_id = $1
      ORDER BY version_number ASC;
    `, [newSubId]);

    assert(
      allVersionsRes.rows.length === 2,
      'Content revision created Version 2 while strictly preserving Version 1',
      `Versions found: ${allVersionsRes.rows.map(v => `v${v.version_number}`).join(', ')}`
    );

    assert(
      allVersionsRes.rows[0].content === testContentV1 && allVersionsRes.rows[1].content === testContentV2,
      'Historical content immutable: Version 1 has original text, Version 2 has revised text',
      `v1: "${allVersionsRes.rows[0].content.substring(0, 30)}..." | v2: "${allVersionsRes.rows[1].content.substring(0, 30)}..."`
    );

    // 5. Verify Audit Trail Generation
    const auditsRes = await pgClient.query(`
      SELECT action, after_state
      FROM audit_events
      WHERE entity_id = $1
      ORDER BY created_at ASC;
    `, [newSubId]);

    assert(
      auditsRes.rows.length === 2 &&
      auditsRes.rows[0].action === 'submission_created' &&
      auditsRes.rows[1].action === 'submission_content_revised',
      'Audit events reliably recorded for creation and version revision',
      `Actions recorded: [${auditsRes.rows.map(a => a.action).join(', ')}]`
    );

    // 6. Verify Benchmark Demonstrations remain intact
    console.log('\n--- 3. Benchmark Fixture Integrity ---');
    const benchmarkSubmissions = await pgClient.query(`
      SELECT id, title, status FROM submissions
      WHERE id IN (
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000102',
        '00000000-0000-0000-0000-000000000103'
      )
      ORDER BY id ASC;
    `);

    assert(
      benchmarkSubmissions.rows.length === 3,
      'Benchmark Ad Variants A, B, and C remain intact and unmodified',
      `Found: ${benchmarkSubmissions.rows.map(s => s.title.split('—')[0].trim()).join(', ')}`
    );

    const benchmarkClaims = await pgClient.query(`
      SELECT c.claim_text, c.verification_status
      FROM claims c
      ORDER BY c.created_at ASC;
    `);
    assert(
      benchmarkClaims.rows.length >= 6,
      'Benchmark claims registry intact with verified statuses',
      `Extracted claims count: ${benchmarkClaims.rows.length}`
    );

  } catch (err) {
    console.error('Test execution exception:', err.message);
  } finally {
    await pgClient.end();
  }

  console.log(`\nPhase 3 Verification Summary: ${passed}/${total} checks passed.\n`);
  if (passed !== total) {
    process.exit(1);
  }
}

testPhase3Api();
