/**
 * BrandShield AI — Partitioned Product & Campaign Catalog
 * Phase 10A: Training Dataset Builder
 *
 * Provides disjoint product lines and campaign identifiers across
 * Train, Validation, and Test partitions to prevent information leakage.
 */

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  defaultPrice: number;
  currency: string;
  activeIngredients: Array<{ name: string; concentration: string | number }>;
}

export interface PartitionCatalog {
  partition: "train" | "validation" | "test";
  campaigns: string[];
  products: CatalogProduct[];
}

export const CATALOG_TRAIN: PartitionCatalog = {
  partition: "train",
  campaigns: [
    "CAMP-TRN-SUMMER-2026",
    "CAMP-TRN-MONSOON-2026",
    "CAMP-TRN-DIWALI-2026",
    "CAMP-TRN-DTC-LAUNCH",
    "CAMP-TRN-INFLUENCER-COLLAB",
    "CAMP-TRN-EMAIL-NEWSLETTER",
    "CAMP-TRN-AMAZON-PRIME",
  ],
  products: [
    {
      id: "prod_trn_001",
      sku: "DG-VITC-01",
      name: "DermaGlow 10% Vitamin C Radiance Serum",
      category: "Serums",
      defaultPrice: 1999,
      currency: "INR",
      activeIngredients: [
        { name: "Vitamin C", concentration: "10%" },
        { name: "Ferulic Acid", concentration: "0.5%" },
      ],
    },
    {
      id: "prod_trn_002",
      sku: "DG-VITC-02",
      name: "DermaGlow 15% Vitamin C Advanced Brightening Booster",
      category: "Boosters",
      defaultPrice: 2499,
      currency: "INR",
      activeIngredients: [
        { name: "L-Ascorbic Acid", concentration: "15%" },
        { name: "Alpha Arbutin", concentration: "1%" },
      ],
    },
    {
      id: "prod_trn_003",
      sku: "DG-HYDRA-01",
      name: "DermaGlow HydraDefense Hyaluronic Acid Gel Cream",
      category: "Moisturizers",
      defaultPrice: 1499,
      currency: "INR",
      activeIngredients: [
        { name: "Hyaluronic Acid", concentration: "2%" },
        { name: "Panthenol (Vitamin B5)", concentration: "1%" },
      ],
    },
    {
      id: "prod_trn_004",
      sku: "DG-HYDRA-02",
      name: "DermaGlow HydraDefense 2% B5 Intensive Hydration Serum",
      category: "Serums",
      defaultPrice: 1799,
      currency: "INR",
      activeIngredients: [
        { name: "Hyaluronic Acid Multi-Molecular", concentration: "2%" },
        { name: "Vitamin B5", concentration: "1.5%" },
      ],
    },
    {
      id: "prod_trn_005",
      sku: "DG-NIAC-01",
      name: "DermaGlow 10% Niacinamide Blemish & Pore Refining Serum",
      category: "Serums",
      defaultPrice: 1699,
      currency: "INR",
      activeIngredients: [
        { name: "Niacinamide", concentration: "10%" },
        { name: "Zinc PCA", concentration: "1%" },
      ],
    },
    {
      id: "prod_trn_006",
      sku: "DG-NIAC-02",
      name: "DermaGlow Niacinamide + Zinc 1% Oil-Control Mattifying Fluid",
      category: "Fluids",
      defaultPrice: 1399,
      currency: "INR",
      activeIngredients: [
        { name: "Niacinamide", concentration: "5%" },
        { name: "Zinc PCA", concentration: "1%" },
      ],
    },
    {
      id: "prod_trn_007",
      sku: "DG-PEPT-01",
      name: "DermaGlow Multi-Peptide Firming & Youth Infusion Complex",
      category: "Anti-Aging",
      defaultPrice: 2899,
      currency: "INR",
      activeIngredients: [
        { name: "Matrixyl 3000", concentration: "3%" },
        { name: "Argireline", concentration: "2%" },
      ],
    },
    {
      id: "prod_trn_008",
      sku: "DG-SQUAL-01",
      name: "DermaGlow 100% Plant-Derived Squalane Moisture Lock Oil",
      category: "Facial Oils",
      defaultPrice: 1599,
      currency: "INR",
      activeIngredients: [{ name: "Squalane", concentration: "100%" }],
    },
    {
      id: "prod_trn_009",
      sku: "DG-AHA-01",
      name: "DermaGlow 10% AHA + 2% BHA Peeling Solution Exfoliant",
      category: "Peels",
      defaultPrice: 1899,
      currency: "INR",
      activeIngredients: [
        { name: "Glycolic Acid", concentration: "7%" },
        { name: "Lactic Acid", concentration: "3%" },
        { name: "Salicylic Acid", concentration: "2%" },
      ],
    },
    {
      id: "prod_trn_010",
      sku: "DG-BOTAN-01",
      name: "DermaGlow Centella Asiatica & Green Tea Soothing Emulsion",
      category: "Soothing",
      defaultPrice: 1299,
      currency: "INR",
      activeIngredients: [
        { name: "Centella Asiatica", concentration: "5%" },
        { name: "Green Tea Extract", concentration: "2%" },
      ],
    },
  ],
};

