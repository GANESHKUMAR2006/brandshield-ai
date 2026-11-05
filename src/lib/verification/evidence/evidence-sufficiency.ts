/**
 * BrandShield AI — Evidence Sufficiency Gate
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Enforces pre-determination evidentiary standards before assigning
 * 'supported' or 'contradicted' status.
 */

import {
  ContextApprovedFact,
  EvidenceMatch,
  EvidenceSufficiencyLevel,
  VerificationContext,
} from "../types";
import { EvidenceValidator } from "./evidence-validator";

export class EvidenceSufficiencyGate {
  /**
   * Identifies contradictory records among active approved facts sharing the same key.
   */
  public static detectConflictingFacts(
    facts: ContextApprovedFact[],
    effectiveDate?: Date
  ): { hasConflict: boolean; conflicts: ContextApprovedFact[] } {
    const keyMap = new Map<string, ContextApprovedFact[]>();
    for (const f of facts) {
      if (effectiveDate && !EvidenceValidator.isFactValid(f, effectiveDate)) continue;
      const list = keyMap.get(f.fact_key) || [];
      list.push(f);
      keyMap.set(f.fact_key, list);
    }

    for (const [, list] of keyMap.entries()) {
      if (list.length > 1) {
        const firstVal = JSON.stringify(list[0].fact_value);
        const hasConflict = list.some((f) => JSON.stringify(f.fact_value) !== firstVal);
        if (hasConflict) {
          return { hasConflict: true, conflicts: list };
        }
      }
    }

    return { hasConflict: false, conflicts: [] };
  }

  /**
   * Assesses whether a set of matched evidence meets the strict criteria
   * for factual substantiation or contradiction.
   */
  public static evaluateSufficiency(
    context: VerificationContext,
    matches: EvidenceMatch[]
  ): {
    sufficiency: EvidenceSufficiencyLevel;
    conflictingFacts?: ContextApprovedFact[];
    reason?: string;
  } {
    // 1. If no matches were located at all
    if (!matches || matches.length === 0) {
      return {
        sufficiency: "insufficient",
        reason: "No active approved facts, promotional terms, or clinical dossier snippets corroborate the assertion.",
      };
    }

    // 2. Check for conflicting approved facts in context for the same key
    const conflictCheck = this.detectConflictingFacts(context.approvedFacts, context.effectiveDate);
    if (conflictCheck.hasConflict) {
      return {
        sufficiency: "conflicting",
        conflictingFacts: conflictCheck.conflicts,
        reason: `Conflicting ground-truth values exist in approved_facts for key "${conflictCheck.conflicts[0]?.fact_key}". Human compliance escalation required.`,
      };
    }

    // 3. Check if all matched facts are outdated/expired
    const allOutdated = matches.every((m) => {
      if (m.approvedFactId) {
        const fact = context.approvedFacts.find((f) => f.id === m.approvedFactId);
        if (fact && !EvidenceValidator.isFactValid(fact, context.effectiveDate)) {
          return true;
        }
      }
      return false;
    });

    if (allOutdated && matches.length > 0) {
      return {
        sufficiency: "outdated",
        reason: "Supporting evidence was valid historically but has expired or been superseded for the submission date.",
      };
    }

    // 4. Traceable reference requirement: every match must provide an ID
    const hasValidReference = matches.some(
      (m) => Boolean(m.approvedFactId || m.documentVersionId || m.promotionId)
    );

    if (!hasValidReference) {
      return {
        sufficiency: "insufficient",
        reason: "Evidence lacks a valid, traceable database foreign key reference.",
      };
    }

    return { sufficiency: "sufficient" };
  }
}
