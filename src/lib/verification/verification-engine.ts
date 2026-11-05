/**
 * BrandShield AI — Deterministic Claim Verification Engine
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Master orchestrator for claim verification. Coordinates context loading,
 * rule evaluation, evidence sufficiency, risk scoring, PostgreSQL transaction persistence,
 * frozen snapshots, and audit logging.
 */

import { withTransaction } from "@/lib/db/server-db";
import { VerificationContextLoader } from "./verification-context";
import { VerificationRouter } from "./verification-router";
import { EvidenceSufficiencyGate } from "./evidence/evidence-sufficiency";
import {
  VerificationExecutionResult,
  VerificationRunSnapshot,
} from "./types";

export const VERIFICATION_ENGINE_VERSION = "1.0.0";

export class VerificationEngine {
  /**
   * Deterministically verifies a single active marketing claim.
   */
  public static async verifyClaim(claimId: string): Promise<VerificationExecutionResult> {
    // 1. Load full context from PostgreSQL
    const context = await VerificationContextLoader.loadContextForClaim(claimId);

    // 2. Route claim to deterministic rule
    const ruleResult = VerificationRouter.routeClaim(context);

    // 3. Evidence sufficiency gate check
    const sufficiencyCheck = EvidenceSufficiencyGate.evaluateSufficiency(
      context,
      ruleResult.evidenceMatches
    );

    // If evidence was conflicting, override status to needs_review
    let finalStatus = ruleResult.status;
    let finalExplanation = ruleResult.explanation;
    if (sufficiencyCheck.sufficiency === "conflicting") {
      finalStatus = "needs_review";
      finalExplanation = sufficiencyCheck.reason || finalExplanation;
    }

    // 4. Build immutable evidence snapshot
    const snapshot: VerificationRunSnapshot = {
      claim_id: context.claim.id,
      claim_text: context.claim.claim_text,
      claim_type: context.claim.claim_type,
      product_id: context.product?.id || null,
      product_name: context.product?.name || null,
      product_sku: context.product?.sku || null,
      submission_id: context.submission.id,
      submission_version_id: context.submissionVersion.id,
      verification_date: new Date().toISOString(),
      effective_evidence_date: context.effectiveDate.toISOString(),
      rule_id: ruleResult.ruleId,
      rule_engine_version: VERIFICATION_ENGINE_VERSION,
      verification_status: finalStatus,
      risk_level: ruleResult.riskLevel,
      evidence_sufficiency: sufficiencyCheck.sufficiency,
      explanation: finalExplanation,
      suggested_correction: ruleResult.suggestedCorrection || null,
      matched_facts: context.approvedFacts.map((f) => ({
        id: f.id,
        fact_key: f.fact_key,
        fact_value: f.fact_value,
      })),
      matched_promotions: context.promotions.map((p) => ({
        id: p.id,
        name: p.promotion_name,
        resulting_price: p.resulting_price,
      })),
      evidence_links: ruleResult.evidenceMatches,
    };

    // 5. Persist run, evidence links, updated claim status, and audit log in an atomic transaction
    const executionResult = await withTransaction(async (client) => {
      // A. Insert verification_runs record
      const runRes = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO verification_runs (
          claim_id,
          engine_version,
          verification_status,
          risk_level,
          explanation,
          evidence_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at`,
        [
          context.claim.id,
          VERIFICATION_ENGINE_VERSION,
          finalStatus,
          ruleResult.riskLevel,
          finalExplanation,
          JSON.stringify(snapshot),
        ]
      );
      const runId = runRes.rows[0].id;
      const verifiedAt = runRes.rows[0].created_at;

      // B. Insert claim_evidence links
      for (const match of ruleResult.evidenceMatches) {
        await client.query(
          `INSERT INTO claim_evidence (
            claim_id,
            approved_fact_id,
            document_version_id,
            evidence_excerpt,
            relevance_score,
            evidence_type
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            context.claim.id,
            match.approvedFactId || null,
            match.documentVersionId || null,
            match.evidenceExcerpt,
            match.relevanceScore,
            match.evidenceType,
          ]
        );
      }

      // C. Update claims table record
      await client.query(
        `UPDATE claims
         SET verification_status = $1,
             risk_level = $2,
             explanation = $3,
             suggested_correction = $4,
             evidence_sufficiency = $5,
             verified_at = $6,
             updated_at = now()
         WHERE id = $7`,
        [
          finalStatus,
          ruleResult.riskLevel,
          finalExplanation,
          ruleResult.suggestedCorrection || null,
          sufficiencyCheck.sufficiency,
          verifiedAt,
          context.claim.id,
        ]
      );

      // D. Append immutable audit event
      await client.query(
        `INSERT INTO audit_events (
          workspace_id,
          actor_id,
          entity_type,
          entity_id,
          action,
          after_state
        ) VALUES (
          '00000000-0000-0000-0000-000000000001',
          'verification_engine',
          'claim',
          $1,
          'claim_verified',
          $2
        )`,
        [
          context.claim.id,
          JSON.stringify({
            run_id: runId,
            verification_status: finalStatus,
            risk_level: ruleResult.riskLevel,
            evidence_sufficiency: sufficiencyCheck.sufficiency,
          }),
        ]
      );

      return {
        runId,
        claimId: context.claim.id,
        status: finalStatus,
        riskLevel: ruleResult.riskLevel,
        explanation: finalExplanation,
        suggestedCorrection: ruleResult.suggestedCorrection || null,
        evidenceSufficiency: sufficiencyCheck.sufficiency,
        evidenceCount: ruleResult.evidenceMatches.length,
        evidence: ruleResult.evidenceMatches,
        snapshot,
        verifiedAt,
      };
    });

    return executionResult;
  }

  /**
   * Verifies all active extracted claims for a marketing submission.
   */
  public static async verifySubmissionClaims(
    submissionId: string
  ): Promise<VerificationExecutionResult[]> {
    const { query: dbQuery } = await import("@/lib/db/server-db");

    // Fetch active claims for this submission
    const claimsRes = await dbQuery<{ id: string }>(
      `SELECT c.id 
       FROM claims c
       JOIN submissions s ON c.submission_id = s.id
       JOIN workspaces w ON s.workspace_id = w.id
       WHERE c.submission_id = $1 AND c.is_active = true AND w.slug = 'dermaglow'`,
      [submissionId]
    );

    const results: VerificationExecutionResult[] = [];
    for (const row of claimsRes.rows) {
      const res = await this.verifyClaim(row.id);
      results.push(res);
    }

    return results;
  }
}
