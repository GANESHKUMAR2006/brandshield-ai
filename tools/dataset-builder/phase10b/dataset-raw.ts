/**
 * BrandShield AI — Phase 10B Real-World Raw Evaluation Corpus
 * Standalone Quality Measurement & Human Review Annotation Engine
 *
 * Contains 120 realistic, varied marketing copy examples spanning:
 * - 6 marketing channels
 * - All 10 BrandShield claim categories
 * - Hard negatives (zero claims), single claims, multi-claims, ambiguous claims,
 *   numerical claims, promotional conditions, and high-risk regulatory language.
 *
 * ALL records are initialized with review_status: "unreviewed" and reviewer_name: null.
 * NO synthetic approvals or fake human personas are generated.
 */

import { ClaimType, ClaimEntities } from "../../../src/lib/ai/extraction/extraction-schema";
import { EvaluationExample, EvaluationClaim, EvaluationChannel } from "./types";

function buildClaim(
  content: string,
  claimText: string,
  claimType: ClaimType,
  entities: ClaimEntities = {},
  options?: {
    productHint?: string | null;
    confidence?: number;
    occurrenceIndex?: number;
  }
): EvaluationClaim {
  let idx = -1;
  const targetOccur = options?.occurrenceIndex ?? 0;
  let currOccur = 0;
  let pos = 0;
  while ((pos = content.indexOf(claimText, pos)) !== -1) {
    if (currOccur === targetOccur) {
      idx = pos;
      break;
    }
    currOccur++;
    pos += 1;
  }
  if (idx === -1) {
    throw new Error(`Draft claim substring "${claimText}" not found in content: "${content}"`);
  }
  const text_start = idx;
  const text_end = idx + claimText.length;
  if (content.slice(text_start, text_end) !== claimText) {
    throw new Error(`Slice mismatch invariant failed for "${claimText}"`);
  }
  return {
    claim_id: `cl_raw_${Math.random().toString(36).substring(2, 9)}`,
    claim_text: claimText,
    claim_type: claimType,
    text_start,
    text_end,
    product_hint: options?.productHint ?? null,
    entities,
    extraction_confidence: options?.confidence ?? 0.95,
    annotation_state: "draft_proposal",
  };
}

function makeExample(
  idNum: number,
  channel: EvaluationChannel,
  brand: string,
  productId: string | null,
  content: string,
  claims: EvaluationClaim[],
  metaFlags: {
    has_ambiguity?: boolean;
    has_numerical_claim?: boolean;
    has_promotional_conditions?: boolean;
    has_high_risk_language?: boolean;
    risk_types?: Array<"disease_claim" | "absolute_guarantee" | "exaggerated_clinical" | "unsubstantiated_efficacy">;
  }
): EvaluationExample {
  return {
    example_id: `eval_10b_${String(idNum).padStart(3, "0")}`,
    channel,
    brand_or_product_name: brand,
    product_id: productId,
    content,
    claims,
    metadata: {
      has_claims: claims.length > 0,
      claim_count: claims.length,
      claim_types: Array.from(new Set(claims.map((c) => c.claim_type))),
      has_ambiguity: metaFlags.has_ambiguity ?? false,
      has_numerical_claim: metaFlags.has_numerical_claim ?? false,
      has_promotional_conditions: metaFlags.has_promotional_conditions ?? false,
      has_high_risk_language: metaFlags.has_high_risk_language ?? false,
      risk_types: metaFlags.risk_types,
    },
    provenance: {
      source_type: "expert_authored",
      curator: "BrandShield Compliance AI Research Group",
      created_at: new Date().toISOString(),
    },
    human_annotation: {
      review_status: "unreviewed",
      reviewer_name: null,
      reviewer_email: null,
      reviewed_at: null,
      review_notes: null,
      change_log: [],
    },
  };
}

// -----------------------------------------------------------------------------
// RAW EVALUATION CORPUS (120 EXAMPLES)
// -----------------------------------------------------------------------------