export const CATALOG_VALIDATION: PartitionCatalog = {
  partition: "validation",
  campaigns: ["CAMP-VAL-SPRING-2026", "CAMP-VAL-ORGANIC-EXP"],
  products: [
    {
      id: "prod_val_001",
      sku: "DG-CERAM-01",
      name: "DermaGlow 5 Ceramides Intensive Lipid Barrier Cream",
      category: "Barrier Creams",
      defaultPrice: 2199,
      currency: "INR",
      activeIngredients: [
        { name: "Ceramide Complex", concentration: "3%" },
        { name: "Cholesterol", concentration: "1%" },
        { name: "Free Fatty Acids", concentration: "1%" },
      ],
    },
    {
      id: "prod_val_002",
      sku: "DG-CERAM-02",
      name: "DermaGlow Ceramide + Cholesterol Restorative Mist",
      category: "Mists",
      defaultPrice: 1199,
      currency: "INR",
      activeIngredients: [
        { name: "Ceramide NP", concentration: "0.5%" },
        { name: "Centella", concentration: "1%" },
      ],
    },
    {
      id: "prod_val_003",
      sku: "DG-BAK-01",
      name: "DermaGlow 1% Bakuchiol Plant-Alternative Smoothing Fluid",
      category: "Smoothing",
      defaultPrice: 2299,
      currency: "INR",
      activeIngredients: [
        { name: "Bakuchiol", concentration: "1%" },
        { name: "Rosehip Seed Oil", concentration: "2%" },
      ],
    },
    {
      id: "prod_val_004",
      sku: "DG-BAK-02",
      name: "DermaGlow Phyto-Bakuchiol Overnight Repair Treatment",
      category: "Night Care",
      defaultPrice: 2699,
      currency: "INR",
      activeIngredients: [
        { name: "Bakuchiol", concentration: "2%" },
        { name: "Squalane", concentration: "5%" },
      ],
    },
  ],
};

export const CATALOG_TEST: PartitionCatalog = {
  partition: "test",
  campaigns: [
    "CAMP-TST-BLACK-FRIDAY-2026",
    "CAMP-TST-RETAIL-EXPANSION",
    "CAMP-TST-HOLIDAY-BUNDLE",
  ],
  products: [
    {
      id: "prod_tst_001",
      sku: "DG-RET-01",
      name: "DermaGlow 0.3% Pure Encapsulated Retinol Night Serum",
      category: "Retinoids",
      defaultPrice: 2799,
      currency: "INR",
      activeIngredients: [
        { name: "Pure Retinol", concentration: "0.3%" },
        { name: "Bisabolol", concentration: "0.5%" },
      ],
    },
    {
      id: "prod_tst_002",
      sku: "DG-RET-02",
      name: "DermaGlow Granactive 2% Retinoid Gentle Wrinkle Defier",
      category: "Retinoids",
      defaultPrice: 2999,
      currency: "INR",
      activeIngredients: [
        { name: "Granactive Retinoid", concentration: "2%" },
        { name: "Squalane", concentration: "10%" },
      ],
    },
    {
      id: "prod_tst_003",
      sku: "DG-SUN-01",
      name: "DermaGlow Mineral Shield SPF 50+ PA++++ Invisible Sunscreen",
      category: "Sun Care",
      defaultPrice: 1899,
      currency: "INR",
      activeIngredients: [
        { name: "Zinc Oxide", concentration: "12%" },
        { name: "Titanium Dioxide", concentration: "5%" },
      ],
    },
    {
      id: "prod_tst_004",
      sku: "DG-SUN-02",
      name: "DermaGlow Daily Dew Hybrid UV Fluid SPF 30",
      category: "Sun Care",
      defaultPrice: 1499,
      currency: "INR",
      activeIngredients: [
        { name: "Broad Spectrum UV Filters", concentration: "10%" },
        { name: "Niacinamide", concentration: "2%" },
      ],
    },
    {
      id: "prod_tst_005",
      sku: "DG-EYE-01",
      name: "DermaGlow Caffeine 5% + EGCG De-Puffing Eye Contour Serum",
      category: "Eye Care",
      defaultPrice: 1799,
      currency: "INR",
      activeIngredients: [
        { name: "Caffeine", concentration: "5%" },
        { name: "EGCG Green Tea", concentration: "1%" },
      ],
    },
    {
      id: "prod_tst_006",
      sku: "DG-EYE-02",
      name: "DermaGlow Peptide & Marine Collagen Awakening Eye Balm",
      category: "Eye Care",
      defaultPrice: 2099,
      currency: "INR",
      activeIngredients: [
        { name: "Marine Collagen Peptides", concentration: "2%" },
        { name: "Hyaluronic Acid", concentration: "1%" },
      ],
    },
  ],
};

