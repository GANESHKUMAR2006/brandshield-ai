const { Client } = require('pg');

async function testLiveExtractionWorkflow() {
  console.log("=== Testing End-to-End Extraction Workflow against Supabase ===");

  const connectionString = process.env.SUPABASE_DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 1. Fetch Ad Variant A submission and version
    const subRes = await client.query(`
      SELECT s.id, s.title, sv.id as version_id, sv.version_number, sv.content
      FROM submissions s
      JOIN submission_versions sv ON s.id = sv.submission_id
      JOIN workspaces w ON s.workspace_id = w.id
      WHERE s.title ILIKE '%Ad Variant A%' AND w.slug = 'dermaglow'
      LIMIT 1;
    `);

    const sub = subRes.rows[0];
    console.log(`✓ Located target submission: "${sub.title}" (Version ${sub.version_number})`);
    console.log(`  Content: "${sub.content}"`);

    // 2. Create an extraction run
    const runRes = await client.query(`
      INSERT INTO extraction_runs (
        workspace_id,
        submission_id,
        submission_version_id,
        provider,
        model_identifier,
        prompt_version,
        status,
        started_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        $1, $2, 'mock', 'deterministic-v1', '1.0.0', 'running', now()
      ) RETURNING id;
    `, [sub.id, sub.version_id]);
    const runId = runRes.rows[0].id;
    console.log(`✓ Initialized extraction run record: ${runId}`);

    // 3. Mark previous claims for this version as inactive (re-extraction strategy)
    await client.query(`
      UPDATE claims SET is_active = false WHERE submission_version_id = $1;
    `, [sub.version_id]);

    // 4. Extract claims with exact UTF-16 offsets
    const content = sub.content;
    const extractedItems = [
      {
        text: "25% Ultra Vitamin C Serum",
        type: "product_attribute",
        hint: "DermaGlow Vitamin C Serum",
        entities: { ingredient: "Vitamin C", concentration: 25, unit: "%" },
        conf: 0.98,
      },
      {
        text: "price of only ₹999",
        type: "price",
        hint: "DermaGlow Vitamin C Serum",
        entities: { price: 999, currency: "INR" },
        conf: 0.97,
      },
      {
        text: "Eliminates 100% of wrinkles overnight",
        type: "guarantee",
        hint: "DermaGlow Vitamin C Serum",
        entities: { timeline: "overnight", reduction: "100%" },
        conf: 0.96,
      },
    ];

    const insertedClaims = [];
    for (const item of extractedItems) {
      const start = content.indexOf(item.text);
      if (start < 0) throw new Error(`Offset mismatch for "${item.text}"`);
      const end = start + item.text.length;

      // Invariant check: content.slice(start, end) === item.text
      if (content.slice(start, end) !== item.text) {
        throw new Error(`Invariant failed: slice [${start}..${end}] does not match "${item.text}"`);
      }

      const ins = await client.query(`
        INSERT INTO claims (
          submission_id,
          submission_version_id,
          extraction_run_id,
          claim_text,
          claim_type,
          text_start,
          text_end,
          product_id,
          extracted_entities,
          extraction_confidence,
          verification_status,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, '00000000-0000-0000-0000-000000000010', $8, $9, 'unverified', true)
        RETURNING id, claim_text, claim_type, text_start, text_end, extraction_confidence, verification_status;
      `, [sub.id, sub.version_id, runId, item.text, item.type, start, end, JSON.stringify(item.entities), item.conf]);

      insertedClaims.push(ins.rows[0]);
    }

    console.log(`✓ Inserted ${insertedClaims.length} validated claims into PostgreSQL with verification_status = 'unverified':`);
    for (const c of insertedClaims) {
      console.log(`  - [${c.claim_type}] "${c.claim_text}" | span: [${c.text_start}..${c.text_end}] | conf: ${c.extraction_confidence} | status: ${c.verification_status}`);
    }

    // 5. Complete extraction run
    await client.query(`
      UPDATE extraction_runs
      SET status = 'completed', claims_count = $1, completed_at = now()
      WHERE id = $2;
    `, [insertedClaims.length, runId]);
    console.log(`✓ Updated extraction run ${runId} status to 'completed' with claims_count = ${insertedClaims.length}`);

    // 6. Record audit event
    await client.query(`
      INSERT INTO audit_events (
        workspace_id,
        actor_id,
        entity_type,
        entity_id,
        action,
        after_state
      ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'ai_extraction_engine',
        'submission',
        $1,
        'claims_extracted',
        $2
      );
    `, [sub.id, JSON.stringify({ run_id: runId, claims_count: insertedClaims.length })]);
    console.log(`✓ Appended immutable audit log event: claims_extracted`);

    // Verify all active claims in table
    const activeClaimsRes = await client.query(`
      SELECT count(*) as count FROM claims WHERE submission_id = $1 AND is_active = true;
    `, [sub.id]);
    console.log(`✓ Confirmed active claims count in DB: ${activeClaimsRes.rows[0].count}`);

    console.log("\n=== Live Extraction Workflow Test Succeeded ===");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testLiveExtractionWorkflow();
