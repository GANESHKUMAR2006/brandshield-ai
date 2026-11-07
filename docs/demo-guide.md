# BrandShield AI — Hackathon Demonstration Guide (3–5 Minutes)

> **Audience**: Hackathon Judges, Technical Evaluators, Industry Mentors  
> **Target Duration**: 3 to 5 minutes  
> **Target Persona**: VP of Regulatory Affairs, Chief Marketing Officer, Enterprise Compliance Officer  
> **Demo Workspace**: DermaGlow Skincare (Dermatological Cosmetics)

---

## Demonstration Overview & Schedule

| Segment | Timing | Action | Core Value Proposition |
| :--- | :--- | :--- | :--- |
| **1. The Problem** | 0:00 – 0:45 | Show Dashboard (`/dashboard`) | Regulatory risk & slow, manual legal reviews in enterprise brand marketing |
| **2. Compliant Campaign** | 0:45 – 1:30 | Load Preset A $\rightarrow$ Extract $\rightarrow$ Verify | AI extraction + 100% deterministic, rule-based verification against clinical facts |
| **3. Illegal Overclaim** | 1:30 – 2:30 | Load Preset B $\rightarrow$ Extract $\rightarrow$ Verify | High-risk medical overclaim detection & automated publication gate blocking |
| **4. Human Governance** | 2:30 – 3:30 | Reviewer Workbench (`/reviews`) | Human-in-the-loop review, override governance, and defensible copy recommendations |
| **5. Audit & Resilience** | 3:30 – 4:30 | Show `/audit` & Health Modal | Append-only tamper-evident audit trail & system diagnostics |

---

## Detailed Step-by-Step Script

### Step 1: Introduce the Problem (0:00 – 0:45)
- **URL**: `http://localhost:3000/dashboard`
- **Action**: Display the Executive Compliance Dashboard.
- **Presenter Script**:
  > *"Welcome everyone. In regulated consumer industries like skincare and wellness, every word published in advertising is under regulatory scrutiny from agencies like the FDA, FTC, and international trade commissions.*  
  > *A single unverified claim—like exaggerating an ingredient concentration or promising overnight cures—can lead to millions in fines, class-action lawsuits, and immediate brand delistings.*  
  > *Today, marketing moves at the speed of social media, but legal review takes weeks. BrandShield AI bridges that gap by combining AI claim extraction with deterministic, evidence-linked verification and enforced publication gating."*
- **Visual Cue**: Point to the **Workflow Readiness Banner**, **Overall Compliance Rate**, and click **Health Diagnostics** in the top navigation to show real-time connectivity to the database and AI extraction provider.

---

### Step 2: Create a Compliant Campaign (0:45 – 1:30)
- **URL**: Navigate to `http://localhost:3000/submissions`
- **Action**:
  1. Click the **New Submission** button.
  2. In the modal, click **Scenario A: Compliant Launch**.
  3. Notice how it auto-fills the approved copy:
     > *"DermaGlow Vitamin C Serum contains 10% stabilised Vitamin C. Now available for ₹1,999 during our Festival Glow launch."*
  4. Click **Create Submission**.
- **Presenter Script**:
  > *"Let's test an ad variant. In our submission creator, we load an approved campaign for the DermaGlow Vitamin C Serum."*
- **Action**: The submission detail modal opens automatically. Click **Extract Claims**.
- **Presenter Script**:
  > *"BrandShield AI runs our extraction model (powered by local Ollama or cloud OpenAI). It parses the natural language copy into atomic, verifiable claims and calculates exact UTF-16 character offsets—with full support for Unicode rupee currency symbols and emoji."*
- **Action**: Click **Verify All Claims**.
- **Expected Outcome**:
  - Claim 1 (*"10% stabilised Vitamin C"*): **SUPPORTED (Low Risk)** backed by approved fact `vitamin_c_concentration` in clinical trial `DG-CT-2025-04`.
  - Claim 2 (*"available for ₹1,999"*): **SUPPORTED (Low Risk)** verified against the active `Festival Glow Launch Offer` promotion.
  - **Publication Gate Status**: Displays **ELIGIBLE FOR PUBLICATION (Passed)** with an unlocked green badge.
- **Presenter Script**:
  > *"Notice how the verification runs with zero LLM hallucinations. The engine deterministically checks catalogue MRP, active promotional windows, and registered clinical endpoints. All claims are supported, and the publication gate is unlocked."*

---

