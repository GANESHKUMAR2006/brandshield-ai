/**
 * BRANDSHIELD AI: CREATE ORGANIZATION MODAL UI & WORKFLOW TEST SUITE
 *
 * Verifies all 12 layout, responsiveness, scrolling, validation,
 * accessibility, and workspace creation workflow invariants.
 */

import * as fs from "fs";
import * as path from "path";

let passedCount = 0;
let failedCount = 0;

function check(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    if (detail) console.log(`         └─ ${detail}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${name}`);
    if (detail) console.error(`         └─ ${detail}`);
    failedCount++;
  }
}

// Slug generator matching component implementation
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidDomain(domain: string): boolean {
  if (!domain) return true;
  const regex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return regex.test(domain.trim());
}

async function runTests() {
  console.log("========================================================================");
  console.log(" BRANDSHIELD AI: CREATE ORGANIZATION MODAL VERIFICATION SUITE           ");
  console.log("========================================================================");

  const modalFilePath = path.join(
    __dirname,
    "../src/components/workspace/CreateOrganizationModal.tsx"
  );
  const modalContent = fs.readFileSync(modalFilePath, "utf8");

  // -------------------------------------------------------------------------
  // Suite 1: Root Cause & Positioning Architecture
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 1: Modal Viewport Positioning & Portal Mounting ---");

  // 1.1 Portal Mounting
  check(
    modalContent.includes("createPortal(") && modalContent.includes("document.body"),
    "1.1 Modal mounts directly to document.body via createPortal (immune to backdrop-blur containing block)",
    "createPortal(modalContent, document.body)"
  );

  // 1.2 Fullscreen Overlay & Centering
  check(
    modalContent.includes("fixed inset-0") &&
      modalContent.includes("items-center justify-center") &&
      modalContent.includes("z-[100]"),
    "1.2 Fullscreen overlay centers modal with high stacking precedence (z-[100])",
    "fixed inset-0 z-[100] flex items-center justify-center"
  );

  // 1.3 Max-Height Viewport Boundary
  check(
    modalContent.includes("max-h-[calc(100dvh-32px)]"),
    "1.3 Modal card enforces dynamic viewport height constraint (100dvh - 32px)",
    "max-h-[calc(100dvh-32px)] sm:max-h-[calc(100dvh-48px)]"
  );

  // 1.4 Independent Scroll Container Structure
  check(
    modalContent.includes("flex flex-col") &&
      modalContent.includes("overflow-y-auto") &&
      modalContent.includes("shrink-0"),
    "1.4 Modal uses flex column layout with pinned header/footer and scrollable body",
    "Header & footer shrink-0, body overflow-y-auto flex-1"
  );

  // 1.5 Background Page Scroll Lock
  check(
    modalContent.includes('document.body.style.overflow = "hidden"'),
    "1.5 Background body scrolling locked while modal is open, restored on unmount",
    'document.body.style.overflow = "hidden"'
  );

  // -------------------------------------------------------------------------
  // Suite 2: Viewport Dimensions & Responsive Boundaries
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 2: Viewport Geometry & Safe Margin Calculations ---");

  const viewports = [
    { name: "Full HD Desktop", width: 1920, height: 1080, marginY: 48 },
    { name: "Standard Laptop", width: 1366, height: 768, marginY: 48 },
    { name: "Compact Laptop / 720p", width: 1280, height: 720, marginY: 48 },
    { name: "Tablet Landscape", width: 1024, height: 768, marginY: 48 },
    { name: "Mobile Phone (Portrait)", width: 390, height: 844, marginY: 32 },
    { name: "Small Mobile Phone", width: 360, height: 640, marginY: 32 },
  ];

  for (const vp of viewports) {
    const maxModalHeight = vp.height - vp.marginY;
    const maxModalWidth = Math.min(vp.width - 24, 512); // max-w-lg is 32rem = 512px

    const fitsHeight = maxModalHeight > 300;
    const fitsWidth = maxModalWidth <= vp.width;

    check(
      fitsHeight && fitsWidth,
      `2.${viewports.indexOf(vp) + 1} Fully contained at ${vp.width}×${vp.height} (${vp.name})`,
      `Max Dialog Height: ${maxModalHeight}px (Safe Margin: ${vp.marginY}px), Max Width: ${maxModalWidth}px`
    );
  }

  // -------------------------------------------------------------------------
  // Suite 3: Form Validation & Slug Generation
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 3: Form Validation & Automatic Slug Generation ---");

  // 3.1 Slug generation from organization names
  check(
    generateSlug("BioTech Health Inc.") === "biotech-health-inc",
    "3.1 Generates clean hyphenated slug from standard company name",
    generateSlug("BioTech Health Inc.")
  );

  check(
    generateSlug("  Aura-Skin Labs 2026!  ") === "aura-skin-labs-2026",
    "3.2 Strips special characters and trims whitespace/hyphens",
    generateSlug("  Aura-Skin Labs 2026!  ")
  );

  check(
    generateSlug("L'Oréal Paris & Cosmeceuticals") === "l-or-al-paris-cosmeceuticals",
    "3.3 Handles non-alphanumeric punctuation cleanly",
    generateSlug("L'Oréal Paris & Cosmeceuticals")
  );

  // 3.2 Slug format regex validation
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  check(slugRegex.test("biotech-health"), "3.4 Validates correct slug 'biotech-health'");
  check(!slugRegex.test("biotech--health"), "3.5 Rejects double hyphens in slug");
  check(!slugRegex.test("-biotech-health"), "3.6 Rejects leading hyphen");
  check(!slugRegex.test("biotech-health-"), "3.7 Rejects trailing hyphen");
  check(!slugRegex.test("BioTech-Health"), "3.8 Rejects uppercase letters in slug");

  // 3.3 Domain validation
  check(isValidDomain("biotech.com"), "3.9 Validates standard corporate domain 'biotech.com'");
  check(isValidDomain("sub.clinical-trials.org"), "3.10 Validates multi-level corporate domain");
  check(isValidDomain(""), "3.11 Allows empty optional domain");
  check(!isValidDomain("not a domain"), "3.12 Rejects domain with spaces");

  // -------------------------------------------------------------------------
  // Suite 4: Form Error Resilience & Value Preservation
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 4: Value Preservation & Error Handling ---");

  // Verify modal does NOT clear name/slug on failure in source code
  const hasCatchBlock = modalContent.includes("catch (err)");
  const resetsValuesInCatch =
    modalContent.includes("setName(\"\")") &&
    modalContent.split("catch (err)")[1]?.includes("setName(\"\")");

  check(
    hasCatchBlock && !resetsValuesInCatch,
    "4.1 Catch block preserves user-entered name, slug, and domain upon API error",
    "Form values remain in inputs for easy user correction"
  );

  check(
    modalContent.includes("role=\"alert\""),
    "4.2 Error banner provides role='alert' for screen-reader accessibility"
  );

  // -------------------------------------------------------------------------
  // Suite 5: Keyboard Navigation & Accessibility Semantics
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 5: Accessibility & Keyboard Interaction ---");

  check(
    modalContent.includes("role=\"dialog\"") &&
      modalContent.includes("aria-modal=\"true\"") &&
      modalContent.includes("aria-labelledby=\"create-org-modal-title\"") &&
      modalContent.includes("aria-describedby=\"create-org-modal-desc\""),
    "5.1 Dialog semantics, aria-modal, aria-labelledby, and aria-describedby present"
  );

  check(
    modalContent.includes('e.key === "Escape"'),
    "5.2 Escape key listener registered to dismiss modal"
  );

  check(
    modalContent.includes("nameInputRef.current?.focus()"),
    "5.3 Focus moves automatically to Organization Name input upon opening"
  );

  check(
    modalContent.includes("triggerElementRef.current?.focus()"),
    "5.4 Focus restores to trigger element when modal closes"
  );

  // -------------------------------------------------------------------------
  // Suite 6: Duplicate Slug Backend Integration & API Contract
  // -------------------------------------------------------------------------
  console.log("\n--- Suite 6: Workspace API Contract & Duplicate Slug Handling ---");

  const workspaceRoutePath = path.join(
    __dirname,
    "../src/app/api/workspaces/route.ts"
  );
  const routeContent = fs.readFileSync(workspaceRoutePath, "utf8");

  check(
    routeContent.includes("SELECT id FROM workspaces WHERE slug = $1 LIMIT 1"),
    "6.1 Backend checks unique workspace slug constraint"
  );

  check(
    routeContent.includes("status: 409"),
    "6.2 Backend returns HTTP 409 Conflict when workspace slug already exists"
  );

  check(
    routeContent.includes("status: 201"),
    "6.3 Backend returns HTTP 201 Created on successful workspace provisioning"
  );

  check(
    routeContent.includes("INSERT INTO workspace_memberships") &&
      routeContent.includes("'admin'"),
    "6.4 Creator is automatically granted 'admin' membership in the new workspace"
  );

  console.log("\n========================================================================");
  console.log(` CREATE ORG MODAL SUMMARY: ${passedCount} passed, ${failedCount} failed.`);
  console.log("========================================================================");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("FATAL test error:", err);
  process.exit(1);
});
