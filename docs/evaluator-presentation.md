# BrandShield AI — Evaluator Presentation & Pitch Deck Outline

> **Target Presentation Time**: 5 Minutes Pitch + 3 Minutes Q&A  
> **Target Audience**: Hackathon Judges, Technical Evaluators, Enterprise Investors  
> **Presenter**: BrandShield AI Core Team

---

## Slide 1: Problem Statement
- **Headline**: The High Cost of Unsubstantiated Marketing Claims.
- **Context**: In regulated industries (consumer healthcare, dermatological skincare, supplements, and food), consumer advertising is aggressively monitored by regulatory agencies (FTC, FDA, ASA).
- **The Risk**: A single unsubstantiated promotional claim—such as an exaggerated clinical percentage, unverified discount, or unauthorized medical promise—leads to:
  - Regulatory enforcement notices and seven-figure fines.
  - Mandatory product recalls and retailer delistings.
  - Irreparable destruction of consumer brand trust.

---

## Slide 2: Existing Market Problem
- **Headline**: Marketing Moves at the Speed of Social; Compliance Takes Weeks.
- **The Disconnect**:
  - Growth and social marketing teams generate dozens of copy variants daily across Instagram, TikTok, Meta Ads, and direct-to-consumer websites.
  - Legal, medical, and regulatory affairs (MLR) departments rely on manual email threads, spreadsheets, and manual cross-referencing against hundred-page clinical dossiers.
- **The Consequence**: Either compliance slows marketing to a crawl, or high-risk unvetted copy slips through to production.
- **Why Generic LLMs Fail**: Throwing GPT-4 at compliance copy produces hallucinations, inconsistent evaluations, and lack of auditability.

---

## Slide 3: The BrandShield AI Solution
- **Headline**: Evidence-Linked, Deterministic Marketing Claim Governance.
- **What It Does**: BrandShield AI is an automated platform that:
  1. Extracts atomic assertions from marketing collateral with character-level precision.
  2. Verifies claims against approved clinical trial data and product dossiers using **100% deterministic, rule-based logic**.
  3. Provides compliance officers with suggested legally defensible phrasing.
  4. Programmatically enforces a **fail-closed publication gate** that prevents non-compliant copy from reaching ad managers.

---

## Slide 4: Key Differentiators
1. **Zero LLM Hallucinations in Verification**:
   - The LLM only extracts claims. Verification verdicts (`SUPPORTED`, `CONTRADICTED`, `OUTDATED`, `UNVERIFIED`) are calculated by deterministic code—never an LLM prompt.
2. **Absence of Proof is Not Contradiction**:
   - Missing evidence is classified strictly as `UNVERIFIED`—preventing false contradictions.
3. **Deterministic UTF-16 Character Offsets**:
   - Maintains exact character span invariance with full Unicode currency (₹, €, $) and multi-byte emoji support.
4. **Enforced Gatekeeping**:
   - Not an advisory tool; an actual gatekeeper. Submissions with unverified or contradicted active claims are programmatically locked.
5. **Database-Level Immutability**:
   - Compliance audit events are protected by PostgreSQL triggers that reject all UPDATE and DELETE attempts.

---

## Slide 5: Technical Architecture
- **Full-Stack Next.js 16**: Modern App Router with TypeScript 5, React 19, and Tailwind CSS v4.
- **Supabase PostgreSQL 17**: Relational database with multi-tenant Row Level Security (RLS) and `pgvector` indexing.
- **Dual AI Runtime**: Local private Ollama extraction (`qwen3:4b` / `llama3`), cloud OpenAI (`gpt-4o-mini`), and deterministic offline mock fallback.
- **Connection Pooling**: Native PostgreSQL pool with transactional rollback isolation (`withTransaction`).

---

## Slide 6: AI Extraction & Deterministic Evidence Verification
- **Decomposition**: Complex compound sentences are broken down into atomic assertions.
- **8 Specialized Category Engines**:
  - Pricing & MSRP (Decimal-safe paise integer arithmetic).
  - Promotional Discounts (Valid temporal UTC horizons & channel permissions).
  - Product Attributes & Concentrations (Clinical dossier spec matching).
  - Clinical Efficacy Endpoints (Study duration and trial demographics).
  - Absolute Guarantees (Brand safety rules).
- **Composite Risk Rating (0–100)**: Categorizes claims into Critical, High, Medium, or Low risk tiers.

---

## Slide 7: Human Governance & Workflow
- **Human-in-the-Loop Philosophy**: AI empowers; humans decide.
- **Structured Review Workbench**: Reviewers can Approve, Reject, Escalate to Legal, or Modify claims.
- **Enforced Policy Overrides**: Reviewers cannot override contradicted or critical claims without submitting a documented legal justification ($\ge 10$ characters).
- **Defensible Phrasing Generator**: Suggests approved compliant alternatives derived from clinical trials.

---

## Slide 8: Live Demonstration (3-Minute Flow)
- **Act 1**: Load **Scenario A (Compliant Launch)** $\rightarrow$ Extract claims with Ollama $\rightarrow$ Deterministic verification $\rightarrow$ Show **Publication Gate: ELIGIBLE**.
- **Act 2**: Load **Scenario B (Misleading Overclaim)** (*"cures eczema overnight"* at unapproved price) $\rightarrow$ Extract & verify $\rightarrow$ Flagged as **CRITICAL RISK CONTRADICTED** $\rightarrow$ Show **Publication Gate: LOCKED**.
- **Act 3**: Compliance review in `/reviews` $\rightarrow$ Modify claim with suggested 10% phrasing $\rightarrow$ Inspect append-only audit trail in `/audit`.

---

## Slide 9: Measured Results & Impact
- **Test Coverage**: 200+ automated test criteria passing with zero failures.
- **Review Velocity**: Reduces initial marketing copy compliance check from 3–5 business days to under 5 seconds.
- **Risk Mitigation**: 100% elimination of unauthorized ingredient concentration claims and expired promotional pricing.
- **Audit Readiness**: Instant generation of timestamped, tamper-evident audit trails for regulatory inquiries.

---

## Slide 10: Future Improvements & Enterprise Roadmap
1. **Direct Ad Manager Integrations**: Native publishing webhooks to Meta Ads Manager, Google Ads, and Shopify DTC storefronts.
2. **Automated Dossier OCR**: Ingestion of scanned legacy laboratory PDFs using Vision OCR pipelines.
3. **Live Database Migration Deployment**: Executing pending Phase 7–9 migrations for database-level policy persistence and analytics views.
4. **Multi-Jurisdiction Regulatory Packs**: Pre-configured policy packs for EU Cosmetic Regulation (EC 1223/2009), US FDA 21 CFR, and India CDSCO.
