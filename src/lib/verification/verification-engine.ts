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
  RiskLevel,
  VerificationExecutionResult,
  VerificationRunSnapshot,
} from "./types";
import { PolicyEngine } from "@/lib/policy/policy-engine";
import { DEFAULT_POLICIES } from "@/lib/policy/default-policies";
import { PolicyEvaluationResult } from "@/types";

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

    // 4. Deterministic Policy Intelligence Evaluation (Phase 9)
    const evidenceTypes = ruleResult.evidenceMatches.map((m) => m.evidenceType);
    const policyEvaluation: PolicyEvaluationResult = PolicyEngine.evaluateClaim(
      context.claim.id,
      {
        claimText: context.claim.claim_text,
        claimType: context.claim.claim_type,
        productId: context.product?.id || null,
        channel: context.submission.channel,
        extractedEntities: context.claim.extracted_entities,
        evidenceTypes,
        submissionContent: context.submissionVersion.content,
      },
      DEFAULT_POLICIES,
      context.effectiveDate
    );

    // Calculate composite risk: maximum of verification rule risk and policy risk
    const severityHierarchy: Record<RiskLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    let compositeRisk: RiskLevel = ruleResult.riskLevel;
    if (
      policyEvaluation.maxSeverity &&
      severityHierarchy[policyEvaluation.maxSeverity] > severityHierarchy[compositeRisk]
    ) {
      compositeRisk = policyEvaluation.maxSeverity;
    }

    // 5. Build immutable evidence & policy snapshot
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
      risk_level: compositeRisk,
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
      policy_evaluation: policyEvaluation,
    };

    // 6. Persist run, evidence links, updated claim status, policy metadata, and audit log in an atomic transaction
    const executionResult = await withTransaction(async (client) => {
      // A. Insert verification_runs record
      const runRes = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO verification_runs (
          claim_id,
          engine_version,
          verification_status,
          risk_level,
          explanation,
          evidence_snapshot,
          policy_version_ids,
          policy_evaluation
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at`,
        [
          context.claim.id,
          VERIFICATION_ENGINE_VERSION,
          finalStatus,
          compositeRisk,
          finalExplanation,
          JSON.stringify(snapshot),
          policyEvaluation.effectivePolicyVersions.map((v) => v.versionId),
          JSON.stringify(policyEvaluation),
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

      // C. Update claims table record with verification status, risk, and policy intelligence
      await client.query(
        `UPDATE claims
         SET verification_status = $1,
             risk_level = $2,
             explanation = $3,
             suggested_correction = $4,
             evidence_sufficiency = $5,
             verified_at = $6,
             policy_compliance_status = $7,
             mandatory_reviewer_role = $8,
             required_evidence_types = $9,
             triggered_policy_rules = $10,
             updated_at = now()
         WHERE id = $11`,
        [
          finalStatus,
          compositeRisk,
          finalExplanation,
          ruleResult.suggestedCorrection || null,
          sufficiencyCheck.sufficiency,
          verifiedAt,
          policyEvaluation.complianceStatus,
          policyEvaluation.mandatoryReviewerRoles[0] || null,
          policyEvaluation.requiredEvidenceTypes,
          JSON.stringify(policyEvaluation.triggeredRules),
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
          $1,
          'verification_engine',
          'claim',
          $2,
          'claim_verified',
          $3
        )`,
        [
          context.submission.workspace_id || "00000000-0000-0000-0000-000000000001",
          context.claim.id,
          JSON.stringify({
            run_id: runId,
            verification_status: finalStatus,
            policy_compliance_status: policyEvaluation.complianceStatus,
            risk_level: compositeRisk,
            evidence_sufficiency: sufficiencyCheck.sufficiency,
            triggered_policies_count: policyEvaluation.triggeredRules.length,
          }),
        ]
      );

      return {
        runId,
        claimId: context.claim.id,
        status: finalStatus,
        riskLevel: compositeRisk,
        explanation: finalExplanation,
        suggestedCorrection: ruleResult.suggestedCorrection || null,
        evidenceSufficiency: sufficiencyCheck.sufficiency,
        evidenceCount: ruleResult.evidenceMatches.length,
        evidence: ruleResult.evidenceMatches,
        snapshot,
        verifiedAt,
        policyEvaluation,
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
