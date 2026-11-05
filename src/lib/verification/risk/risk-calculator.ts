/**
 * BrandShield AI — Deterministic Compliance Risk Calculator
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Computes regulatory, legal, and consumer deception risk levels (low, medium, high, critical)
 * based on claim category, verification determination, absolute guarantees, and clinical assertions.
 */

import { RiskLevel, VerificationStatus } from "../types";

export interface RiskInput {
  status: VerificationStatus;
  claimType: string;
  claimText: string;
  extractedEntities?: Record<string, unknown>;
}

export class RiskCalculator {
  /**
   * Deterministically calculates regulatory compliance risk.
   */
  public static calculateRisk(input: RiskInput): RiskLevel {
    const { status, claimType, claimText } = input;
    const textLower = claimText.toLowerCase();

    const isAbsoluteGuarantee =
      claimType === "guarantee" ||
      textLower.includes("100%") ||
      textLower.includes("overnight") ||
      textLower.includes("instant") ||
      textLower.includes("eradication") ||
      textLower.includes("guaranteed");

    const isMedicalOrClinical =
      claimType === "clinical" ||
      claimType === "efficacy" ||
      textLower.includes("wrinkle") ||
      textLower.includes("cure") ||
      textLower.includes("spot removal") ||
      textLower.includes("clinical trial");

    // 1. CRITICAL RISK:
    // Direct contradiction of efficacy, medical, clinical, or absolute guarantee assertions
    if (status === "contradicted" && (isMedicalOrClinical || isAbsoluteGuarantee)) {
      return "critical";
    }

    // 2. HIGH RISK:
    // All other contradicted claims (e.g. false formulation potency, misleading promotional pricing)
    if (status === "contradicted") {
      return "high";
    }

    // Unsubstantiated absolute guarantee or extreme claim requiring human review
    if (status === "needs_review" && isAbsoluteGuarantee) {
      return "high";
    }

    // 3. MEDIUM RISK:
    // Outdated evidence or expired promotions
    if (status === "outdated") {
      return "medium";
    }

    // Comparative assertions or ambiguous terms needing legal review
    if (status === "needs_review") {
      return "medium";
    }

    // Unverified claims (assertions without evidence in repository)
    if (status === "unverified") {
      return "medium";
    }

    // 4. LOW RISK:
    // Directly substantiated by valid approved ground-truth evidence
    if (status === "supported") {
      return "low";
    }

    return "medium";
  }
}
