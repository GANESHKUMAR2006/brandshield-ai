/**
 * BrandShield AI — Diverse Marketing Corpus & Template Registry
 * Phase 10A: Training Dataset Builder
 *
 * Rich collection of atomic claim templates across all 10 categories,
 * lifestyle negative templates, multi-claim copy structures,
 * and high-risk regulatory boundary cases.
 */

import { ClaimType, ClaimEntities, MarketingChannel, RiskCategory } from "./types";
import { CatalogProduct } from "./catalog";

export interface AtomicClaimTemplate {
  claimType: ClaimType;
  generateTextAndEntities: (product: CatalogProduct) => {
    claimText: string;
    entities: ClaimEntities;
    confidence: number;
    riskCategory?: RiskCategory;
    isAmbiguous?: boolean;
    isHighRisk?: boolean;
  };
}

/**
 * Registry of atomic claim generators covering all 10 BrandShield claim types.
 */
export const ATOMIC_CLAIM_TEMPLATES: Record<ClaimType, AtomicClaimTemplate[]> = {
  price: [
    {
      claimType: "price",
      generateTextAndEntities: (p) => ({
        claimText: `special price of ₹${p.defaultPrice}`,
        entities: { price: p.defaultPrice, currency: "INR" },
        confidence: 0.98,
      }),
    },
    {
      claimType: "price",
      generateTextAndEntities: (p) => ({
        claimText: `now only ₹${p.defaultPrice}`,
        entities: { price: p.defaultPrice, currency: "INR" },
        confidence: 0.97,
      }),
    },
    {
      claimType: "price",
      generateTextAndEntities: (p) => ({
        claimText: `catalogue MRP ₹${p.defaultPrice + 500}`,
        entities: { price: p.defaultPrice + 500, currency: "INR" },
        confidence: 0.96,
      }),
    },
    {
      claimType: "price",
      generateTextAndEntities: (p) => ({
        claimText: `introductory rate of ₹${p.defaultPrice}`,
        entities: { price: p.defaultPrice, currency: "INR" },
        confidence: 0.95,
      }),
    },
    {
      claimType: "price",
      generateTextAndEntities: (p) => ({
        claimText: `priced at ₹${p.defaultPrice}`,
        entities: { price: p.defaultPrice, currency: "INR" },
        confidence: 0.99,
      }),
    },
  ],

  discount: [
    {
      claimType: "discount",
      generateTextAndEntities: () => ({
        claimText: "Save 25% on your first order",
        entities: { discount_percentage: 25 },
        confidence: 0.96,
      }),
    },
    {
      claimType: "discount",
      generateTextAndEntities: () => ({
        claimText: "flat ₹500 off at checkout",
        entities: { discount_amount: 500, currency: "INR" },
        confidence: 0.97,
      }),
    },
    {
      claimType: "discount",
      generateTextAndEntities: () => ({
        claimText: "Buy 1 Get 1 free limited time",
        entities: {},
        confidence: 0.94,
      }),
    },
    {
      claimType: "discount",
      generateTextAndEntities: () => ({
        claimText: "enjoy 30% discount this weekend",
        entities: { discount_percentage: 30 },
        confidence: 0.98,
      }),
    },
    {
      claimType: "discount",
      generateTextAndEntities: () => ({
        claimText: "take ₹300 off with code GLOW300",
        entities: { discount_amount: 300, currency: "INR" },
        confidence: 0.95,
      }),
    },
  ],

  product_attribute: [
    {
      claimType: "product_attribute",
      generateTextAndEntities: (p) => {
        const ing = p.activeIngredients[0] || { name: "Niacinamide", concentration: "10%" };
        return {
          claimText: `formulated with ${ing.concentration} ${ing.name}`,
          entities: { ingredient: ing.name, concentration: ing.concentration },
          confidence: 0.97,
        };
      },
    },
    {
      claimType: "product_attribute",
      generateTextAndEntities: () => ({
        claimText: "100% vegan and cruelty-free formulation",
        entities: { attribute_name: "vegan_cruelty_free", attribute_value: "100%" },
        confidence: 0.95,
      }),
    },
    {
      claimType: "product_attribute",
      generateTextAndEntities: () => ({
        claimText: "fragrance-free and non-comedogenic",
        entities: { attribute_name: "fragrance_free", attribute_value: "true" },
        confidence: 0.96,
      }),
    },
    {
      claimType: "product_attribute",
      generateTextAndEntities: (p) => {
        const ing = p.activeIngredients[1] || p.activeIngredients[0];
        return {
          claimText: `contains active ${ing.name} at ${ing.concentration}`,
          entities: { ingredient: ing.name, concentration: ing.concentration },
          confidence: 0.94,
        };
      },
    },
    {
      claimType: "product_attribute",
      generateTextAndEntities: () => ({
        claimText: "pH-balanced at 5.5 for sensitive skin barrier",
        entities: { attribute_name: "pH", attribute_value: "5.5" },
        confidence: 0.93,
      }),
    },
  ],

  efficacy: [
    {
      claimType: "efficacy",
      generateTextAndEntities: () => ({
        claimText: "visibly reduces hyperpigmentation in 4 weeks",
        entities: { timeline: "4 weeks" },
        confidence: 0.95,
      }),
    },
    {
      claimType: "efficacy",
      generateTextAndEntities: () => ({
        claimText: "boosts skin hydration by 82% within 2 hours",
        entities: { timeline: "2 hours" },
        confidence: 0.96,
      }),
    },
    {
      claimType: "efficacy",
      generateTextAndEntities: () => ({
        claimText: "smooths fine lines and crow's feet in 14 days",
        entities: { timeline: "14 days" },
        confidence: 0.93,
      }),
    },
    {
      claimType: "efficacy",
      generateTextAndEntities: () => ({
        claimText: "reinforces epidermal barrier strength over 28 days",
        entities: { timeline: "28 days" },
        confidence: 0.94,
      }),
    },
    {
      claimType: "efficacy",
      generateTextAndEntities: () => ({
        claimText: "brightens dull complexion after just 7 days of daily use",
        entities: { timeline: "7 days" },
        confidence: 0.92,
      }),
    },
  ],

  guarantee: [
    {
      claimType: "guarantee",
      generateTextAndEntities: () => ({
        claimText: "100% money-back guarantee if not satisfied within 30 days",
        entities: { timeline: "30 days" },
        confidence: 0.97,
        isHighRisk: true,
        riskCategory: "absolute_guarantee",
      }),
    },
    {
      claimType: "guarantee",
      generateTextAndEntities: () => ({
        claimText: "guaranteed visible glow in 7 days or full refund",
        entities: { timeline: "7 days" },
        confidence: 0.95,
        isHighRisk: true,
        riskCategory: "absolute_guarantee",
      }),
    },
    {
      claimType: "guarantee",
      generateTextAndEntities: () => ({
        claimText: "risk-free 60-day home trial with free returns",
        entities: { timeline: "60 days" },
        confidence: 0.96,
      }),
    },
    {
      claimType: "guarantee",
      generateTextAndEntities: () => ({
        claimText: "guaranteed complete clearance of chronic cystic acne in 10 days",
        entities: { timeline: "10 days" },
        confidence: 0.91,
        isHighRisk: true,
        riskCategory: "disease_claim",
      }),
    },
    {
      claimType: "guarantee",
      generateTextAndEntities: () => ({
        claimText: "permanently prevents all future eczema flare-ups",
        entities: {},
        confidence: 0.90,
        isHighRisk: true,
        riskCategory: "disease_claim",
      }),
    },
  ],

  comparative: [
    {
      claimType: "comparative",
      generateTextAndEntities: () => ({
        claimText: "delivers 3x faster absorption than traditional oil serums",
        entities: { comparison_target: "traditional oil serums" },
        confidence: 0.94,
      }),
    },
    {
      claimType: "comparative",
      generateTextAndEntities: () => ({
        claimText: "2x more potent antioxidant protection compared to benchmark vitamin C",
        entities: { comparison_target: "benchmark vitamin C" },
        confidence: 0.93,
      }),
    },
    {
      claimType: "comparative",
      generateTextAndEntities: () => ({
        claimText: "outperforms standard hyaluronic acid serums in transepidermal water retention",
        entities: { comparison_target: "standard hyaluronic acid serums" },
        confidence: 0.95,
      }),
    },
    {
      claimType: "comparative",
      generateTextAndEntities: () => ({
        claimText: "half the irritation rate of leading department store retinol creams",
        entities: { comparison_target: "leading department store retinol creams" },
        confidence: 0.92,
      }),
    },
    {
      claimType: "comparative",
      generateTextAndEntities: () => ({
        claimText: "lasts 4 hours longer than ordinary chemical sunscreens",
        entities: { comparison_target: "ordinary chemical sunscreens", timeline: "4 hours" },
        confidence: 0.91,
      }),
    },
  ],

  clinical: [
    {
      claimType: "clinical",
      generateTextAndEntities: () => ({
        claimText: "clinically proven in a 12-week double-blind randomized trial on 60 participants",
        entities: { timeline: "12 weeks" },
        confidence: 0.98,
      }),
    },
    {
      claimType: "clinical",
      generateTextAndEntities: () => ({
        claimText: "dermatologist-tested and verified safe for sensitized skin barriers",
        entities: {},
        confidence: 0.96,
      }),
    },
    {
      claimType: "clinical",
      generateTextAndEntities: () => ({
        claimText: "in-vivo instrumental measurements showed 42% barrier lipid replenishment",
        entities: {},
        confidence: 0.95,
      }),
    },
    {
      claimType: "clinical",
      generateTextAndEntities: () => ({
        claimText: "94% of subjects in clinical evaluation reported zero irritation over 8 weeks",
        entities: { timeline: "8 weeks" },
        confidence: 0.97,
      }),
    },
    {
      claimType: "clinical",
      generateTextAndEntities: () => ({
        claimText: "validated by independent laboratory spectro-photometric assays",
        entities: {},
        confidence: 0.94,
      }),
    },
  ],

  availability: [
    {
      claimType: "availability",
      generateTextAndEntities: () => ({
        claimText: "limited batch of only 500 bottles produced",
        entities: {},
        confidence: 0.94,
      }),
    },
    {
      claimType: "availability",
      generateTextAndEntities: () => ({
        claimText: "exclusively available on the official DermaGlow DTC flagship store",
        entities: {},
        confidence: 0.95,
      }),
    },
    {
      claimType: "availability",
      generateTextAndEntities: () => ({
        claimText: "available across select dermatology clinics nationwide",
        entities: {},
        confidence: 0.92,
      }),
    },
    {
      claimType: "availability",
      generateTextAndEntities: () => ({
        claimText: "only 150 units remaining in stock for this harvest season",
        entities: {},
        confidence: 0.96,
      }),
    },
    {
      claimType: "availability",
      generateTextAndEntities: () => ({
        claimText: "pre-order window open strictly until Friday midnight",
        entities: {},
        confidence: 0.93,
      }),
    },
  ],

  promotional: [
    {
      claimType: "promotional",
      generateTextAndEntities: () => ({
        claimText: "complimentary luxury velvet travel pouch included with every bottle",
        entities: {},
        confidence: 0.95,
      }),
    },
    {
      claimType: "promotional",
      generateTextAndEntities: () => ({
        claimText: "free express shipping on all domestic orders above ₹999",
        entities: { price: 999, currency: "INR" },
        confidence: 0.97,
      }),
    },
    {
      claimType: "promotional",
      generateTextAndEntities: () => ({
        claimText: "includes 2 free deluxe mini trial samples with checkout",
        entities: {},
        confidence: 0.94,
      }),
    },
    {
      claimType: "promotional",
      generateTextAndEntities: () => ({
        claimText: "exclusive seasonal festival gift packaging",
        entities: {},
        confidence: 0.93,
      }),
    },
    {
      claimType: "promotional",
      generateTextAndEntities: () => ({
        claimText: "earn double glow reward points on subscription refills",
        entities: {},
        confidence: 0.91,
      }),
    },
  ],

  other: [
    {
      claimType: "other",
      generateTextAndEntities: () => ({
        claimText: "packaged in 100% recyclable amber glass to preserve active photostability",
        entities: { attribute_name: "packaging_material", attribute_value: "amber glass" },
        confidence: 0.92,
      }),
    },
    {
      claimType: "other",
      generateTextAndEntities: () => ({
        claimText: "sustainably harvested from certified fair-trade botanical cooperatives",
        entities: {},
        confidence: 0.90,
      }),
    },
    {
      claimType: "other",
      generateTextAndEntities: () => ({
        claimText: "shelf life stable for 24 months from manufacturing date",
        entities: { timeline: "24 months" },
        confidence: 0.93,
      }),
    },
    {
      claimType: "other",
      generateTextAndEntities: () => ({
        claimText: "manufactured in a WHO-GMP certified cleanroom facility",
        entities: {},
        confidence: 0.94,
      }),
    },
    {
      claimType: "other",
      generateTextAndEntities: () => ({
        claimText: "carbon-neutral logistics certified by GreenFleet India",
        entities: {},
        confidence: 0.89,
      }),
    },
  ],
};

