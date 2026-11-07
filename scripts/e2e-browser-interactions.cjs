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

async function testModalInteractions() {
  console.log("========================================================================");
  console.log("  BRANDSHIELD AI: PLAYWRIGHT MODAL INTERACTION & EVIDENCE INSPECTION    ");
  console.log("========================================================================\n");

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("request", req => {
    if (req.url().includes("/api/")) console.log(">> REQ:", req.method(), req.url());
  });
  page.on("response", res => {
    if (res.url().includes("/api/")) console.log("<< RES:", res.status(), res.url());
  });
  page.on("console", msg => console.log("PAGE CONSOLE:", msg.type(), msg.text()));

  try {
    console.log("1. Navigating to /submissions...");
    await page.goto("http://localhost:3000/submissions", { waitUntil: "networkidle" });

    // Locate submission row
    const subCard = page.locator("text=DermaGlow Radiant Festival Campaign 2026").first();
    await subCard.waitFor({ state: "visible", timeout: 10000 });
    console.log("   └─ Found submission card in list");

    console.log("2. Clicking submission card to open modal...");
    await subCard.click();

    // Modal should appear
    const modal = page.locator("role=dialog").first();
    await modal.waitFor({ state: "visible", timeout: 10000 });
    console.log("   └─ SubmissionDetailModal dialog opened successfully!");

    // Wait for async fetch to finish (Loading... disappears)
    await page.waitForFunction(() => !document.querySelector("role=dialog")?.innerText.includes("Loading..."), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const modalText = await modal.innerText();
    console.log("3. Modal Text Preview:\n" + modalText.slice(0, 600));
    
    // Check for content elements
    const hasCampaignTitle = modalText.includes("DermaGlow Radiant Festival Campaign 2026");
    const hasClaimsHeader = modalText.includes("Marketing Claims") || modalText.includes("Claims");
    const hasVitC = modalText.includes("10% stabilised Vitamin C");
    const hasPrice = modalText.includes("1,999");
    const hasGuarantee = modalText.includes("Guaranteed 100% eradication");
    const hasPublicationGate = modalText.includes("Ineligible for Pub") || modalText.includes("Publication");

    console.log(`   └─ Campaign Title present: ${hasCampaignTitle}`);
    console.log(`   └─ Claims section present: ${hasClaimsHeader}`);
    console.log(`   └─ Ingredient claim present: ${hasVitC}`);
    console.log(`   └─ Price claim present: ${hasPrice}`);
    console.log(`   └─ Absolute guarantee claim present: ${hasGuarantee}`);
    console.log(`   └─ Publication readiness gate displayed: ${hasPublicationGate}`);

    if (hasCampaignTitle && hasVitC && hasPrice) {
      console.log("\n[PASS] Modal interactive workflow validated successfully in real browser!");
    } else {
      throw new Error("Modal elements missing");
    }

  } catch (err) {
    console.error("Interaction test error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testModalInteractions().catch(console.error);
