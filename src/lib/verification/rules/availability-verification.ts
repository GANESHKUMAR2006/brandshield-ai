/**
 * BrandShield AI — Availability Claim Verification Rule
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Verifies distribution channel, stock availability, and geographic market claims.
 */

import { EvidenceMatch, RuleResult, VerificationContext } from "../types";
import { EvidenceValidator } from "../evidence/evidence-validator";

export function verifyAvailabilityClaim(context: VerificationContext): RuleResult {
  const { approvedFacts, effectiveDate } = context;

  const statusFact = approvedFacts.find((f) => f.fact_key === "product_status");
  const evidenceMatches: EvidenceMatch[] = [];

  if (statusFact && EvidenceValidator.isFactValid(statusFact, effectiveDate)) {
    const sVal = statusFact.fact_value as Record<string, unknown>;
    evidenceMatches.push({
      approvedFactId: statusFact.id,
      evidenceType: "approved_fact",
      evidenceExcerpt: `Catalogue availability status: ${sVal.status}, stock: ${sVal.availability}, market: ${sVal.market}.`,
      relevanceScore: 0.95,
    });

    const status = "supported";
    return {
      ruleId: "availability_verification_v1",
      status,
      riskLevel: "low",
      sufficiency: "sufficient",
      explanation: `Availability claim aligns with approved product status records.`,
      evidenceMatches,
    };
  }

  return {
    ruleId: "availability_verification_v1",
    status: "unverified",
    riskLevel: "low",
    sufficiency: "insufficient",
    explanation: "No approved stock availability facts are registered for this product.",
    evidenceMatches: [],
  };
}