/**
 * Hard Negative Templates: Pure lifestyle rhetoric, aesthetic philosophy,
 * emotional encouragement, and non-actionable puffery with ZERO verifiable claims.
 */
export const HARD_NEGATIVE_TEXTS = [
  "Awaken your morning glow with mindful skincare rituals inspired by morning sunlight and gentle botanical balance. Every sunrise brings a moment to pause, breathe, and nourish your inner harmony.",
  "Radiance begins from within. Cherish the calm moments of self-care and honor the journey your skin takes each day. Beautiful skin is a feeling of serene confidence and quiet grace.",
  "DermaGlow embraces the poetry of modern self-care. Pure, intentional, and thoughtfully designed to complement your daily reflection in the quiet morning mirror.",
  "Experience skin confidence that celebrates your natural authenticity. No filters, no compromises, simply your true vitality shining through every conversation.",
  "Step into an oasis of calm. Our ritual embodies mindfulness, balance, and the soothing whisper of calm botanicals crafted for life's gentle transitions.",
  "True radiance is not about perfection; it is about self-acceptance, vitality, and loving the luminous skin you live in every single day.",
  "Breathe in tranquility. Skincare is an intimate conversation with yourself, crafted to restore quiet peace amidst the hurry of modern urban living.",
  "Embrace your unique story. Every smile line tells of shared joy, every gentle contour reflects resilience and the graceful journey of life.",
  "Elevate your evening ritual with calming sensory textures. Close your eyes, let go of the day, and welcome peaceful, restorative tranquility.",
  "Gentle harmony for your mindful routine. Designed for quiet mornings and reflective evenings where simplicity meets the pure art of living well.",
  "Celebrate authentic vitality. When you feel centered in your daily habits, your natural inner radiance effortlessly illuminates the room.",
  "Discover the serenity of uncomplicated self-care. Because you deserve peaceful moments of intentional tenderness every single morning.",
];

