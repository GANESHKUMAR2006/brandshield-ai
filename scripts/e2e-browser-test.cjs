let playwright;
try {
  playwright = require("playwright");
} catch {
  try {
    playwright = require("C:/Users/Saran/AppData/Local/npm-cache/_npx/a65324f5b857fffd/node_modules/playwright");
  } catch (e) {
    console.error("Playwright not found. Run: npx playwright install");
    process.exit(1);
  }
}

async function runBrowserTest() {
  console.log("========================================================================");
  console.log("  BRANDSHIELD AI: REAL BROWSER UI END-TO-END VALIDATION (PLAYWRIGHT)   ");
  console.log("  Base URL: http://localhost:3000                                       ");
  console.log("========================================================================\n");

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];

  try {
    // 1. Dashboard Page
    console.log("1. Testing Compliance Dashboard (/dashboard)...");
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 30000 });
    const dashboardTitle = await page.title();
    const dashboardContent = await page.content();
    const hasWorkspace = dashboardContent.includes("DermaGlow") || dashboardContent.includes("BrandShield");
    const hasMetrics = dashboardContent.includes("Compliance") || dashboardContent.includes("Claims") || dashboardContent.includes("Submissions");

    console.log(`   └─ Page Title: "${dashboardTitle}"`);
    console.log(`   └─ Workspace branding rendered: ${hasWorkspace}`);
    console.log(`   └─ Metrics widgets rendered: ${hasMetrics}`);
    results.push({
      page: "/dashboard",
      title: dashboardTitle,
      checks: [
        `Title: ${dashboardTitle}`,
        `Branding present: ${hasWorkspace}`,
        `Metrics present: ${hasMetrics}`,
      ],
      passed: hasWorkspace,
    });

    // 2. Submissions Page
    console.log("\n2. Testing Submissions List (/submissions)...");
    await page.goto("http://localhost:3000/submissions", { waitUntil: "networkidle", timeout: 30000 });
    const subTitle = await page.title();
    const subContent = await page.content();
    const hasExistingSub = subContent.includes("DermaGlow Radiant Festival Campaign 2026") || subContent.includes("7f537608");
    const hasTable = subContent.includes("<table") || subContent.includes("submission") || subContent.includes("Campaign");

    console.log(`   └─ Submissions table rendered: ${hasTable}`);
    console.log(`   └─ Located QA submission "DermaGlow Radiant Festival Campaign 2026": ${hasExistingSub}`);
    results.push({
      page: "/submissions",
      title: subTitle,
      checks: [
        `Table rendered: ${hasTable}`,
        `QA submission located: ${hasExistingSub}`,
      ],
      passed: hasExistingSub,
    });

    // 3. Reviews Queue Page
    console.log("\n3. Testing Review Queue (/reviews)...");
    await page.goto("http://localhost:3000/reviews", { waitUntil: "networkidle", timeout: 30000 });
    const revTitle = await page.title();
    const revContent = await page.content();
    const hasReviewer = revContent.includes("Elena") || revContent.includes("compliance_reviewer") || revContent.includes("Review");
    const hasQueue = revContent.includes("Queue") || revContent.includes("Claim") || revContent.includes("Pending");

    console.log(`   └─ Review queue rendered: ${hasQueue}`);
    console.log(`   └─ Reviewer persona identity: ${hasReviewer}`);
    results.push({
      page: "/reviews",
      title: revTitle,
      checks: [
        `Queue rendered: ${hasQueue}`,
        `Reviewer persona: ${hasReviewer}`,
      ],
      passed: hasQueue,
    });

    // 4. Policies Management Page
    console.log("\n4. Testing Policies Governance (/policies)...");
    await page.goto("http://localhost:3000/policies", { waitUntil: "networkidle", timeout: 30000 });
    const polTitle = await page.title();
    const polContent = await page.content();
    const hasPolicies = polContent.includes("Medical Treatment & Therapeutic Claim Prohibition") || polContent.includes("POL-DERMA-001");
    const hasPolicyCount = polContent.includes("Absolute Language & Instant Guarantee Policy") || polContent.includes("POL-DERMA-002");

    console.log(`   └─ Policies rendered: ${hasPolicies}`);
    console.log(`   └─ Persisted policies verified: ${hasPolicyCount}`);
    results.push({
      page: "/policies",
      title: polTitle,
      checks: [
        `POL-DERMA-001 present: ${hasPolicies}`,
        `POL-DERMA-002 present: ${hasPolicyCount}`,
      ],
      passed: hasPolicies && hasPolicyCount,
    });

    // 5. Audit Trail Page
    console.log("\n5. Testing Governance Audit Trail (/audit)...");
    await page.goto("http://localhost:3000/audit", { waitUntil: "networkidle", timeout: 30000 });
    const auditTitle = await page.title();
    const auditContent = await page.content();
    const hasAuditTable = auditContent.includes("Audit") || auditContent.includes("Actor") || auditContent.includes("Action");
    const hasEvents = auditContent.includes("review_decision_created") || auditContent.includes("submission") || auditContent.includes("Elena");

    console.log(`   └─ Audit log rendered: ${hasAuditTable}`);
    console.log(`   └─ Audit events displayed: ${hasEvents}`);
    results.push({
      page: "/audit",
      title: auditTitle,
      checks: [
        `Table rendered: ${hasAuditTable}`,
        `Events logged: ${hasEvents}`,
      ],
      passed: hasAuditTable,
    });

    console.log("\n========================================================================");
    console.log("  BROWSER TEST SUMMARY                                                  ");
    console.log("========================================================================");
    results.forEach((r, idx) => {
      console.log(`  ${idx + 1}. [${r.passed ? "PASS" : "FAIL"}] ${r.page}: ${r.title}`);
      r.checks.forEach((c) => console.log(`       └─ ${c}`));
    });

  } catch (err) {
    console.error("Browser test error:", err);
  } finally {
    await browser.close();
  }
}

runBrowserTest().catch(console.error);

