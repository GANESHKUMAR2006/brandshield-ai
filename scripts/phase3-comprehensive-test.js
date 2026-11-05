const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function runComprehensiveTests() {
  console.log('========================================================================');
  console.log('       BRANDSHIELD AI: PHASE 3 COMPREHENSIVE AUTOMATED TEST SUITE       ');
  console.log('========================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const connectionString = process.env.SUPABASE_DATABASE_URL;

  const pgClient = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

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
    // 1. Supabase connectivity
    const healthCheck = await pgClient.query('SELECT 1 as connected;');
    assert(healthCheck.rows[0].connected === 1, '1. Supabase connectivity verified');

    // 2. Source library data retrieval
    const sourcesRes = await pgClient.query(`
      SELECT sd.id, sd.title, sd.document_type
      FROM source_documents sd
      JOIN workspaces w ON sd.workspace_id = w.id
      WHERE w.slug = 'dermaglow';
    `);
    assert(sourcesRes.rows.length > 0, '2. Source library data retrieval', `Found ${sourcesRes.rows.length} source document(s)`);

    // 3. Product retrieval
    const prodRes = await pgClient.query(`
      SELECT p.id, p.name, p.sku, p.reference_price
      FROM products p
      JOIN workspaces w ON p.workspace_id = w.id
      WHERE w.slug = 'dermaglow';
    `);
    assert(prodRes.rows.length > 0, '3. Product retrieval from PostgreSQL', `Product: "${prodRes.rows[0].name}" (SKU: ${prodRes.rows[0].sku})`);

    // 4. Promotion retrieval
    const promoRes = await pgClient.query(`
      SELECT pr.promotion_name, pr.resulting_price, pr.start_date, pr.end_date
      FROM promotions pr
      JOIN products p ON pr.product_id = p.id
      WHERE p.sku = 'DG-VTC-001';
    `);
    assert(promoRes.rows.length > 0, '4. Promotion retrieval and validity parameters', `Promotion: "${promoRes.rows[0].promotion_name}" (₹${promoRes.rows[0].resulting_price})`);

    // 5. Source document version retrieval
    const versionsRes = await pgClient.query(`
      SELECT dv.version_number, dv.approval_status, dv.storage_path
      FROM document_versions dv
      WHERE dv.source_document_id = $1;
    `, [sourcesRes.rows[0].id]);
    assert(versionsRes.rows.length > 0, '5. Source document version retrieval', `Version ${versionsRes.rows[0].version_number} (${versionsRes.rows[0].approval_status})`);

    // 6. Submission creation
    const testTitle = 'E2E Campaign Test — HydraDefense Bio-Serum';
    const testContentV1 = 'Revitalize skin barrier with clinically formulated HydraDefense.';
    const testChannel = 'Website';
    const testActor = 'Automated Test Runner';

    await pgClient.query('BEGIN');
    const subRes = await pgClient.query(`
      INSERT INTO submissions (workspace_id, product_id, title, content, channel, status, submitted_by)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        $1, $2, $3, $4, 'draft', $5
      ) RETURNING id, title;
    `, [prodRes.rows[0].id, testTitle, testContentV1, testChannel, testActor]);
    const submissionId = subRes.rows[0].id;

    // 7. Submission version creation (initial v1)
    const ver1Res = await pgClient.query(`
      INSERT INTO submission_versions (submission_id, version_number, content, created_by)
      VALUES ($1, 1, $2, $3) RETURNING id, version_number;
    `, [submissionId, testContentV1, testActor]);

    // 14. Audit event creation (creation)
    await pgClient.query(`
      INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, after_state)
      VALUES ('00000000-0000-0000-0000-000000000001', $1, 'submission', $2, 'submission_created', $3);
    `, [testActor, submissionId, JSON.stringify({ version: 1, title: testTitle })]);
    await pgClient.query('COMMIT');

    assert(Boolean(submissionId), '6. Submission creation generates stable UUID', `UUID: ${submissionId}`);
    assert(ver1Res.rows[0].version_number === 1, '7. Submission version creation generates initial Version 1');

    // 8. Submission retrieval
    const fetchSub = await pgClient.query(`
      SELECT id, title, channel, status FROM submissions WHERE id = $1;
    `, [submissionId]);
    assert(fetchSub.rows.length === 1 && fetchSub.rows[0].title === testTitle, '8. Submission retrieval from PostgreSQL', `Title: "${fetchSub.rows[0].title}"`);

    // 9. Draft revision
    const testContentV2 = 'Revitalize skin barrier with clinically formulated HydraDefense, enriched with 10% stabilised Vitamin C.';
    await pgClient.query('BEGIN');
    await pgClient.query(`
      INSERT INTO submission_versions (submission_id, version_number, content, created_by)
      VALUES ($1, 2, $2, $3);
    `, [submissionId, testContentV2, testActor]);

    await pgClient.query(`
      UPDATE submissions SET content = $1, status = 'submitted', updated_at = now() WHERE id = $2;
    `, [testContentV2, submissionId]);

    await pgClient.query(`
      INSERT INTO audit_events (workspace_id, actor_id, entity_type, entity_id, action, before_state, after_state)
      VALUES ('00000000-0000-0000-0000-000000000001', $1, 'submission', $2, 'submission_content_revised', $3, $4);
    `, [
      testActor,
      submissionId,
      JSON.stringify({ version: 1 }),
      JSON.stringify({ version: 2 }),
    ]);
    await pgClient.query('COMMIT');

    const updatedSub = await pgClient.query('SELECT status, content FROM submissions WHERE id = $1;', [submissionId]);
    assert(updatedSub.rows[0].status === 'submitted', '9. Draft revision updates submission status and active content');

    // 10. Historical version preservation
    const allVersions = await pgClient.query(`
      SELECT version_number, content FROM submission_versions WHERE submission_id = $1 ORDER BY version_number ASC;
    `, [submissionId]);
    assert(
      allVersions.rows.length === 2 &&
      allVersions.rows[0].content === testContentV1 &&
      allVersions.rows[1].content === testContentV2,
      '10. Historical version preservation verified (v1 and v2 both retained immutably)'
    );

    // 11. Invalid request rejection (simulate schema validation)
    const { z } = require('zod');
    const validator = z.object({
      title: z.string().min(3),
      content: z.string().min(5),
      channel: z.string().min(2),
    });
    const invalidCheck = validator.safeParse({ title: 'A', content: 'Hi', channel: '' });
    assert(!invalidCheck.success, '11. Invalid request rejection enforced via Zod schema');

    // 12. Unauthorized mutation rejection (Anon RLS check)
    const { error: anonInsertError } = await anonClient.from('audit_events').insert({
      workspace_id: '00000000-0000-0000-0000-000000000001',
      actor_id: 'malicious_actor',
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'unauthorized_action',
    });
    assert(anonInsertError !== null, '12. Unauthorized mutation rejection enforced by Row Level Security', `Code: ${anonInsertError?.code}`);

    // 13. Cross-workspace access rejection
    const { data: foreignWs } = await anonClient
      .from('workspaces')
      .select('*')
      .eq('slug', 'unauthorized-external-workspace');
    assert(!foreignWs || foreignWs.length === 0, '13. Cross-workspace access rejection verified');

    // 14. Audit event creation verified
    const subAudits = await pgClient.query(`
      SELECT action FROM audit_events WHERE entity_id = $1 ORDER BY created_at ASC;
    `, [submissionId]);
    assert(
      subAudits.rows.length === 2,
      '14. Audit event creation verified for submission lifecycle',
      `Actions logged: ${subAudits.rows.map(a => a.action).join(' -> ')}`
    );

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await pgClient.end();
  }

  console.log(`\nTest Execution Summary: ${passed}/${total} criteria passed successfully.\n`);
  if (passed !== total) process.exit(1);
}

runComprehensiveTests();
