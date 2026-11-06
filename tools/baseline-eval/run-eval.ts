/**
 * BrandShield AI — Baseline Evaluation Runner CLI
 * Phase 10D: Controlled Baseline Evaluation Harness
 *
 * Usage:
 *   npx tsx tools/baseline-eval/run-eval.ts --estimate
 *   npx tsx tools/baseline-eval/run-eval.ts --dry-run
 *   npx tsx tools/baseline-eval/run-eval.ts --execute --approved
 */

import { BaselineEvaluator } from "./evaluator";

async function main() {
  const args = process.argv.slice(2);
  const isEstimate = args.includes("--estimate");
  const isDryRun = args.includes("--dry-run");
  const isExecute = args.includes("--execute");
  const isApproved = args.includes("--approved");

  const modelIndex = args.indexOf("--model");
  const modelOverride = modelIndex !== -1 ? args[modelIndex + 1] : undefined;

  console.log("================================================================================");
  console.log(" BrandShield AI — Phase 10D Baseline Extraction Evaluation");
  console.log("================================================================================\n");

  const evaluator = new BaselineEvaluator({
    model: modelOverride,
    dryRun: isDryRun || isEstimate,
  });

  const { eligibleRecords, totalDatasetCount, excludedAiCount, datasetSha256 } =
    evaluator.loadEligibleRecords();

  console.log(`Dataset Path:             tools/dataset-builder/phase10b/output/evaluation_dataset.jsonl`);
  console.log(`Dataset SHA-256:          ${datasetSha256}`);
  console.log(`Total Dataset Records:    ${totalDatasetCount}`);
  console.log(`Excluded AI-Audited:      ${excludedAiCount} records`);
  console.log(`Eligible Human-Reviewed:  ${eligibleRecords.length} records`);

  const approvedCount = eligibleRecords.filter((r) => r.is_human_approved).length;
  const modifiedCount = eligibleRecords.filter((r) => r.is_human_modified).length;
  const zeroClaimCount = eligibleRecords.filter((r) => r.ground_truth_claims.length === 0).length;
  let totalGtClaims = 0;
  for (const r of eligibleRecords) totalGtClaims += r.ground_truth_claims.length;

  console.log(`  - Human-Approved:       ${approvedCount}`);
  console.log(`  - Human-Modified:       ${modifiedCount}`);
  console.log(`  - Zero-Claim (Negatives): ${zeroClaimCount}`);
  console.log(`  - Total Gold Claims:    ${totalGtClaims}\n`);

  const estimate = evaluator.estimateTokensAndCost(eligibleRecords);

  console.log("--------------------------------------------------------------------------------");
  console.log(" Model & Cost Estimation");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Configured Model:         ${estimate.model}`);
  console.log(`Prompt Version:           ${estimate.promptVersion}`);
  console.log(`Estimated Prompt Tokens:  ${estimate.estimatedPromptTokens.toLocaleString()} (~${Math.round(estimate.estimatedPromptTokens / eligibleRecords.length)} / record)`);
  console.log(`Estimated Output Tokens:  ${estimate.estimatedCompletionTokens.toLocaleString()} (~${Math.round(estimate.estimatedCompletionTokens / eligibleRecords.length)} / record)`);
  console.log(`Estimated Total Tokens:   ${estimate.estimatedTotalTokens.toLocaleString()}`);
  console.log(`Pricing (gpt-4o-mini):    $${estimate.pricingPerMillion.prompt}/1M prompt, $${estimate.pricingPerMillion.completion}/1M completion`);
  console.log(`Estimated Total Cost:     $${estimate.estimatedCostUsd.toFixed(4)} USD (~1.5 cents)\n`);

  if (isEstimate || (!isDryRun && !isExecute)) {
    console.log("Mode: ESTIMATE ONLY (No API calls executed).");
    console.log("To run offline simulation harness: npx tsx tools/baseline-eval/run-eval.ts --dry-run");
    console.log("To run live evaluation (requires key & approval): npx tsx tools/baseline-eval/run-eval.ts --execute --approved\n");
    return;
  }

  if (isDryRun) {
    console.log("Mode: DRY-RUN SIMULATION (Testing harness & metric calculations offline)...");
    const report = await evaluator.runEvaluation();
    console.log(`\nDry-run completed successfully! Overall F1: ${(report.metrics.overall.strict_f1 * 100).toFixed(1)}%`);
    return;
  }

  if (isExecute) {
    if (!isApproved) {
      console.error("FATAL: Explicit approval required to execute paid API calls. Pass --approved.");
      process.exit(1);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes("placeholder")) {
      console.error("FATAL: OPENAI_API_KEY environment variable is missing or contains placeholder.");
      console.error("Configure OPENAI_API_KEY before running live evaluation.");
      process.exit(1);
    }

    console.log("Mode: LIVE EXECUTION (Executing paid OpenAI API calls)...");
    const liveEvaluator = new BaselineEvaluator({
      model: modelOverride,
      apiKey,
      dryRun: false,
    });
    await liveEvaluator.runEvaluation();
  }
}

main().catch((err) => {
  console.error("Evaluation execution failed:", err);
  process.exit(1);
});