### Step 3: Demonstrate High-Risk Overclaim & Publication Blocking (1:30 – 2:30)
- **Action**:
  1. Close the modal or click **New Submission**.
  2. Select **Scenario B: Misleading Overclaim**.
  3. The text populates with aggressive, non-compliant marketing claims:
     > *"DermaGlow Vitamin C Serum cures eczema permanently overnight and eliminates 100% of wrinkles in 3 minutes! Formulated with 25% Vitamin C for just ₹999."*
  4. Click **Create Submission**.
  5. Click **Extract Claims** $\rightarrow$ Click **Verify All Claims**.
- **Expected Outcome**:
  - *"cures eczema permanently overnight"*: **CONTRADICTED / CRITICAL RISK** (violates dermatological safety policy).
  - *"eliminates 100% of wrinkles in 3 minutes"*: **CONTRADICTED / CRITICAL RISK** (rejected absolute guarantee).
  - *"25% Vitamin C"*: **CONTRADICTED / HIGH RISK** (approved fact is 10%).
  - *"₹999"*: **CONTRADICTED / HIGH RISK** (MSRP is ₹2,499; valid promo price is ₹1,999).
  - **Publication Gate Status**: **BLOCKED (Failed)** with a red locked icon.
- **Presenter Script**:
  > *"Here's where the platform shines. A marketer submitted copy claiming it 'cures eczema permanently overnight' with '25% Vitamin C' at '₹999'.*  
  > *Our deterministic engine immediately catches the violations: 25% contradicts the approved 10% dossier, eczema cure claims violate medical policy, and the price is unauthorized.*  
  > *Crucially, look at the Publication Gate at the top: it is strictly LOCKED. This marketing collateral cannot be published or pushed to social ad managers."*

---

### Step 4: Human Compliance Review & Governance (2:30 – 3:30)
- **URL**: Navigate to `http://localhost:3000/reviews`
- **Action**:
  1. Locate the flagged claims from Scenario B in the reviewer workbench.
  2. Click **Inspect** on the concentration claim (*"25% Vitamin C"*).
  3. Observe the forensic panel:
     - Shows the clinical dossier contradiction.
     - Displays **Suggested Defensible Phrasing**: *"Formulated with 10% stabilised Vitamin C"*.
  4. Attempt to approve the contradicted claim without a reason:
     - The system enforces a **Mandatory Policy Override**: Reviewers must provide a documented reason $\ge 10$ characters before overriding a high-risk violation.
  5. Select **Modify Claim**, enter the recommended 10% phrasing, and submit.
- **Presenter Script**:
  > *"BrandShield AI doesn't just say 'no'—it empowers compliance officers with defensible copy suggestions derived from approved clinical dossiers.*  
  > *Furthermore, human governance is strictly enforced: compliance officers cannot arbitrarily override a critical risk claim without documenting a legally defensible justification for our legal records."*

---

### Step 5: Immutable Audit Trail & System Resilience (3:30 – 4:30)
- **URL**: Navigate to `http://localhost:3000/audit`
- **Action**:
  1. Display the immutable compliance log.
  2. Highlight the audit records generated during the live demo:
     - Submission creation (`submission_created`).
     - AI extraction runs (`claims_extracted`).
     - Verification determinations (`claim_verified`).
     - Human reviewer actions (`review_decision_recorded`).
- **Presenter Script**:
  > *"Every single action—from the AI extraction to the rule evaluation and human reviewer override—is permanently recorded in our PostgreSQL audit trail.*  
  > *In the database, this table is protected by a native trigger that throws an exception on any UPDATE or DELETE query. It is a tamper-evident record ready for FTC or FDA inspection.*  
  > *Finally, our platform is built for resilience. If local Ollama or cloud OpenAI experiences downtime, the system automatically falls back to deterministic extraction without halting production workflows."*

---

## Backup Plan & Troubleshooting Quick Reference

| Issue | Root Cause | Instant Fix / Presenter Action |
| :--- | :--- | :--- |
| **Ollama is not running** | Local Ollama daemon offline | The application automatically falls back to its deterministic mock extractor; no action needed. A badge will indicate fallback mode. |
| **Resetting the Demo State** | User wants a fresh start | Click **Guided Demo** $\rightarrow$ **Reset Demo Experience** in the top navigation banner. This resets client-side view state without altering live database records. |
| **Network latency on Supabase** | Remote database delay | The UI includes responsive skeleton loaders and optimistic updates to preserve smooth visual presentation. |
