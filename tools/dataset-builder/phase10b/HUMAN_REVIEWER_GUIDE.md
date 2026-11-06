# BrandShield AI — Phase 10B Human Reviewer & Annotation Guide

This guide establishes the standard operating procedure for human compliance auditors annotating and verifying the real-world marketing claim extraction evaluation dataset.

---

## 1. Principles & Integrity Mandates

1. **Genuine Human Review**:
   Synthetic approval personas, automated sign-offs, and batch automated approval scripts are strictly prohibited. Every approved record must reflect human inspection.
2. **Unreviewed Records Remain Unreviewed**:
   Records that have not yet been audited by a human must retain `review_status: "unreviewed"` with `reviewer_name: null` and `reviewed_at: null`.
3. **Verbatim Substring Fidelity**:
   The claim span must exactly match the character sequence in `content`. Never correct grammar, typos, or punctuation inside `claim_text`.
4. **UTF-16 Index Invariant**:
   Indices must satisfy: `content.slice(text_start, text_end) === claim_text`.
5. **No Silent Repair**:
   If an offset drifts or fails slicing, it must be flagged and corrected explicitly through the review workflow.

---

## 2. Review Workflow & CLI Tools

### Checking Review Progress
To inspect how many records have been genuinely reviewed by humans versus those awaiting review:
```bash
npx tsx tools/dataset-builder/phase10b/review-cli.ts --status
```

### Approving a Record
When the proposed draft claims, spans, categories, and entities are confirmed accurate:
```bash
npx tsx tools/dataset-builder/phase10b/review-cli.ts --approve eval_10b_001 --reviewer "Jane Doe" --email "jane.doe@brandshield.ai" --notes "Verified all 3 spans and prices"
```

### Rejecting a Record
When the marketing copy is corrupt, untruthful to real marketing channels, or invalid:
```bash
npx tsx tools/dataset-builder/phase10b/review-cli.ts --reject eval_10b_002 --reviewer "Jane Doe" --email "jane.doe@brandshield.ai" --reason "Malformed character encoding in source"
```

---

## 3. Claim Classification Standards (10 Closed Enums)

1. **`price`**: Explicit selling prices, catalogue MRP, or regular costs (`"Only ₹1,499"`, `"Priced at ₹899"`).
2. **`discount`**: Percentage or absolute savings (`"Save 25%"`, `"flat ₹500 off"`, `"Buy 1 Get 1 Free"`).
3. **`product_attribute`**: Ingredients, concentrations, volumes, textures, certifications (`"Infused with 12% pure ascorbic acid"`, `"100% vegan certified"`).
4. **`efficacy`**: Measurable performance outcomes or visual transformations (`"reduced dark spots in 14 days"`, `"increases hydration by 65%"`).
5. **`guarantee`**: Absolute promises, zero-risk terms, or unconditional refunds (`"30-day money-back guarantee"`, `"100% refund"`).
6. **`comparative`**: Explicit comparisons against benchmark products or market alternatives (`"2x faster matte dry-down than standard zinc creams"`).
7. **`clinical`**: References to clinical trials, laboratory testing, dermatologist evaluations, or subject counts (`"Clinically tested on 45 women under dermatologist supervision"`).
8. **`availability`**: Stock constraints, production caps, or distribution exclusivity (`"Only 300 units remaining in stock"`, `"Exclusively at Official Store"`).
9. **`promotional`**: Time-bound perks, coupon codes, gifts with purchase, free shipping thresholds (`"Free shipping on all orders over ₹999"`).
10. **`other`**: Factual assertions outside the 9 primary types, such as recyclable packaging or shelf life (`"housed in 100% post-consumer recycled ocean plastic"`, `"Expiry: 24 months from manufacturing date"`).

---

## 4. Handling Edge Cases

### Zero-Claim Candidates (Hard Negatives)
If the copy contains only inspirational storytelling, sensory descriptions, or greetings without verifiable claims, approve it with an empty claims array (`claims: []`).
- **Example**: *"Sunday morning sunbeams and mindful moments. Taking twenty minutes just for myself..."* -> Zero claims.

### Ambiguous Claims vs. Pure Puffery
- Non-verifiable subjective puffery (*"eternal youth in a bottle"*, *"heavenly dewy comfort"*) should NOT be extracted as factual efficacy claims.
- If a sentence contains both puffery and a verifiable fact (*"Infused with botanical peptides for eternal youth"*), extract only the factual portion: `"Infused with botanical peptides"` (type: `product_attribute`).

### High-Risk Assertions
Always extract prohibited medical assertions (*"completely cures psoriasis lesions"*, *"permanently eradicates dermatitis"*) as claims (type `efficacy` or `guarantee`) so the downstream policy engine can flag regulatory non-compliance.