/**
 * Channel-specific marketing framing and connectors.
 */
export const CHANNEL_CONFIGS: Record<
  MarketingChannel,
  {
    introTemplates: Array<(prodName: string, sku: string) => string>;
    connectors: string[];
    outroTemplates: string[];
  }
> = {
  instagram: {
    introTemplates: [
      (p) => `✨ Glow up your morning routine with ${p}! `,
      (p) => `Meet your skin's new holy grail: ${p}. `,
      (p) => `Drop everything: ${p} is finally here! `,
    ],
    connectors: [" Plus, ", " What's more, ", " Best of all, ", " You'll love that ", " Wondering why? "],
    outroTemplates: [
      " Double tap if your skin needs this boost! Link in bio. 🌿✨ #DermaGlow #CleanBeauty",
      " Tap the product tag to shop now before stock runs out! 💕 #SkincareRoutine #GlowGoals",
      " Drop a comment below with your favorite skincare step! #SkincareCommunity",
    ],
  },

  email: {
    introTemplates: [
      (p) => `Dear Skincare Insider,\n\nWe are thrilled to unveil ${p}.\n\n`,
      (p) => `Special VIP announcement regarding your favorite ${p}:\n\n`,
      (p) => `Your weekly skincare bulletin: Everything you need to know about ${p}.\n\n`,
    ],
    connectors: ["\n\nFurthermore, ", "\n\nAdditionally, ", "\n\nIn our tests, ", "\n\nNote that "],
    outroTemplates: [
      "\n\nWarm regards,\nThe DermaGlow Formulation Team\nUnsubscribe | Privacy Policy",
      "\n\nClaim your VIP perk today at our DTC store.\nWith love,\nDermaGlow Customer Care",
    ],
  },

  packaging: {
    introTemplates: [
      (p, sku) => `PRODUCT: ${p} [SKU: ${sku}]\nDIRECTIONS & CLAIMS: `,
      (p) => `DERMAGLOW ADVANCED DERMATOLOGY — ${p}\nSPECIFICATION: `,
    ],
    connectors: [" | ", " • ", " — ", " ; "],
    outroTemplates: [
      " Keep away from direct sunlight. Batch: DG-2026-X. Made in India.",
      " For external topical use only. Dermatologically monitored formulation.",
    ],
  },

  landing_page: {
    introTemplates: [
      (p) => `# Unlock Luminous Skin with ${p}\n\nClinical skincare engineered for maximum cellular vitality. `,
      (p) => `# ${p}: The Science of Pure Radiance\n\nFormulated with zero compromises for noticeable daily transformations. `,
    ],
    connectors: ["\n- Key Highlight: ", "\n- Proven Benefit: ", "\n- Formulation Fact: ", "\n- Customer Perk: "],
    outroTemplates: [
      "\n\n[Add To Bag Now] — Free 2-Day Shipping on qualifying orders.",
      "\n\nBacked by the DermaGlow Transparency Commitment. Certified clean by independent laboratories.",
    ],
  },

  amazon_pdp: {
    introTemplates: [
      (p, sku) => `About this item (${p} - Model: ${sku}):\n• `,
      (p) => `DermaGlow Premium Skincare - ${p}:\n• `,
    ],
    connectors: ["\n• ", "\n• Key Feature: ", "\n• Highlight: "],
    outroTemplates: [
      "\n• Ships in frustration-free packaging directly from DermaGlow Official Storefront.",
      "\n• Eligible for Amazon Prime next-day delivery and customer service support.",
    ],
  },

  google_ads: {
    introTemplates: [
      (p) => `Official DermaGlow ${p} | `,
      (p) => `Discover ${p} | `,
    ],
    connectors: [" | ", " — ", " - "],
    outroTemplates: [
      " | Fast Free Delivery Over ₹999. Shop Official Store Today.",
      " | Verified Clean Formula. Buy Now on DermaGlow DTC.",
    ],
  },
};