export function generateRawEvaluationDataset(): EvaluationExample[] {
  const list: EvaluationExample[] = [];
  let id = 1;

  // ===========================================================================
  // GROUP 1: Social Media Advertisements (Instagram, TikTok, UGC Ads) - 20 items
  // ===========================================================================

  // 1. Social Ad - Multi-claim (Price, Product Attribute, Efficacy)
  {
    const text = "POV: You finally tried the viral Vitamin C drops 🍊 Only ₹1,499 for a limited drop! Infused with 12% pure ascorbic acid, you will see reduced dark spots in 14 days. Shop before it sells out!";
    const c1 = buildClaim(text, "Only ₹1,499", "price", { price: 1499, currency: "INR" });
    const c2 = buildClaim(text, "Infused with 12% pure ascorbic acid", "product_attribute", { ingredient: "ascorbic acid", concentration: "12%" });
    const c3 = buildClaim(text, "reduced dark spots in 14 days", "efficacy", { timeline: "14 days" });
    list.push(makeExample(id++, "social_media_ad", "AuraSkin Radiance Drops", "AURA-VITC-12", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 2. Social Ad - Hard Negative (Zero claims, pure aesthetic lifestyle)
  {
    const text = "Sunday morning sunbeams and mindful moments. Taking twenty minutes just for myself, savoring warm tea, and letting my skin breathe. What is your go-to weekend ritual?";
    list.push(makeExample(id++, "social_media_ad", "Botanical Glow Co", null, text, [], {}));
  }

  // 3. Social Ad - Discount & Promotional Conditions
  {
    const text = "FLASH WEEKEND: Grab 40% off everything sitewide! Use code GLOW40 at checkout when you spend ₹2,000 or more. Valid till Sunday midnight.";
    const c1 = buildClaim(text, "40% off everything sitewide", "discount", { discount_percentage: 40 });
    const c2 = buildClaim(text, "when you spend ₹2,000 or more", "promotional", { price: 2000, currency: "INR" });
    const c3 = buildClaim(text, "Valid till Sunday midnight", "promotional", {});
    list.push(makeExample(id++, "social_media_ad", "DermaLuxe Multi-Brand", null, text, [c1, c2, c3], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 4. Social Ad - Comparative & Efficacy
  {
    const text = "Tired of heavy greasy sunscreens? Our UltraSheer fluid provides 2x faster matte dry-down than standard zinc creams while preventing sun-induced pigment deepening.";
    const c1 = buildClaim(text, "provides 2x faster matte dry-down than standard zinc creams", "comparative", { comparison_target: "standard zinc creams" });
    const c2 = buildClaim(text, "preventing sun-induced pigment deepening", "efficacy", {});
    list.push(makeExample(id++, "social_media_ad", "ShieldUltra Sun Fluid", "SHIELD-SPF50", text, [c1, c2], {}));
  }

  // 5. Social Ad - High-Risk Disease Claim & Guarantee
  {
    const text = "Suffering from severe fungal acne? Our sulfur clearing mask is guaranteed to cure all fungal blemishes overnight or 100% money back! Order now.";
    const c1 = buildClaim(text, "guaranteed to cure all fungal blemishes overnight", "guarantee", { timeline: "overnight" });
    const c2 = buildClaim(text, "100% money back", "guarantee", {});
    list.push(makeExample(id++, "social_media_ad", "DermaClear Sulfur Mask", "DC-SULFUR", text, [c1, c2], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 6. Social Ad - Availability & Single Claim
  {
    const text = "The waitlist has reached 10,000 people! Only 300 units remaining in stock for this production run. Grab yours today.";
    const c1 = buildClaim(text, "Only 300 units remaining in stock", "availability", {});
    list.push(makeExample(id++, "social_media_ad", "Velvet Peptide Night Balm", "V-PEPT-01", text, [c1], { has_numerical_claim: true }));
  }

  // 7. Social Ad - Clinical trial reference
  {
    const text = "Formulated with science first. Clinically tested on 45 women under dermatologist supervision with zero reported breakouts over 30 days. Link in bio!";
    const c1 = buildClaim(text, "Clinically tested on 45 women under dermatologist supervision", "clinical", {});
    const c2 = buildClaim(text, "zero reported breakouts over 30 days", "efficacy", { timeline: "30 days" });
    list.push(makeExample(id++, "social_media_ad", "DermaGlow Clarifying Emulsion", "DG-CLAR-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 8. Social Ad - Ambiguous claim (puffery vs fact)
  {
    const text = "Transform your morning mirror with eternal youth in a bottle! Packed with botanical peptides, our serum gives you undeniably healthy-looking bounce.";
    const c1 = buildClaim(text, "Packed with botanical peptides", "product_attribute", { ingredient: "botanical peptides" });
    list.push(makeExample(id++, "social_media_ad", "Verdant Dew Serum", "VD-PEPT-02", text, [c1], { has_ambiguity: true }));
  }

  // 9. Social Ad - Price + Other (Recycled packaging)
  {
    const text = "Skincare that honors the earth 🌍 Priced at ₹899 and housed in 100% post-consumer recycled ocean plastic. Refills start at just ₹699.";
    const c1 = buildClaim(text, "Priced at ₹899", "price", { price: 899, currency: "INR" });
    const c2 = buildClaim(text, "housed in 100% post-consumer recycled ocean plastic", "other", { attribute_name: "packaging", attribute_value: "ocean plastic" });
    const c3 = buildClaim(text, "Refills start at just ₹699", "price", { price: 699, currency: "INR" });
    list.push(makeExample(id++, "social_media_ad", "EcoCleanse Foaming Wash", "ECO-WASH-01", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 10. Social Ad - Hard Negative (Inspirational creator quote)
  {
    const text = "Real skin has pores, texture, and stories. Stop hiding behind blurring filters and start loving the journey. Comment below with your favorite self-love affirmation! 💖";
    list.push(makeExample(id++, "social_media_ad", "GlowUp Movement", null, text, [], {}));
  }

  // 11. Social Ad - Multi-claim dense
  {
    const text = "Big launch! Get ₹300 off our Barrier Rescue Cream (regular price ₹1,299). Contains 5% ceramide complex, scientifically proven to repair barrier integrity in 72 hours.";
    const c1 = buildClaim(text, "Get ₹300 off", "discount", { discount_amount: 300, currency: "INR" });
    const c2 = buildClaim(text, "regular price ₹1,299", "price", { price: 1299, currency: "INR" });
    const c3 = buildClaim(text, "Contains 5% ceramide complex", "product_attribute", { ingredient: "ceramide complex", concentration: "5%" });
    const c4 = buildClaim(text, "scientifically proven to repair barrier integrity in 72 hours", "clinical", { timeline: "72 hours" });
    list.push(makeExample(id++, "social_media_ad", "Barrier Rescue Cream", "BAR-RES-05", text, [c1, c2, c3, c4], { has_numerical_claim: true }));
  }

  // 12. Social Ad - High Risk (prohibited medical assertion)
  {
    const text = "Dermatologists are stunned: our pure herbal ointment completely cures psoriasis lesions within three applications. No prescription needed.";
    const c1 = buildClaim(text, "completely cures psoriasis lesions within three applications", "efficacy", { timeline: "three applications" });
    list.push(makeExample(id++, "social_media_ad", "BioDerma Herbal Salve", "BIO-SALVE-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim"] }));
  }

  // 13. Social Ad - Promotional gift with purchase
  {
    const text = "Valentine's special: Buy any 50ml serum and receive a complimentary jade roller and mini velvet pouch! Offer valid while inventory lasts.";
    const c1 = buildClaim(text, "receive a complimentary jade roller and mini velvet pouch", "promotional", {});
    const c2 = buildClaim(text, "Offer valid while inventory lasts", "availability", {});
    list.push(makeExample(id++, "social_media_ad", "Rose Luxe Hydrator", null, text, [c1, c2], { has_promotional_conditions: true }));
  }

  // 14. Social Ad - Single Efficacy with Ambiguity
  {
    const text = "Say goodbye to dull skin days! Our exfoliating toner significantly brightens skin tone after several uses. Dermatologist recommended.";
    const c1 = buildClaim(text, "significantly brightens skin tone after several uses", "efficacy", {});
    const c2 = buildClaim(text, "Dermatologist recommended", "clinical", {});
    list.push(makeExample(id++, "social_media_ad", "Radiant Glow Toner", "RAD-TON-01", text, [c1, c2], { has_ambiguity: true }));
  }

  // 15. Social Ad - Comparative & Price
  {
    const text = "Why spend ₹5,000 on luxury French serums? Our concentrated Matrixyl drops cost only ₹1,199 and deliver equivalent firming peptide concentration.";
    const c1 = buildClaim(text, "cost only ₹1,199", "price", { price: 1199, currency: "INR" });
    const c2 = buildClaim(text, "deliver equivalent firming peptide concentration", "comparative", {});
    list.push(makeExample(id++, "social_media_ad", "Peptide Matrix Firming", "PEPT-MAT-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 16. Social Ad - Hard Negative (Brand philosophy)
  {
    const text = "Simplicity in every drop. We craft quiet solutions for noisy lives. Take a deep breath and welcome peaceful mornings into your home.";
    list.push(makeExample(id++, "social_media_ad", "Minimalist Botanica", null, text, [], {}));
  }

  // 17. Social Ad - Product Attribute (Vegan, pH)
  {
    const text = "Your barrier will thank you. Formulated at physiological pH 5.2, 100% vegan certified, and completely free of artificial dyes or sulfates.";
    const c1 = buildClaim(text, "Formulated at physiological pH 5.2", "product_attribute", { attribute_name: "pH", attribute_value: "5.2" });
    const c2 = buildClaim(text, "100% vegan certified", "product_attribute", { attribute_name: "vegan", attribute_value: "100%" });
    const c3 = buildClaim(text, "completely free of artificial dyes or sulfates", "product_attribute", {});
    list.push(makeExample(id++, "social_media_ad", "PureCalm Daily Cleanser", "PC-CLEAN-01", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 18. Social Ad - Guarantee with timeline
  {
    const text = "We stand by our formulations. If you do not experience calmer skin within 30 days of daily use, our team will provide a 100% unconditional refund.";
    const c1 = buildClaim(text, "100% unconditional refund", "guarantee", {});
    list.push(makeExample(id++, "social_media_ad", "SootheComplex Relief", "SC-RELIEF", text, [c1], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 19. Social Ad - Availability & Exclusive
  {
    const text = "Back in stock after selling out 4 times! Exclusively available on our official DTC website and select boutique apothecaries.";
    const c1 = buildClaim(text, "Exclusively available on our official DTC website and select boutique apothecaries", "availability", {});
    list.push(makeExample(id++, "social_media_ad", "Midnight Botanical Nectar", "MID-NECTAR-01", text, [c1], {}));
  }

  // 20. Social Ad - Multi-claim with other
  {
    const text = "Certified carbon-neutral logistics on every parcel! Pair that with flat 15% discount on auto-refills and save ₹200 on every shipment.";
    const c1 = buildClaim(text, "Certified carbon-neutral logistics on every parcel", "other", {});
    const c2 = buildClaim(text, "flat 15% discount on auto-refills", "discount", { discount_percentage: 15 });
    const c3 = buildClaim(text, "save ₹200 on every shipment", "discount", { discount_amount: 200, currency: "INR" });
    list.push(makeExample(id++, "social_media_ad", "DermaGreen Eco Serum", null, text, [c1, c2, c3], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // ===========================================================================
  // GROUP 2: Product Landing Pages (Hero Banner, Science Sections) - 20 items
  // ===========================================================================

  // 21. Landing Page - Clinical trial deep dive
  {
    const text = "### Clinically Substantiated Cellular Hydration\nIn an 8-week randomized double-blind clinical study involving 62 participants with transepidermal barrier impairment, DermaGlow Hydration Fluid produced a 91% increase in skin water retention after 14 days of twice-daily application.";
    const c1 = buildClaim(text, "8-week randomized double-blind clinical study involving 62 participants", "clinical", { timeline: "8-week" });
    const c2 = buildClaim(text, "produced a 91% increase in skin water retention after 14 days", "efficacy", { timeline: "14 days" });
    list.push(makeExample(id++, "landing_page", "DermaGlow HydraCellular", "DG-HYDRA-02", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 22. Landing Page - Hard Negative (Brand manifesto)
  {
    const text = "## The Art of Clean Formulation\nWe believe skincare should be an invitation to slow down. When purity meets intentional craftsmanship, your daily routine becomes an elevated ritual of quiet self-care. Welcome to our sanctuary.";
    list.push(makeExample(id++, "landing_page", "Sanctuary Skincare", null, text, [], {}));
  }

  // 23. Landing Page - Ingredient & Pricing section
  {
    const text = "Formulated with 2% Encapsulated Salicylic Acid and 5% Niacinamide to decongest sebum plugs without stripping moisture. Available now for ₹1,199 (inclusive of all taxes).";
    const c1 = buildClaim(text, "Formulated with 2% Encapsulated Salicylic Acid and 5% Niacinamide", "product_attribute", { ingredient: "Salicylic Acid", concentration: "2%" });
    const c2 = buildClaim(text, "Available now for ₹1,199", "price", { price: 1199, currency: "INR" });
    list.push(makeExample(id++, "landing_page", "PoreRefine Serum", "PR-SERUM-02", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 24. Landing Page - Comparative section
  {
    const text = "Why Choose HydraShield?\n- 4x greater antioxidant potency than standard L-ascorbic acid solutions\n- Half the oxidation rate over 6 months\n- Non-sticky dry touch finish";
    const c1 = buildClaim(text, "4x greater antioxidant potency than standard L-ascorbic acid solutions", "comparative", { comparison_target: "standard L-ascorbic acid solutions" });
    const c2 = buildClaim(text, "Half the oxidation rate over 6 months", "comparative", { timeline: "6 months" });
    list.push(makeExample(id++, "landing_page", "HydraShield Antioxidant", "HS-AOX-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 25. Landing Page - Extreme high-risk claim
  {
    const text = "Breakthrough Medical Dermatology Discovery: Clinically guaranteed to eradicate eczema flare-ups permanently in 98% of patients with zero side effects.";
    const c1 = buildClaim(text, "guaranteed to eradicate eczema flare-ups permanently in 98% of patients", "guarantee", {});
    const c2 = buildClaim(text, "zero side effects", "product_attribute", {});
    list.push(makeExample(id++, "landing_page", "EczemaShield Bio-Ointment", "ECZ-SHIELD", text, [c1, c2], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 26. Landing Page - Promotional Bundle & Terms
  {
    const text = "Save 20% when you build a 3-step routine. Free express courier delivery on orders exceeding ₹1,500. Subscription orders receive a complimentary refill pod on their 3rd delivery.";
    const c1 = buildClaim(text, "Save 20% when you build a 3-step routine", "discount", { discount_percentage: 20 });
    const c2 = buildClaim(text, "Free express courier delivery on orders exceeding ₹1,500", "promotional", { price: 1500, currency: "INR" });
    const c3 = buildClaim(text, "receive a complimentary refill pod on their 3rd delivery", "promotional", {});
    list.push(makeExample(id++, "landing_page", "Custom Trio Builder", null, text, [c1, c2, c3], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 27. Landing Page - Product attribute & testing
  {
    const text = "Formulated without parabens, phthalates, synthetic fragrance, or mineral oil. Dermatologist-tested on 100 sensitive-skin volunteers.";
    const c1 = buildClaim(text, "Formulated without parabens, phthalates, synthetic fragrance, or mineral oil", "product_attribute", {});
    const c2 = buildClaim(text, "Dermatologist-tested on 100 sensitive-skin volunteers", "clinical", {});
    list.push(makeExample(id++, "landing_page", "Gentle Barrier Cream", "GB-CREAM-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 28. Landing Page - Ambiguous Efficacy
  {
    const text = "Infused with alpine stem cells to help rejuvenate the look of tired skin and impart an ethereal dewy radiance that turns heads everywhere you walk.";
    const c1 = buildClaim(text, "Infused with alpine stem cells", "product_attribute", { ingredient: "alpine stem cells" });
    list.push(makeExample(id++, "landing_page", "Alpine Glow Elixir", "ALP-GLOW-01", text, [c1], { has_ambiguity: true }));
  }

  // 29. Landing Page - Guarantee with refund policy
  {
    const text = "Our 60-Day Promise: Try our multi-peptide serum risk-free. If your fine lines are not visibly reduced within 60 days, return the empty bottle for a complete refund.";
    const c1 = buildClaim(text, "return the empty bottle for a complete refund", "guarantee", {});
    list.push(makeExample(id++, "landing_page", "AgeDefy Peptide Complex", "AD-PEPT-01", text, [c1], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 30. Landing Page - Multi-attribute and other
  {
    const text = "Manufactured in a certified ISO 22716 cleanroom facility. Every amber glass bottle is nitrogen-purged to guarantee 24 months shelf stability from production.";
    const c1 = buildClaim(text, "Manufactured in a certified ISO 22716 cleanroom facility", "other", {});
    const c2 = buildClaim(text, "nitrogen-purged to guarantee 24 months shelf stability", "other", { timeline: "24 months" });
    list.push(makeExample(id++, "landing_page", "Stabilized Vitamin C", "STAB-VITC-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 31. Landing Page - Hard Negative (Sensory narrative)
  {
    const text = "### Texture That Melts Like Morning Dew\nA weightless veil that honors your skin's rhythm. Designed for quiet evenings and early sunrise rituals, inviting calm reflection into your daily life.";
    list.push(makeExample(id++, "landing_page", "Dewveil Essence", null, text, [], {}));
  }

  // 32. Landing Page - Price and Availability
  {
    const text = "Founders Edition: Only 500 hand-numbered bottles available globally. Standard catalogue price of ₹3,499 with complimentary insured delivery.";
    const c1 = buildClaim(text, "Only 500 hand-numbered bottles available globally", "availability", {});
    const c2 = buildClaim(text, "Standard catalogue price of ₹3,499", "price", { price: 3499, currency: "INR" });
    const c3 = buildClaim(text, "complimentary insured delivery", "promotional", {});
    list.push(makeExample(id++, "landing_page", "Founders Edition Nectar", "FE-NECTAR-01", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 33. Landing Page - Efficacy timeline
  {
    const text = "Clinical evaluations demonstrate a 48% reduction in transepidermal water loss within 2 hours of single application, sustaining barrier comfort for 24 hours.";
    const c1 = buildClaim(text, "48% reduction in transepidermal water loss within 2 hours", "efficacy", { timeline: "2 hours" });
    const c2 = buildClaim(text, "sustaining barrier comfort for 24 hours", "efficacy", { timeline: "24 hours" });
    list.push(makeExample(id++, "landing_page", "Barrier Shield Gel", "BS-GEL-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 34. Landing Page - Comparative absorbency
  {
    const text = "Formulated with sub-micronized hyaluronic acid that penetrates 3 layers deeper than conventional high-molecular weight serums.";
    const c1 = buildClaim(text, "penetrates 3 layers deeper than conventional high-molecular weight serums", "comparative", { comparison_target: "conventional high-molecular weight serums" });
    list.push(makeExample(id++, "landing_page", "DeepHydra Drops", "DH-DROPS-01", text, [c1], { has_numerical_claim: true }));
  }

  // 35. Landing Page - Multi-claim (attribute + efficacy + discount)
  {
    const text = "Features 10% pure Azelaic Acid to diminish post-blemish redness in 3 weeks. Introductory offer: 15% discount for first-time website visitors.";
    const c1 = buildClaim(text, "Features 10% pure Azelaic Acid", "product_attribute", { ingredient: "Azelaic Acid", concentration: "10%" });
    const c2 = buildClaim(text, "diminish post-blemish redness in 3 weeks", "efficacy", { timeline: "3 weeks" });
    const c3 = buildClaim(text, "15% discount for first-time website visitors", "discount", { discount_percentage: 15 });
    list.push(makeExample(id++, "landing_page", "Azelaic Clarifying Treatment", "AZEL-TREAT-01", text, [c1, c2, c3], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 36. Landing Page - High risk disease prevention
  {
    const text = "Formulated with medical-grade colloidal silver that actively destroys all acne-causing bacteria and prevents staph skin infections on contact.";
    const c1 = buildClaim(text, "destroys all acne-causing bacteria and prevents staph skin infections on contact", "efficacy", {});
    list.push(makeExample(id++, "landing_page", "SilverShield Topical Mist", "SS-MIST-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim"] }));
  }

  // 37. Landing Page - Promotional package
  {
    const text = "Bundle and Glow: Includes full-size Hydrating Cleanser, Vitamin C Serum, and Ceramide Cream for ₹2,999 (valued at ₹4,100). Save ₹1,101 instantly.";
    const c1 = buildClaim(text, "for ₹2,999", "price", { price: 2999, currency: "INR" });
    const c2 = buildClaim(text, "valued at ₹4,100", "price", { price: 4100, currency: "INR" });
    const c3 = buildClaim(text, "Save ₹1,101 instantly", "discount", { discount_amount: 1101, currency: "INR" });
    list.push(makeExample(id++, "landing_page", "Daily Glow Trio Kit", "KIT-GLOW-03", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 38. Landing Page - Ambiguous puffery
  {
    const text = "Experience skin so breathtakingly radiant it defies the passage of time. A masterclass in luxury formulation designed to awaken your inner luminescence.";
    list.push(makeExample(id++, "landing_page", "Lumiere Supreme Cream", null, text, [], { has_ambiguity: true }));
  }

  // 39. Landing Page - Clinical trial sample size
  {
    const text = "Evaluated in a clinical trial across 50 Indian women aged 25-50: 96% agreed skin texture felt smoother after 21 days of consecutive nightly application.";
    const c1 = buildClaim(text, "clinical trial across 50 Indian women aged 25-50", "clinical", {});
    const c2 = buildClaim(text, "96% agreed skin texture felt smoother after 21 days", "clinical", { timeline: "21 days" });
    list.push(makeExample(id++, "landing_page", "NightSmooth Retinol", "NS-RET-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 40. Landing Page - Availability constraint
  {
    const text = "Pre-orders open exclusively to registered VIP club members until October 31st. Batch allocation strictly limited to 1,000 jars.";
    const c1 = buildClaim(text, "Pre-orders open exclusively to registered VIP club members until October 31st", "availability", {});
    const c2 = buildClaim(text, "Batch allocation strictly limited to 1,000 jars", "availability", {});
    list.push(makeExample(id++, "landing_page", "VIP Botanical Balm", null, text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // ===========================================================================
  // GROUP 3: E-Commerce Product Descriptions (Amazon PDP, Shopify) - 20 items
  // ===========================================================================

  // 41. E-Commerce PDP - Bullet points (attribute + price)
  {
    const text = "About this item:\n• CONTAINS 10% NIACINAMIDE: Visibly tightens enlarged pores and regulates excess sebum.\n• DERMATOLOGIST FORMULATED: Tested on sensitive skin.\n• SPECIAL PRICE: ₹799 (M.R.P.: ₹999, Save ₹200).";
    const c1 = buildClaim(text, "CONTAINS 10% NIACINAMIDE", "product_attribute", { ingredient: "NIACINAMIDE", concentration: "10%" });
    const c2 = buildClaim(text, "Visibly tightens enlarged pores and regulates excess sebum", "efficacy", {});
    const c3 = buildClaim(text, "Tested on sensitive skin", "clinical", {});
    const c4 = buildClaim(text, "SPECIAL PRICE: ₹799", "price", { price: 799, currency: "INR" });
    const c5 = buildClaim(text, "Save ₹200", "discount", { discount_amount: 200, currency: "INR" });
    list.push(makeExample(id++, "ecommerce_pdp", "PoreControl Niacinamide 10%", "PC-NIAC-10", text, [c1, c2, c3, c4, c5], { has_numerical_claim: true }));
  }

  // 42. E-Commerce PDP - Hard Negative (Aesthetic product story)
  {
    const text = "About our brand:\nRooted in harmony and inspired by ancient botanical balance, our products honor the gentle beauty of nature. Perfect for mindful morning rituals and relaxed evenings at home.";
    list.push(makeExample(id++, "ecommerce_pdp", "Nourish Flora Care", null, text, [], {}));
  }

  // 43. E-Commerce PDP - Comparative claim
  {
    const text = "• CLINICAL COMPARISON: Provides 30% longer hydration than leading hyaluronic acid moisturizers without leaving a greasy sheen.";
    const c1 = buildClaim(text, "Provides 30% longer hydration than leading hyaluronic acid moisturizers", "comparative", { comparison_target: "leading hyaluronic acid moisturizers" });
    list.push(makeExample(id++, "ecommerce_pdp", "HydraCloud Gel", "HC-GEL-01", text, [c1], { has_numerical_claim: true }));
  }

  // 44. E-Commerce PDP - Multi-claim guarantee
  {
    const text = "• RISK-FREE PURCHASE: Comes with a 30-day money-back guarantee. If you are not completely satisfied, return the unused portion for 100% refund.";
    const c1 = buildClaim(text, "30-day money-back guarantee", "guarantee", { timeline: "30-day" });
    const c2 = buildClaim(text, "100% refund", "guarantee", {});
    list.push(makeExample(id++, "ecommerce_pdp", "UltraTone Face Wash", "UT-WASH-01", text, [c1, c2], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 45. E-Commerce PDP - Product attribute (Certification & Ingredients)
  {
    const text = "• CERTIFIED VEGAN: PETA approved cruelty-free.\n• ACTIVE INGREDIENTS: 2% Bakuchiol plant-derived alternative and 1% cold-pressed Rosehip Seed Oil.\n• FRAGRANCE-FREE: Zero essential oils.";
    const c1 = buildClaim(text, "PETA approved cruelty-free", "product_attribute", {});
    const c2 = buildClaim(text, "2% Bakuchiol plant-derived alternative and 1% cold-pressed Rosehip Seed Oil", "product_attribute", { ingredient: "Bakuchiol", concentration: "2%" });
    const c3 = buildClaim(text, "Zero essential oils", "product_attribute", {});
    list.push(makeExample(id++, "ecommerce_pdp", "PhytoBakuchiol Smoothing Oil", "PB-OIL-02", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 46. E-Commerce PDP - High risk disease assertion
  {
    const text = "• CLINICAL STRENGTH: Completely cures rosacea redness and permanent vascular flushing within 14 days of application.";
    const c1 = buildClaim(text, "Completely cures rosacea redness and permanent vascular flushing within 14 days", "efficacy", { timeline: "14 days" });
    list.push(makeExample(id++, "ecommerce_pdp", "RosaceaCalm Therapy", "RC-THERAPY-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim"] }));
  }

  // 47. E-Commerce PDP - Shipping & promotional perks
  {
    const text = "• PRIME ELIGIBLE: Free one-day shipping for Amazon Prime members.\n• COMES WITH 2 FREE SAMPLES: Includes trial satchels of our Brightening Serum and Peptide Eye Gel.";
    const c1 = buildClaim(text, "Free one-day shipping for Amazon Prime members", "promotional", {});
    const c2 = buildClaim(text, "Includes trial satchels of our Brightening Serum and Peptide Eye Gel", "promotional", {});
    list.push(makeExample(id++, "ecommerce_pdp", "DermaHydra Moisture Kit", null, text, [c1, c2], { has_promotional_conditions: true }));
  }

  // 48. E-Commerce PDP - Ambiguous efficacy
  {
    const text = "• YOUTHFUL GLOW: Imparts a radiant luminosity that makes skin look noticeably revitalized and effortlessly fresh.";
    const c1 = buildClaim(text, "makes skin look noticeably revitalized and effortlessly fresh", "efficacy", {});
    list.push(makeExample(id++, "ecommerce_pdp", "Luminous Dew Fluid", "LD-FLUID-01", text, [c1], { has_ambiguity: true }));
  }

  // 49. E-Commerce PDP - Price and availability
  {
    const text = "• LIMITED BATCH: Only 250 units allocated for online purchase.\n• M.R.P.: ₹1,850 per 50ml bottle.\n• 100% Made in India under WHO-GMP compliance.";
    const c1 = buildClaim(text, "Only 250 units allocated for online purchase", "availability", {});
    const c2 = buildClaim(text, "M.R.P.: ₹1,850", "price", { price: 1850, currency: "INR" });
    const c3 = buildClaim(text, "100% Made in India under WHO-GMP compliance", "other", {});
    list.push(makeExample(id++, "ecommerce_pdp", "Artisan Herbal Elixir", "ART-ELIXIR-01", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 50. E-Commerce PDP - Efficacy timeline
  {
    const text = "• VISIBLE RESULTS: Clinically demonstrated to reduce hyperpigmentation spots in 4 weeks and improve skin elasticity by 22% in 8 weeks.";
    const c1 = buildClaim(text, "reduce hyperpigmentation spots in 4 weeks", "efficacy", { timeline: "4 weeks" });
    const c2 = buildClaim(text, "improve skin elasticity by 22% in 8 weeks", "efficacy", { timeline: "8 weeks" });
    list.push(makeExample(id++, "ecommerce_pdp", "FirmGlow Night Concentrate", "FG-NIGHT-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 51. E-Commerce PDP - Hard Negative (User instructions)
  {
    const text = "Directions for use: Warm two to three drops between your palms. Gently press onto cleansed face and neck every evening. Store in a cool dry place away from direct sunlight.";
    list.push(makeExample(id++, "ecommerce_pdp", "Pure Squalane Oil", null, text, [], {}));
  }

  // 52. E-Commerce PDP - Comparative claim (absorption)
  {
    const text = "• ABSORPTION: Absorbs 50% faster than traditional mineral oil formulations without clogging pores or staining pillowcases.";
    const c1 = buildClaim(text, "Absorbs 50% faster than traditional mineral oil formulations", "comparative", { comparison_target: "traditional mineral oil formulations" });
    list.push(makeExample(id++, "ecommerce_pdp", "DryTouch Squalane", "DT-SQUAL-01", text, [c1], { has_numerical_claim: true }));
  }

  // 53. E-Commerce PDP - Clinical allergy testing
  {
    const text = "• HYPOALLERGENIC: Clinically patch-tested on 120 individuals with zero allergic sensitization reactions observed.";
    const c1 = buildClaim(text, "Clinically patch-tested on 120 individuals with zero allergic sensitization reactions observed", "clinical", {});
    list.push(makeExample(id++, "ecommerce_pdp", "BarrierComfort Lotion", "BC-LOTION-01", text, [c1], { has_numerical_claim: true }));
  }

  // 54. E-Commerce PDP - Discount & Coupon
  {
    const text = "• SAVINGS: Save ₹150 with Amazon coupon applied at checkout. Subscribe & Save customers get an extra 10% discount on monthly refills.";
    const c1 = buildClaim(text, "Save ₹150 with Amazon coupon", "discount", { discount_amount: 150, currency: "INR" });
    const c2 = buildClaim(text, "extra 10% discount on monthly refills", "discount", { discount_percentage: 10 });
    list.push(makeExample(id++, "ecommerce_pdp", "Daily C-Booster", "DC-BOOST-01", text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 55. E-Commerce PDP - High risk absolute assertion
  {
    const text = "• ABSOLUTE GUARANTEE: Eliminates 100% of fine lines and deep wrinkles within 7 days, guaranteed or your money back.";
    const c1 = buildClaim(text, "Eliminates 100% of fine lines and deep wrinkles within 7 days", "efficacy", { timeline: "7 days" });
    const c2 = buildClaim(text, "guaranteed or your money back", "guarantee", {});
    list.push(makeExample(id++, "ecommerce_pdp", "WrinkleErase Miracle Serum", "WE-MIRACLE", text, [c1, c2], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 56. E-Commerce PDP - Packaging and eco attribute
  {
    const text = "• SUSTAINABLE PACKAGING: Bottle made from 100% recyclable glass. Dropper bulb crafted with natural rubber.";
    const c1 = buildClaim(text, "Bottle made from 100% recyclable glass", "other", { attribute_name: "packaging", attribute_value: "recyclable glass" });
    const c2 = buildClaim(text, "Dropper bulb crafted with natural rubber", "product_attribute", {});
    list.push(makeExample(id++, "ecommerce_pdp", "EcoEssence Facial Nectar", "EE-NECTAR-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 57. E-Commerce PDP - Multi-claim attribute & availability
  {
    const text = "• INGREDIENT SPOTLIGHT: Contains 15% Ethyl Ascorbic Acid.\n• LIMITED AVAILABILITY: Only available during the festive Diwali sale.";
    const c1 = buildClaim(text, "Contains 15% Ethyl Ascorbic Acid", "product_attribute", { ingredient: "Ethyl Ascorbic Acid", concentration: "15%" });
    const c2 = buildClaim(text, "Only available during the festive Diwali sale", "availability", {});
    list.push(makeExample(id++, "ecommerce_pdp", "Diwali Edition Vitamin C", "DW-VITC-15", text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 58. E-Commerce PDP - Ambiguous product attribute
  {
    const text = "• BOTANICAL ESSENCE: Infused with rare wild mountain herbs known to impart gentle revitalizing vitality.";
    const c1 = buildClaim(text, "Infused with rare wild mountain herbs", "product_attribute", { ingredient: "wild mountain herbs" });
    list.push(makeExample(id++, "ecommerce_pdp", "WildHerb Calming Drops", "WH-CALM-01", text, [c1], { has_ambiguity: true }));
  }

  // 59. E-Commerce PDP - Price and unit
  {
    const text = "• VALUE PACK: 100ml Jumbo Size for only ₹1,699 (equivalent to ₹17 per ml, saves 35% compared to two 50ml bottles).";
    const c1 = buildClaim(text, "100ml Jumbo Size for only ₹1,699", "price", { price: 1699, currency: "INR" });
    const c2 = buildClaim(text, "saves 35% compared to two 50ml bottles", "discount", { discount_percentage: 35 });
    list.push(makeExample(id++, "ecommerce_pdp", "Jumbo Ceramide Cream", "JUMBO-CERAM", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 60. E-Commerce PDP - Clinical study confirmation
  {
    const text = "• VALIDATED BY INDEPENDENT LAB: Instrumental transepidermal water loss measurements showed 38% barrier strengthening after 28 days.";
    const c1 = buildClaim(text, "Instrumental transepidermal water loss measurements showed 38% barrier strengthening after 28 days", "clinical", { timeline: "28 days" });
    list.push(makeExample(id++, "ecommerce_pdp", "BarrierFortify Fluid", "BF-FLUID-01", text, [c1], { has_numerical_claim: true }));
  }

  // ===========================================================================
  // GROUP 4: Email Promotions (VIP Newsletters, Flash Sale, Recovery) - 20 items
  // ===========================================================================

  // 61. Email Promotion - Flash discount with coupon code
  {
    const text = "Subject: ⚡ 24-HOUR FLASH SALE: Save 30% Today!\n\nDear VIP Glow Member,\nFor the next 24 hours only, take 30% off our best-selling Niacinamide Serum using promo code FLASH30. Plus, all orders over ₹999 receive free domestic shipping!";
    const c1 = buildClaim(text, "take 30% off our best-selling Niacinamide Serum", "discount", { discount_percentage: 30 });
    const c2 = buildClaim(text, "all orders over ₹999 receive free domestic shipping", "promotional", { price: 999, currency: "INR" });
    list.push(makeExample(id++, "email_promotion", "DermaGlow VIP Email", "DG-NIAC-01", text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 62. Email Promotion - Hard Negative (Inspirational holiday letter)
  {
    const text = "Subject: Wishing you peaceful moments this season 🌿\n\nDear Friend,\nAs the year winds down, we invite you to pause and celebrate the quiet transformations you have nurtured. Thank you for walking this mindful skincare path with us.";
    list.push(makeExample(id++, "email_promotion", "Aura Botanical Brand", null, text, [], {}));
  }

  // 63. Email Promotion - Multi-claim price + efficacy + guarantee
  {
    const text = "Subject: Meet the new Peptide Eye Contour Serum\n\nFormulated with 3% Matrixyl Synthe-6 and Caffeine, our new eye serum visibly depuffs undereye bags in 15 minutes. Priced at an introductory ₹849. Supported by our 100% satisfaction guarantee.";
    const c1 = buildClaim(text, "Formulated with 3% Matrixyl Synthe-6 and Caffeine", "product_attribute", { ingredient: "Matrixyl Synthe-6", concentration: "3%" });
    const c2 = buildClaim(text, "visibly depuffs undereye bags in 15 minutes", "efficacy", { timeline: "15 minutes" });
    const c3 = buildClaim(text, "introductory ₹849", "price", { price: 849, currency: "INR" });
    const c4 = buildClaim(text, "100% satisfaction guarantee", "guarantee", {});
    list.push(makeExample(id++, "email_promotion", "Peptide Eye Contour", "EYE-PEPT-03", text, [c1, c2, c3, c4], { has_numerical_claim: true }));
  }

  // 64. Email Promotion - Availability & limited stock
  {
    const text = "Subject: Almost Gone! Only 75 bottles left...\n\nOur seasonal Rosehip Harvest Oil is nearly depleted. Only 75 bottles remain in our fulfillment warehouse. Restock is not planned until next spring.";
    const c1 = buildClaim(text, "Only 75 bottles remain in our fulfillment warehouse", "availability", {});
    list.push(makeExample(id++, "email_promotion", "Rosehip Harvest Oil", "RH-HARVEST-01", text, [c1], { has_numerical_claim: true }));
  }

  // 65. Email Promotion - High risk medical promise
  {
    const text = "Subject: Discover the miracle cure for adult dermatitis\n\nOur botanical dermal therapy stops chronic itching instantly and permanently eradicates dermatitis lesions within 7 days, guaranteed.";
    const c1 = buildClaim(text, "permanently eradicates dermatitis lesions within 7 days", "efficacy", { timeline: "7 days" });
    const c2 = buildClaim(text, "guaranteed", "guarantee", {});
    list.push(makeExample(id++, "email_promotion", "DermalRelief Therapy", "DR-THERAPY", text, [c1, c2], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 66. Email Promotion - Abandoned cart incentive
  {
    const text = "Subject: Did you forget something? Here is ₹250 off!\n\nYour shopping bag is waiting for you. Complete your purchase today with code COMEBACK250 to receive ₹250 off orders above ₹1,200.";
    const c1 = buildClaim(text, "receive ₹250 off orders above ₹1,200", "discount", { discount_amount: 250, currency: "INR" });
    list.push(makeExample(id++, "email_promotion", "Shopping Cart Recovery", null, text, [c1], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 67. Email Promotion - Clinical study showcase
  {
    const text = "Subject: The Science Behind Our Retinol Booster\n\nIn our latest clinical trial with 55 participants over 12 weeks, instrumental dermatological scans recorded a 34% reduction in wrinkle depth with zero peeling.";
    const c1 = buildClaim(text, "clinical trial with 55 participants over 12 weeks", "clinical", { timeline: "12 weeks" });
    const c2 = buildClaim(text, "34% reduction in wrinkle depth", "efficacy", {});
    list.push(makeExample(id++, "email_promotion", "PureRetinol 0.5%", "RET-BOOST-05", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 68. Email Promotion - Comparative claim
  {
    const text = "Subject: Outperforming traditional vitamin C serums\n\nIndependent testing confirms our stabilized formula delivers 2.5x greater cellular penetration than conventional water-based L-ascorbic acid.";
    const c1 = buildClaim(text, "delivers 2.5x greater cellular penetration than conventional water-based L-ascorbic acid", "comparative", { comparison_target: "conventional water-based L-ascorbic acid" });
    list.push(makeExample(id++, "email_promotion", "Ascorbic Stable Serum", "ASC-STABLE-01", text, [c1], { has_numerical_claim: true }));
  }

  // 69. Email Promotion - Ambiguous promotional claim
  {
    const text = "Subject: Unlock your ultimate festive glow ✨\n\nIndulge in our exquisite skincare bundles crafted to bestow pure celestial radiance upon your skin this celebratory weekend.";
    list.push(makeExample(id++, "email_promotion", "Festive Radiance Kit", null, text, [], { has_ambiguity: true }));
  }

  // 70. Email Promotion - Gift with Purchase
  {
    const text = "Subject: Free Deluxe Travel Cleanser on all orders today!\n\nCelebrate our brand anniversary with us. Every order placed before midnight will receive a complimentary 30ml Travel Cleanser worth ₹350.";
    const c1 = buildClaim(text, "receive a complimentary 30ml Travel Cleanser worth ₹350", "promotional", { price: 350, currency: "INR" });
    list.push(makeExample(id++, "email_promotion", "Anniversary Promotion", null, text, [c1], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 71. Email Promotion - Hard Negative (Community thank you)
  {
    const text = "Subject: A quiet thank you from our founders\n\nDear Community,\nEvery kind word, every shared bathroom mirror selfie, and every thoughtful review inspires our formulation team daily. Here is to celebrating authentic beauty.";
    list.push(makeExample(id++, "email_promotion", "Founder Letter", null, text, [], {}));
  }

  // 72. Email Promotion - Product Attribute & Packaging
  {
    const text = "Subject: Sustainable refills have arrived 🌿\n\nOur iconic Barrier Cream is now available in 100% biodegradable aluminium refill cartridges. Reduce plastic waste by 85% while keeping your skin calm.";
    const c1 = buildClaim(text, "available in 100% biodegradable aluminium refill cartridges", "other", {});
    const c2 = buildClaim(text, "Reduce plastic waste by 85%", "other", {});
    list.push(makeExample(id++, "email_promotion", "Barrier Cream Refill", "BC-REFILL-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 73. Email Promotion - Price, discount and timeline
  {
    const text = "Subject: VIP Exclusive: Get ₹500 off the Peptide Renewal System\n\nRegularly priced at ₹2,499, unlock yours today for only ₹1,999. Clinically tested to improve skin firmness in 28 days.";
    const c1 = buildClaim(text, "Get ₹500 off", "discount", { discount_amount: 500, currency: "INR" });
    const c2 = buildClaim(text, "Regularly priced at ₹2,499", "price", { price: 2499, currency: "INR" });
    const c3 = buildClaim(text, "unlock yours today for only ₹1,999", "price", { price: 1999, currency: "INR" });
    const c4 = buildClaim(text, "improve skin firmness in 28 days", "efficacy", { timeline: "28 days" });
    list.push(makeExample(id++, "email_promotion", "Peptide Renewal System", "PEPT-REN-SYS", text, [c1, c2, c3, c4], { has_numerical_claim: true }));
  }

  // 74. Email Promotion - Guarantee terms
  {
    const text = "Subject: Zero risk: Our 45-day trial period\n\nNot sure if our Calming Mist is right for your sensitive skin? Enjoy our 45-day home trial with free returns and full refund if not completely delighted.";
    const c1 = buildClaim(text, "45-day home trial with free returns and full refund", "guarantee", { timeline: "45-day" });
    list.push(makeExample(id++, "email_promotion", "Calming Mist Trial", "CM-TRIAL-45", text, [c1], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 75. Email Promotion - Comparative absorbency
  {
    const text = "Subject: Discover faster absorbing hydration\n\nFormulated with triple-molecular hyaluronic acid, our formula absorbs twice as fast as single-weight hyaluronic serums.";
    const c1 = buildClaim(text, "absorbs twice as fast as single-weight hyaluronic serums", "comparative", { comparison_target: "single-weight hyaluronic serums" });
    list.push(makeExample(id++, "email_promotion", "TripleHydra Drops", "TH-DROPS-01", text, [c1], {}));
  }

  // 76. Email Promotion - Availability limitation
  {
    const text = "Subject: Final call for Autumn harvest oils\n\nOur botanical oil harvest is restricted to only 400 numbered units this season. Less than 50 units remain.";
    const c1 = buildClaim(text, "restricted to only 400 numbered units this season", "availability", {});
    const c2 = buildClaim(text, "Less than 50 units remain", "availability", {});
    list.push(makeExample(id++, "email_promotion", "Autumn Harvest Oil", "AH-OIL-400", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 77. Email Promotion - High risk disease prevention
  {
    const text = "Subject: Protect your skin against viral cellular infection\n\nOur revolutionary zinc copper complex is clinically proven to prevent 99.9% of viral and bacterial dermal infections upon topical contact.";
    const c1 = buildClaim(text, "proven to prevent 99.9% of viral and bacterial dermal infections upon topical contact", "efficacy", {});
    list.push(makeExample(id++, "email_promotion", "BioShield Complex", "BIO-SHIELD-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim"] }));
  }

  // 78. Email Promotion - Product attribute (Vegan & clean)
  {
    const text = "Subject: Clean skincare without compromise\n\nEvery formulation is 100% vegan, cruelty-free, and certified free of parabens, formaldehyde donors, and artificial fragrances.";
    const c1 = buildClaim(text, "100% vegan, cruelty-free", "product_attribute", {});
    const c2 = buildClaim(text, "certified free of parabens, formaldehyde donors, and artificial fragrances", "product_attribute", {});
    list.push(makeExample(id++, "email_promotion", "CleanCore Philosophy", null, text, [c1, c2], {}));
  }

  // 79. Email Promotion - Promotional loyalty perks
  {
    const text = "Subject: Double Glow Points Weekend ✨\n\nEarn 2x reward points on all purchases this weekend! Redeem 500 points for an instant ₹250 voucher on your next order.";
    const c1 = buildClaim(text, "Earn 2x reward points on all purchases this weekend", "promotional", {});
    const c2 = buildClaim(text, "Redeem 500 points for an instant ₹250 voucher", "discount", { discount_amount: 250, currency: "INR" });
    list.push(makeExample(id++, "email_promotion", "Loyalty Rewards", null, text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 80. Email Promotion - Ambiguous revitalizing claim
  {
    const text = "Subject: Awaken tired morning skin\n\nA magical splash of botanical refreshment that instantly energizes dull complexions with youthful radiance.";
    const c1 = buildClaim(text, "instantly energizes dull complexions with youthful radiance", "efficacy", {});
    list.push(makeExample(id++, "email_promotion", "Morning Awakening Splash", "MAS-01", text, [c1], { has_ambiguity: true }));
  }

  // ===========================================================================
  // GROUP 5: Packaging Copy (Cartons, Tubes, Bottle Directions) - 20 items
  // ===========================================================================

  // 81. Packaging - Carton Specification (Attribute + Concentration + Volume)
  {
    const text = "DERMAGLOW ADVANCED LABS\n10% VITAMIN C RADIANCE BOOSTER\nNet Volume: 30 ml (1.01 fl. oz.)\nActive Ingredients: 10% Ethyl Ascorbic Acid, 0.5% Ferulic Acid.\npH 3.8 ± 0.2. Store below 25°C.";
    const c1 = buildClaim(text, "10% Ethyl Ascorbic Acid, 0.5% Ferulic Acid", "product_attribute", { ingredient: "Ethyl Ascorbic Acid", concentration: "10%" });
    const c2 = buildClaim(text, "pH 3.8 ± 0.2", "product_attribute", { attribute_name: "pH", attribute_value: "3.8" });
    list.push(makeExample(id++, "packaging", "DermaGlow Vitamin C", "DG-VITC-10", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 82. Packaging - Hard Negative (Warning & recycling instructions)
  {
    const text = "CAUTION: For external topical application only. Avoid direct contact with eyes. Discontinue use if irritation occurs. Rinse thoroughly with water if contact occurs. Keep out of reach of children.";
    list.push(makeExample(id++, "packaging", "Topical Warning Label", null, text, [], {}));
  }

  // 83. Packaging - Clinical claim on box
  {
    const text = "Dermatologically tested on sensitive skin in an independent 4-week clinical study. Formulated to minimize allergen risks. Hypoallergenic.";
    const c1 = buildClaim(text, "Dermatologically tested on sensitive skin in an independent 4-week clinical study", "clinical", { timeline: "4-week" });
    const c2 = buildClaim(text, "Hypoallergenic", "product_attribute", {});
    list.push(makeExample(id++, "packaging", "Sensitive Barrier Lotion", "SB-LOTION-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 84. Packaging - Carton price and MRP
  {
    const text = "M.R.P. ₹1,499.00 (inclusive of all taxes)\nBatch No: DG-2026-B8\nMfg Date: 01/2026\nExpiry: 24 months from manufacturing date.";
    const c1 = buildClaim(text, "M.R.P. ₹1,499.00", "price", { price: 1499, currency: "INR" });
    const c2 = buildClaim(text, "Expiry: 24 months from manufacturing date", "other", { timeline: "24 months" });
    list.push(makeExample(id++, "packaging", "Price & Batch Label", null, text, [c1, c2], { has_numerical_claim: true }));
  }

  // 85. Packaging - High risk medical cure claim on packaging
  {
    const text = "THERAPEUTIC CLAIM: Clinically indicated to cure chronic atopic eczema and eliminate dermal fungal infections permanently.";
    const c1 = buildClaim(text, "Clinically indicated to cure chronic atopic eczema and eliminate dermal fungal infections permanently", "efficacy", {});
    list.push(makeExample(id++, "packaging", "BioMed Atopic Ointment", "BM-ATOPIC-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim"] }));
  }

  // 86. Packaging - Guarantee on back of bottle
  {
    const text = "Backed by the DermaLuxe 100% money-back guarantee. If not satisfied after 30 days of continuous application, contact support for full refund.";
    const c1 = buildClaim(text, "100% money-back guarantee", "guarantee", {});
    const c2 = buildClaim(text, "full refund", "guarantee", {});
    list.push(makeExample(id++, "packaging", "DermaLuxe Night Cream", "DL-NIGHT-01", text, [c1, c2], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 87. Packaging - Comparative claim on tube
  {
    const text = "Provides 2x more broad-spectrum UVA protection than standard SPF 30 sunscreens. Water resistant for 80 minutes.";
    const c1 = buildClaim(text, "Provides 2x more broad-spectrum UVA protection than standard SPF 30 sunscreens", "comparative", { comparison_target: "standard SPF 30 sunscreens" });
    const c2 = buildClaim(text, "Water resistant for 80 minutes", "efficacy", { timeline: "80 minutes" });
    list.push(makeExample(id++, "packaging", "Mineral Shield SPF 50", "MS-SPF50-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 88. Packaging - Formulation certification
  {
    const text = "ECOCERT GREENLIFE CERTIFIED: 99.2% of total ingredients are from natural origin. 24% of total ingredients are from organic farming.";
    const c1 = buildClaim(text, "ECOCERT GREENLIFE CERTIFIED", "other", {});
    const c2 = buildClaim(text, "99.2% of total ingredients are from natural origin", "product_attribute", { concentration: "99.2%" });
    const c3 = buildClaim(text, "24% of total ingredients are from organic farming", "product_attribute", { concentration: "24%" });
    list.push(makeExample(id++, "packaging", "EcoCertified Day Emulsion", "ECO-DAY-01", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 89. Packaging - Ambiguous efficacy claim on box
  {
    const text = "Awakens the skin's natural luminous aura with subtle optical radiance diffusers for an instant camera-ready finish.";
    const c1 = buildClaim(text, "Awakens the skin's natural luminous aura with subtle optical radiance diffusers", "efficacy", {});
    list.push(makeExample(id++, "packaging", "Radiance Primer Fluid", "RAD-PRIMER-01", text, [c1], { has_ambiguity: true }));
  }

  // 90. Packaging - Hard Negative (Storage and directions)
  {
    const text = "APPLICATION: Apply 2 pumps onto clean fingertips. Smooth gently over face and neck in upward circular motions every morning before sun protection.";
    list.push(makeExample(id++, "packaging", "Directions Label", null, text, [], {}));
  }

  // 91. Packaging - Multi-claim active concentrations
  {
    const text = "CONTAINS: 5% Niacinamide, 1% Zinc PCA, and 0.2% Hyaluronic Acid. Free of mineral oils, silicones, and parabens.";
    const c1 = buildClaim(text, "5% Niacinamide, 1% Zinc PCA, and 0.2% Hyaluronic Acid", "product_attribute", { ingredient: "Niacinamide", concentration: "5%" });
    const c2 = buildClaim(text, "Free of mineral oils, silicones, and parabens", "product_attribute", {});
    list.push(makeExample(id++, "packaging", "Niacinamide Clarifying Fluid", "NC-FLUID-05", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 92. Packaging - Availability on carton
  {
    const text = "EXCLUSIVELY DISTRIBUTED through licensed dermatologists and registered clinical aesthetic centers.";
    const c1 = buildClaim(text, "EXCLUSIVELY DISTRIBUTED through licensed dermatologists and registered clinical aesthetic centers", "availability", {});
    list.push(makeExample(id++, "packaging", "DermaClinical Rx Gel", "DCRX-GEL", text, [c1], {}));
  }

  // 93. Packaging - Efficacy timeline claim
  {
    const text = "Instrumentally proven to increase skin surface hydration by 65% within 1 hour, maintaining hydration for up to 48 hours.";
    const c1 = buildClaim(text, "increase skin surface hydration by 65% within 1 hour", "efficacy", { timeline: "1 hour" });
    const c2 = buildClaim(text, "maintaining hydration for up to 48 hours", "efficacy", { timeline: "48 hours" });
    list.push(makeExample(id++, "packaging", "MoistureLock Cream Tube", "ML-TUBE-48", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 94. Packaging - Promotional trial claim on carton
  {
    const text = "SPECIAL PROMOTIONAL PACK: Contains bonus 15ml trial tube inside carton. Free travel sample included.";
    const c1 = buildClaim(text, "Contains bonus 15ml trial tube inside carton", "promotional", {});
    const c2 = buildClaim(text, "Free travel sample included", "promotional", {});
    list.push(makeExample(id++, "packaging", "Promotional Pack Duo", null, text, [c1, c2], { has_promotional_conditions: true }));
  }

  // 95. Packaging - High risk absolute claim
  {
    const text = "GUARANTEED to eradicate 100% of bacterial pathogens on skin contact within 30 seconds.";
    const c1 = buildClaim(text, "GUARANTEED to eradicate 100% of bacterial pathogens on skin contact within 30 seconds", "guarantee", { timeline: "30 seconds" });
    list.push(makeExample(id++, "packaging", "Antiseptic Dermal Cleanser", "ANTI-CLEAN-01", text, [c1], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 96. Packaging - Packaging material certification
  {
    const text = "BOTTLE: 100% PCR (Post-Consumer Resin) plastic. CARTON: Printed with biodegradable vegetable ink on FSC-certified sustainable cardboard.";
    const c1 = buildClaim(text, "BOTTLE: 100% PCR (Post-Consumer Resin) plastic", "other", { attribute_name: "packaging", attribute_value: "PCR plastic" });
    const c2 = buildClaim(text, "FSC-certified sustainable cardboard", "other", {});
    list.push(makeExample(id++, "packaging", "EcoCarton Specification", null, text, [c1, c2], { has_numerical_claim: true }));
  }

  // 97. Packaging - Retinol concentration and stability
  {
    const text = "Contains 0.3% Pure Micro-Encapsulated Retinol. Micro-encapsulation ensures 3x greater molecule stability against light degradation.";
    const c1 = buildClaim(text, "Contains 0.3% Pure Micro-Encapsulated Retinol", "product_attribute", { ingredient: "Retinol", concentration: "0.3%" });
    const c2 = buildClaim(text, "3x greater molecule stability against light degradation", "comparative", {});
    list.push(makeExample(id++, "packaging", "MicroRetinol Night Serum", "MR-NIGHT-03", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 98. Packaging - Ambiguous calming claim
  {
    const text = "Formulated with calming botanical whispers to bestow serenity upon sensitized stressed skin.";
    list.push(makeExample(id++, "packaging", "Serenity Calming Mist", null, text, [], { has_ambiguity: true }));
  }

  // 99. Packaging - Price per volume
  {
    const text = "Retail Price: ₹2,100 (₹70.00 per ml). Made in a GMP-certified laboratory in Baddi, Himachal Pradesh.";
    const c1 = buildClaim(text, "Retail Price: ₹2,100", "price", { price: 2100, currency: "INR" });
    const c2 = buildClaim(text, "Made in a GMP-certified laboratory", "other", {});
    list.push(makeExample(id++, "packaging", "GMP Certified Serum", "GMP-SERUM-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 100. Packaging - Clinical test on bottle back
  {
    const text = "Clinically evaluated under dermatological and ophthalmological control. Safe for contact lens wearers.";
    const c1 = buildClaim(text, "Clinically evaluated under dermatological and ophthalmological control", "clinical", {});
    const c2 = buildClaim(text, "Safe for contact lens wearers", "product_attribute", {});
    list.push(makeExample(id++, "packaging", "Gentle Eye Makeup Remover", "EYE-REM-01", text, [c1, c2], {}));
  }

  // ===========================================================================
  // GROUP 6: Search Advertisements (Google Sponsored Ads) - 20 items
  // ===========================================================================

  // 101. Search Ad - Headline + Description (Price + Clinical)
  {
    const text = "Official DermaGlow Vitamin C | Clinically Proven Brightening\nShop our award-winning 10% Vitamin C Serum for only ₹1,499. Proven to reduce dark spots in 14 days. Free shipping on all orders over ₹999.";
    const c1 = buildClaim(text, "10% Vitamin C Serum", "product_attribute", { ingredient: "Vitamin C", concentration: "10%" });
    const c2 = buildClaim(text, "only ₹1,499", "price", { price: 1499, currency: "INR" });
    const c3 = buildClaim(text, "reduce dark spots in 14 days", "efficacy", { timeline: "14 days" });
    const c4 = buildClaim(text, "Free shipping on all orders over ₹999", "promotional", { price: 999, currency: "INR" });
    list.push(makeExample(id++, "search_ad", "DermaGlow Vitamin C Ad", "DG-VITC-10", text, [c1, c2, c3, c4], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 102. Search Ad - Hard Negative (Pure lifestyle headline)
  {
    const text = "Mindful Skincare Rituals | Embrace Your Natural Radiance\nCelebrate healthy-looking skin with gentle botanical balance. Explore our mindful collection online today.";
    list.push(makeExample(id++, "search_ad", "Mindful Skin Ad", null, text, [], {}));
  }

  // 103. Search Ad - Discount and promo code
  {
    const text = "Flat 25% Off Sitewide | DermaLuxe Weekend Skincare Sale\nUse code LUXE25 at checkout to save 25% on all dermatological serums. Free samples with every order.";
    const c1 = buildClaim(text, "Flat 25% Off Sitewide", "discount", { discount_percentage: 25 });
    const c2 = buildClaim(text, "save 25% on all dermatological serums", "discount", { discount_percentage: 25 });
    const c3 = buildClaim(text, "Free samples with every order", "promotional", {});
    list.push(makeExample(id++, "search_ad", "DermaLuxe Search Ad", null, text, [c1, c2, c3], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  // 104. Search Ad - Comparative claim in headline
  {
    const text = "3x Faster Barrier Repair | Ceramides + Squalane Formula\nOutperforms standard moisturizers in 24-hour hydration tests. Clinically tested for compromised skin barriers. Buy online now.";
    const c1 = buildClaim(text, "3x Faster Barrier Repair", "comparative", {});
    const c2 = buildClaim(text, "Outperforms standard moisturizers in 24-hour hydration tests", "comparative", { comparison_target: "standard moisturizers" });
    list.push(makeExample(id++, "search_ad", "Ceramide Squalane Ad", "CS-BARRIER-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 105. Search Ad - High risk cure claim in headline
  {
    const text = "Guaranteed Eczema Cure | Permanent Relief in 7 Days\nOur herbal therapy is guaranteed to cure severe chronic eczema overnight or 100% money back. Order today.";
    const c1 = buildClaim(text, "Guaranteed Eczema Cure", "guarantee", {});
    const c2 = buildClaim(text, "guaranteed to cure severe chronic eczema overnight", "guarantee", { timeline: "overnight" });
    const c3 = buildClaim(text, "100% money back", "guarantee", {});
    list.push(makeExample(id++, "search_ad", "EczemaCure Search Ad", "ECZ-CURE", text, [c1, c2, c3], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 106. Search Ad - Price and Availability
  {
    const text = "Limited Batch Mineral Sunscreen | Only 500 Tubes Available\nPriced at ₹899 with SPF 50+ PA++++. Non-nano zinc oxide formula leaves zero white cast. Shop before stock sells out.";
    const c1 = buildClaim(text, "Only 500 Tubes Available", "availability", {});
    const c2 = buildClaim(text, "Priced at ₹899", "price", { price: 899, currency: "INR" });
    const c3 = buildClaim(text, "SPF 50+ PA++++", "product_attribute", {});
    list.push(makeExample(id++, "search_ad", "Mineral Sunscreen Ad", "MIN-SUN-50", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 107. Search Ad - Clinical testing assertion
  {
    const text = "Dermatologist Tested Retinol | Validated in 12-Week Study\nProven to smooth deep wrinkles with zero redness. 92% of clinical trial participants reported noticeable skin firming.";
    const c1 = buildClaim(text, "Validated in 12-Week Study", "clinical", { timeline: "12-Week" });
    const c2 = buildClaim(text, "92% of clinical trial participants reported noticeable skin firming", "clinical", {});
    list.push(makeExample(id++, "search_ad", "Clinique Retinol Ad", "CLIN-RET-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 108. Search Ad - Ambiguous claim
  {
    const text = "Transform Dull Complexions | Experience The Glow Revolution\nUnveil eternal luminescence with our luxury botanical formulation. Loved by thousands across India.";
    list.push(makeExample(id++, "search_ad", "Glow Revolution Ad", null, text, [], { has_ambiguity: true }));
  }

  // 109. Search Ad - Product attribute (Vegan, fragrance free)
  {
    const text = "100% Vegan Niacinamide Serum | Fragrance-Free Formula\nContains 10% Niacinamide and 1% Zinc PCA to balance oily skin and refine open pores. Buy now for ₹699.";
    const c1 = buildClaim(text, "100% Vegan Niacinamide Serum", "product_attribute", {});
    const c2 = buildClaim(text, "Contains 10% Niacinamide and 1% Zinc PCA", "product_attribute", { ingredient: "Niacinamide", concentration: "10%" });
    const c3 = buildClaim(text, "Buy now for ₹699", "price", { price: 699, currency: "INR" });
    list.push(makeExample(id++, "search_ad", "Vegan Niacinamide Ad", "VN-NIAC-10", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 110. Search Ad - Guarantee and money back
  {
    const text = "Anti-Acne Spot Gel | 30-Day Money Back Guarantee\nClear active pimples in 24 hours. If not completely satisfied within 30 days, receive a 100% refund. Order online.";
    const c1 = buildClaim(text, "30-Day Money Back Guarantee", "guarantee", { timeline: "30-Day" });
    const c2 = buildClaim(text, "Clear active pimples in 24 hours", "efficacy", { timeline: "24 hours" });
    const c3 = buildClaim(text, "100% refund", "guarantee", {});
    list.push(makeExample(id++, "search_ad", "AcneSpot Gel Ad", "AS-GEL-01", text, [c1, c2, c3], { has_high_risk_language: true, risk_types: ["absolute_guarantee"] }));
  }

  // 111. Search Ad - Hard Negative (Welcome message)
  {
    const text = "Official Brand Store | Handcrafted Botanical Care\nDiscover honest skincare thoughtfully formulated for everyday modern living. Free customer care consultations available.";
    list.push(makeExample(id++, "search_ad", "Handcrafted Skin Ad", null, text, [], {}));
  }

  // 112. Search Ad - Comparative absorbency in search copy
  {
    const text = "Hyaluronic Acid Serum | 2x Deeper Hydration Penetration\nSub-molecular formula penetrates deeper than traditional serums for plump dewy skin. ₹1,299 with free express shipping.";
    const c1 = buildClaim(text, "2x Deeper Hydration Penetration", "comparative", {});
    const c2 = buildClaim(text, "₹1,299 with free express shipping", "price", { price: 1299, currency: "INR" });
    list.push(makeExample(id++, "search_ad", "SubMolecular Hyaluronic Ad", "SM-HYDRA-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 113. Search Ad - Efficacy timeline in ad description
  {
    const text = "Dark Spot Correcting Serum | Visible Results in 2 Weeks\nFormulated with 5% Niacinamide and 2% Tranexamic Acid. Diminishes stubborn acne marks in 14 days. Shop today.";
    const c1 = buildClaim(text, "Visible Results in 2 Weeks", "efficacy", { timeline: "2 Weeks" });
    const c2 = buildClaim(text, "Formulated with 5% Niacinamide and 2% Tranexamic Acid", "product_attribute", { ingredient: "Niacinamide", concentration: "5%" });
    const c3 = buildClaim(text, "Diminishes stubborn acne marks in 14 days", "efficacy", { timeline: "14 days" });
    list.push(makeExample(id++, "search_ad", "Tranexamic Serum Ad", "TX-SERUM-02", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 114. Search Ad - Promotional gift and discount
  {
    const text = "Special Festive Offer | Buy 1 Get 1 Free Today Only\nShop any anti-aging moisturizer and receive a second unit absolutely free. Includes complimentary deluxe pouch.";
    const c1 = buildClaim(text, "Buy 1 Get 1 Free Today Only", "discount", {});
    const c2 = buildClaim(text, "receive a second unit absolutely free", "discount", {});
    const c3 = buildClaim(text, "Includes complimentary deluxe pouch", "promotional", {});
    list.push(makeExample(id++, "search_ad", "BOGO Festive Ad", null, text, [c1, c2, c3], { has_promotional_conditions: true }));
  }

  // 115. Search Ad - Availability restricted to DTC
  {
    const text = "Pure Bakuchiol 1% Fluid | Exclusively at Official Store\nNot sold on Amazon or third-party marketplaces. Formulated at pH 5.5 for sensitive skin. Buy genuine stock now.";
    const c1 = buildClaim(text, "Exclusively at Official Store", "availability", {});
    const c2 = buildClaim(text, "Formulated at pH 5.5", "product_attribute", { attribute_name: "pH", attribute_value: "5.5" });
    list.push(makeExample(id++, "search_ad", "Bakuchiol DTC Ad", "BAK-DTC-01", text, [c1, c2], { has_numerical_claim: true }));
  }

  // 116. Search Ad - Other (Carbon neutral and recycled)
  {
    const text = "EcoCleanse Face Wash | 100% Recyclable Packaging\nPriced at ₹599. Certified carbon-neutral delivery nationwide on every order. Order direct from manufacturer.";
    const c1 = buildClaim(text, "100% Recyclable Packaging", "other", { attribute_name: "packaging", attribute_value: "recyclable" });
    const c2 = buildClaim(text, "Priced at ₹599", "price", { price: 599, currency: "INR" });
    const c3 = buildClaim(text, "Certified carbon-neutral delivery nationwide", "other", {});
    list.push(makeExample(id++, "search_ad", "EcoCleanse Search Ad", "ECO-WASH-599", text, [c1, c2, c3], { has_numerical_claim: true }));
  }

  // 117. Search Ad - High risk permanent elimination claim
  {
    const text = "Psoriasis Relief Ointment | Permanently Eliminates Flaking\nClinically proven to cure chronic plaque psoriasis lesions in 10 days. Guaranteed results or 100% money back.";
    const c1 = buildClaim(text, "Permanently Eliminates Flaking", "efficacy", {});
    const c2 = buildClaim(text, "cure chronic plaque psoriasis lesions in 10 days", "efficacy", { timeline: "10 days" });
    const c3 = buildClaim(text, "100% money back", "guarantee", {});
    list.push(makeExample(id++, "search_ad", "Psoriasis Relief Ad", "PSOR-RELIEF", text, [c1, c2, c3], { has_high_risk_language: true, risk_types: ["disease_claim", "absolute_guarantee"] }));
  }

  // 118. Search Ad - Clinical trial metrics
  {
    const text = "Clinical Eye Serum | 88% Reduced Undereye Puffiness\nEvaluated in a clinical trial across 40 subjects. Formulated with 5% Caffeine and Green Tea EGCG. ₹999.";
    const c1 = buildClaim(text, "88% Reduced Undereye Puffiness", "clinical", {});
    const c2 = buildClaim(text, "clinical trial across 40 subjects", "clinical", {});
    const c3 = buildClaim(text, "Formulated with 5% Caffeine and Green Tea EGCG", "product_attribute", { ingredient: "Caffeine", concentration: "5%" });
    const c4 = buildClaim(text, "₹999", "price", { price: 999, currency: "INR" });
    list.push(makeExample(id++, "search_ad", "Clinical Eye Serum Ad", "CES-999", text, [c1, c2, c3, c4], { has_numerical_claim: true }));
  }

  // 119. Search Ad - Ambiguous soothing promise
  {
    const text = "Gentle Calming Fluid | Quench Stressed Sensitive Skin\nEnvelope your face in heavenly dewy comfort with our soothing plant nectar. Order online today.";
    list.push(makeExample(id++, "search_ad", "Gentle Calming Ad", null, text, [], { has_ambiguity: true }));
  }

  // 120. Search Ad - Discount and free shipping threshold
  {
    const text = "Diwali Skincare Sale | Save ₹400 on Orders Above ₹1,499\nEnjoy festive savings on all certified organic facial oils. Free express delivery guaranteed before Diwali.";
    const c1 = buildClaim(text, "Save ₹400 on Orders Above ₹1,499", "discount", { discount_amount: 400, currency: "INR" });
    const c2 = buildClaim(text, "Free express delivery guaranteed before Diwali", "promotional", {});
    list.push(makeExample(id++, "search_ad", "Festive Diwali Search Ad", null, text, [c1, c2], { has_numerical_claim: true, has_promotional_conditions: true }));
  }

  return list;
}
