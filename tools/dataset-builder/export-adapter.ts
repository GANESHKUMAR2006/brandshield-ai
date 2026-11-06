/**
 * BrandShield AI — Export Adapter Interface & Specification
 * Phase 10A: Training Dataset Builder
 *
 * STRICT REQUIREMENT:
 * "Do not assume the final JSONL format is accepted by Adaption.
 * Keep the internal dataset representation independent of the export format.
 * Create an export adapter only after the accepted Adaption input schema is
 * verified from official documentation."
 *
 * This module defines the decoupling contract between internal DatasetExample
 * records and any future downstream LLM fine-tuning platforms.
 */

import { DatasetExample } from "./types";

export interface IExportAdapter<TOutput = unknown> {
  readonly adapterName: string;
  readonly targetPlatform: string;
  readonly schemaVersion: string;

  /**
   * Transforms a canonical BrandShield dataset example into the target platform format.
   */
  transformExample(example: DatasetExample): TOutput;
}

/**
 * Notice: Concrete Adaption AI export adapter is intentionally deferred
 * per regulatory and architectural mandate until the official Adaption AI
 * dataset ingestion schema documentation is reviewed.
 */
export class DeferredAdaptionExportAdapter implements IExportAdapter<never> {
  readonly adapterName = "DeferredAdaptionExportAdapter";
  readonly targetPlatform = "Adaption AI";
  readonly schemaVersion = "pending_official_docs";

  transformExample(): never {
    throw new Error(
      "Adaption AI export adapter is deliberately held pending official documentation verification. Use canonical JSONL."
    );
  }
}
