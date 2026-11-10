/**
 * BrandShield AI — Evidence Validator
 * Phase 5: Deterministic Marketing Claim Verification Engine
 *
 * Provides temporal validity checks, approval status evaluations,
 * channel validation, and decimal-safe currency comparisons.
 */

import { ContextApprovedFact, ContextPromotion, ContextSourceDocument } from "../types";

export class EvidenceValidator {
  /**
   * Checks if an approved fact is valid as of the effective date.
   */
  public static isFactValid(fact: ContextApprovedFact, effectiveDate: Date): boolean {
    if (fact.approval_status !== "approved") return false;
    const from = new Date(fact.valid_from).getTime();
    const eff = effectiveDate.getTime();
    if (eff < from) return false;
    if (fact.valid_until) {
      const until = new Date(fact.valid_until).getTime();
      if (eff > until) return false;
    }
    return true;
  }

  /**
   * Checks if a promotion is active and valid on the effective date.
   * End dates are treated as inclusive.
   */
  public static isPromotionActive(promotion: ContextPromotion, effectiveDate: Date): boolean {
    if (promotion.status !== "active") return false;
    const rawStart = promotion.start_date;
    const startStr = typeof rawStart === "string" && rawStart.length === 10
      ? `${rawStart}T00:00:00.000Z`
      : rawStart;
    const start = new Date(startStr).getTime();
    const eff = effectiveDate.getTime();
    if (eff < start) return false;

    const rawEnd = promotion.end_date;
    const end = new Date(
      typeof rawEnd === "string" && rawEnd.length === 10
        ? `${rawEnd}T23:59:59.999Z`
        : rawEnd
    );
    if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
      end.setUTCHours(23, 59, 59, 999);
    } else if (end.getUTCHours() === 23 && end.getUTCMinutes() === 59 && end.getUTCSeconds() === 59) {
      end.setUTCMilliseconds(999);
    }
    if (eff > end.getTime()) return false;

    return true;
  }

  /**
   * Checks whether a promotion is applicable to the target marketing channel.
   */
  public static isChannelApplicable(promotion: ContextPromotion, targetChannel: string): boolean {
    if (!targetChannel) return true;
    const channels = promotion.applicable_channels;
    if (!channels) return true;

    const targetLower = targetChannel.trim().toLowerCase();

    if (Array.isArray(channels)) {
      if (channels.length === 0) return true;
      return channels.some((ch: unknown) => {
        if (typeof ch !== "string") return false;
        const chLower = ch.trim().toLowerCase();
        if (chLower === "all" || chLower === "*") return true;
        return targetLower.includes(chLower) || chLower.includes(targetLower);
      });
    }

    if (typeof channels === "string") {
      return targetLower.includes(channels.toLowerCase());
    }

    return true;
  }

  /**
   * Checks whether a source document version is currently approved and not expired.
   */
  public static isDocumentValid(doc: ContextSourceDocument, effectiveDate: Date): boolean {
    if (doc.approval_status !== "approved") return false;
    if (!doc.valid_from) return true;

    const from = new Date(doc.valid_from).getTime();
    const eff = effectiveDate.getTime();
    if (eff < from) return false;

    if (doc.valid_until) {
      const until = new Date(doc.valid_until).getTime();
      if (eff > until) return false;
    }

    return true;
  }

  /**
   * Decimal-safe currency comparison converting to integer paise/cents.
   * Avoids JavaScript floating point inaccuracies (e.g. 0.1 + 0.2 !== 0.3).
   */
  public static compareCurrency(a: number, b: number): number {
    const aCents = Math.round(a * 100);
    const bCents = Math.round(b * 100);
    return aCents - bCents;
  }

  /**
   * Checks equality of two monetary amounts.
   */
  public static arePricesEqual(a: number, b: number): boolean {
    return this.compareCurrency(a, b) === 0;
  }
}
