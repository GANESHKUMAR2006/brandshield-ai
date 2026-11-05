/**
 * BrandShield AI — Claim Extraction Service
 * Phase 4: AI-Powered Marketing Claim Extraction Engine
 *
 * Coordinates LLM claim extraction, Zod validation, JavaScript UTF-16 offset checks,
 * product normalization, historical version preservation, and PostgreSQL persistence.
 */

import { LLMProvider } from "../providers/provider-interface";
import { getConfiguredProvider } from "../providers/configured-provider";
import { ClaimValidator, ValidationReport } from "../validation/claim-validator";
import { ExtractionNormalizer } from "./extraction-normalizer";
import { query, withTransaction } from "@/lib/db/server-db";
import { EXTRACTION_PROMPT_VERSION } from "./extraction-prompt";

export interface ExtractOptions {
  versionId?: string;
  forceReextract?: boolean;
  providerOverride?: LLMProvider;
}

export interface ExtractionExecutionResult {
  runId: string;
  submissionId: string;
  versionId: string;
  versionNumber: number;
  provider: string;
  model: string;
  promptVersion: string;
  claimsCount: number;
  claims: Array<{
    id: string;
    claim_text: string;
    claim_type: string;
    text_start: number;
    text_end: number;
    product_id: string | null;
    extracted_entities: Record<string, unknown>;
    extraction_confidence: number;
    verification_status: string;
  }>;
  validationReport: ValidationReport;
  executionTimeMs: number;
}

export class ExtractionService {
  /**
   * Main entry point to extract claims from a submission version.
   */
  public static async extractFromSubmissionVersion(
    submissionId: string,
    options?: ExtractOptions
  ): Promise<ExtractionExecutionResult> {
    const startTime = Date.now();

    // 1. Resolve workspace and verify submission existence
    const subRes = await query<{
      id: string;
      workspace_id: string;
      title: string;
      channel: string;
      product_id: string | null;
      status: string;
    }>(
      `SELECT s.id, s.workspace_id, s.title, s.channel, s.product_id, s.status
       FROM submissions s
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE s.id = $1 AND w.slug = 'dermaglow'`,
      [submissionId]
    );

    if (subRes.rows.length === 0) {
      throw new Error(`Submission "${submissionId}" not found or not in active workspace.`);
    }
    const submission = subRes.rows[0];

    // 2. Resolve submission version
    let versionQuery = `SELECT id, version_number, content FROM submission_versions WHERE submission_id = $1`;
    const params: unknown[] = [submissionId];

    if (options?.versionId) {
      versionQuery += ` AND id = $2`;
      params.push(options.versionId);
    } else {
      versionQuery += ` ORDER BY version_number DESC LIMIT 1`;
    }

    const verRes = await query<{
      id: string;
      version_number: number;
      content: string;
    }>(versionQuery, params);

    if (verRes.rows.length === 0) {
      throw new Error(`Submission version not found for submission "${submissionId}".`);
    }
    const version = verRes.rows[0];

    // 3. Load workspace products for normalization
    const prodRes = await query<{
      id: string;
      name: string;
      sku: string;
    }>(
      `SELECT id, name, sku FROM products WHERE workspace_id = $1`,
      [submission.workspace_id]
    );
    const knownProducts = prodRes.rows;

    // 4. Resolve LLM provider
    const provider = options?.providerOverride || getConfiguredProvider();

    // 5. Initialise extraction run record
    const runRes = await query<{ id: string }>(
      `INSERT INTO extraction_runs (
        workspace_id,
        submission_id,
        submission_version_id,
        provider,
        model_identifier,
        prompt_version,
        status,
        started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'running', now())
      RETURNING id`,
      [
        submission.workspace_id,
        submission.id,
        version.id,
        provider.providerName,
        provider.modelIdentifier,
        EXTRACTION_PROMPT_VERSION,
      ]
    );
    const runId = runRes.rows[0].id;

    try {
      // 6. Execute model extraction
      const extractionRaw = await provider.extractClaims({
        content: version.content,
        submissionTitle: submission.title,
        channel: submission.channel,
        knownProducts,
      });

      // 7. Validate output with strict Zod schema and UTF-16 offset verification
      const validationReport = ClaimValidator.validateExtraction(
        extractionRaw.rawClaims,
        version.content
      );

      // If validation completely failed (e.g. invalid spans or schema)
      if (!validationReport.success && validationReport.validatedClaims.length === 0) {
        const errorMsg =
          validationReport.validationErrors.join("; ") || "Extraction validation failed.";
        await query(
          `UPDATE extraction_runs 
           SET status = 'failed', error_message = $1, completed_at = now()
           WHERE id = $2`,
          [errorMsg, runId]
        );
        throw new Error(`Extraction validation failed: ${errorMsg}`);
      }

      // 8. Product normalization and persistence inside an atomic transaction
      const persistedClaims = await withTransaction(async (client) => {
        // Documented Re-extraction strategy:
        // Mark prior claims for this submission version as superseded (is_active = false)
        // This immutably preserves earlier extraction records for audit trails.
        await client.query(
          `UPDATE claims 
           SET is_active = false, updated_at = now()
           WHERE submission_version_id = $1`,
          [version.id]
        );

        const insertedRows: Array<{
          id: string;
          claim_text: string;
          claim_type: string;
          text_start: number;
          text_end: number;
          product_id: string | null;
          extracted_entities: Record<string, unknown>;
          extraction_confidence: number;
          verification_status: string;
        }> = [];

        // Insert new claims
        for (const claim of validationReport.validatedClaims) {
          const norm = ExtractionNormalizer.normalizeProduct(
            claim,
            knownProducts,
            submission.product_id
          );

          const insertRes = await client.query<{
            id: string;
            claim_text: string;
            claim_type: string;
            text_start: number;
            text_end: number;
            product_id: string | null;
            extracted_entities: Record<string, unknown>;
            extraction_confidence: number;
            verification_status: string;
          }>(
            `INSERT INTO claims (
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'unverified', true)
            RETURNING id, claim_text, claim_type, text_start, text_end, product_id, 
                      extracted_entities, extraction_confidence, verification_status`,
            [
              submission.id,
              version.id,
              runId,
              claim.claim_text,
              claim.claim_type,
              claim.text_start,
              claim.text_end,
              norm.productId,
              JSON.stringify(claim.entities || {}),
              claim.extraction_confidence,
            ]
          );

          insertedRows.push(insertRes.rows[0]);
        }

        // Complete extraction run
        await client.query(
          `UPDATE extraction_runs
           SET status = 'completed',
               claims_count = $1,
               raw_output = $2,
               completed_at = now()
           WHERE id = $3`,
          [
            insertedRows.length,
            JSON.stringify({ claims: validationReport.validatedClaims }),
            runId,
          ]
        );

        // Update submission status to processing/in_review if it was draft or submitted
        if (submission.status === "draft" || submission.status === "submitted") {
          await client.query(
            `UPDATE submissions 
             SET status = 'processing', updated_at = now()
             WHERE id = $1`,
            [submission.id]
          );
        }

        // Append audit log event
        await client.query(
          `INSERT INTO audit_events (
            workspace_id,
            actor_id,
            entity_type,
            entity_id,
            action,
            after_state
          ) VALUES ($1, 'ai_extraction_engine', 'submission', $2, 'claims_extracted', $3)`,
          [
            submission.workspace_id,
            submission.id,
            JSON.stringify({
              run_id: runId,
              version_id: version.id,
              version_number: version.version_number,
              claims_count: insertedRows.length,
              provider: provider.providerName,
              model: provider.modelIdentifier,
            }),
          ]
        );

        return insertedRows;
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        runId,
        submissionId: submission.id,
        versionId: version.id,
        versionNumber: version.version_number,
        provider: provider.providerName,
        model: provider.modelIdentifier,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        claimsCount: persistedClaims.length,
        claims: persistedClaims,
        validationReport,
        executionTimeMs,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // Mark extraction run as failed if not already updated
      try {
        await query(
          `UPDATE extraction_runs 
           SET status = 'failed', error_message = $1, completed_at = now()
           WHERE id = $2`,
          [errorMsg, runId]
        );
      } catch {
        // Suppress secondary logging error
      }
      throw err;
    }
  }
}
