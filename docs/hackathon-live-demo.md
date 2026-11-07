# BrandShield AI — 3-Minute Live Hackathon Demonstration Script

> **Target Duration**: Exactly 3 Minutes (180 Seconds)  
> **Presenter Persona**: Senior Full-Stack Engineer / Technical Co-Founder  
> **Demo URL**: `http://localhost:3000`  
> **Target Enterprise Organization**: DermaGlow Skincare (Cosmetics & Wellness)

---

## Live Demo Timeline Summary

```text
[0:00 - 0:25]  Introduction & Problem Framing       (Dashboard Overview)
[0:25 - 1:05]  Compliant Launch & Auto-Verification (Scenario A -> Extracted -> ELIGIBLE)
[1:05 - 1:45]  High-Risk Violation & Gate Locking   (Scenario B -> Contradicted -> LOCKED)
[1:45 - 2:25]  Human Review & Override Governance   (Review Workbench -> Defensible Phrasing)
[2:25 - 2:50]  Tamper-Evident Auditability          (Audit Log -> DB Trigger Immutability)
[2:50 - 3:00]  Closing Value Proposition            (Summary & Q&A Transition)
```

---

## Detailed Step-by-Step Demonstration Script

### Segment 1: Introduction & Problem Framing (0:00 – 0:25)
- **Starting Screen**: `http://localhost:3000/dashboard`
- **Actions in UI**:
  - Show the Executive Compliance Dashboard.
  - Hover over the **Compliance Rate (84%)** and **Active Claims (24)** metric cards.
  - Click the **Health Diagnostics** button in the top navigation bar to open the telemetry modal; show live PostgreSQL connection and Ollama reachability.
- **Spoken Script**:
  > *"Judges, in regulated consumer industries like skincare and wellness, marketing copy is under continuous scrutiny from regulators like the FTC and FDA. A single unsubstantiated claim—such as an exaggerated concentration or an unauthorized medical promise—risks millions in fines and retailer delisting.*  
  > *Marketing moves at the speed of social media, but legal review takes weeks. BrandShield AI bridges that gap by combining AI claim extraction with deterministic, evidence-linked verification and an enforced publication gate."*

---

### Segment 2: Compliant Launch & Auto-Verification (0:25 – 1:05)
- **Navigation**: Click **Submissions** in the sidebar navigation (`/submissions`).
- **Actions in UI**:
  1. Click **New Submission** to open the creation modal.
  2. Click **Scenario A: Compliant Launch** (pre-fills DermaGlow Vitamin C copy with approved 10% concentration and ₹1,999 launch price).
  3. Click **Create Submission**. The submission inspector modal opens automatically.
  4. Click **Extract Claims**.
  5. Point out the extracted claims and exact UTF-16 character offsets on screen.
  6. Click **Verify All Claims**.
- **Expected Visual Result**:
  - Claim 1 (*"10% stabilised Vitamin C"*): **SUPPORTED (Low Risk)** backed by approved fact in clinical trial `DG-CT-2025-04`.
  - Claim 2 (*"available for ₹1,999"*): **SUPPORTED (Low Risk)** verified against the active `Festival Glow Launch Offer`.
  - **Publication Gate Status**: Displays **ELIGIBLE FOR PUBLICATION (Passed)** with an unlocked green badge.
- **Spoken Script**:
  > *"Let's test an ad variant. In our submission creator, we load an approved campaign for the DermaGlow Vitamin C Serum. Our model extracts atomic assertions and calculates exact UTF-16 character offsets—handling Unicode currency and emoji.*  
  > *When we click Verify, our deterministic engine compares the claims against approved clinical trial dossiers and promotional pricing. There are zero LLM hallucinations in the verdict. Both claims are supported, and the publication gate is unlocked."*

---

### Segment 3: High-Risk Violation & Gate Locking (1:05 – 1:45)
- **Actions in UI**:
  1. Close the current modal or click **New Submission** again.
  2. Click **Scenario B: Misleading Overclaim**.
  3. Show the aggressive copy: *"DermaGlow Vitamin C Serum cures eczema permanently overnight and eliminates 100% of wrinkles in 3 minutes! Formulated with 25% Vitamin C for just ₹999."*
  4. Click **Create Submission** $\rightarrow$ Click **Extract Claims** $\rightarrow$ Click **Verify All Claims**.
- **Expected Visual Result**:
  - *"cures eczema permanently overnight"*: **CONTRADICTED (Critical Risk)** — violates dermatological safety policy.
  - *"eliminates 100% of wrinkles in 3 minutes"*: **CONTRADICTED (Critical Risk)** — rejected absolute guarantee.
  - *"25% Vitamin C"*: **CONTRADICTED (High Risk)** — approved formula is 10%.
  - *"₹999"*: **CONTRADICTED (High Risk)** — valid launch price is ₹1,999.
  - **Publication Gate Status**: **LOCKED (Blocked)** with a prominent red badge.
- **Spoken Script**:
  > *"Now, look what happens when a marketer submits an aggressive overclaim. The copy promises an 'overnight eczema cure', 'eliminates 100% of wrinkles', and quotes an unauthorized ₹999 price.*  
  > *Our deterministic engine flags these immediately: eczema cure claims violate medical regulations, 25% contradicts the approved 10% dossier, and the price is unapproved.*  
  > *Crucially, notice the Publication Gate at the top: it is strictly LOCKED. This marketing copy cannot be published or exported to ad managers."*

---

### Segment 4: Human Governance & Defensible Phrasing (1:45 – 2:25)
- **Navigation**: Click **Reviews** in the sidebar navigation (`/reviews`).
- **Actions in UI**:
  1. Locate the flagged claims in the compliance review table.
  2. Click **Inspect** on the concentration claim (*"25% Vitamin C"*).
  3. Highlight the forensic panel:
     - Shows the clinical dossier contradiction.
     - Displays **Suggested Defensible Phrasing**: *"Formulated with 10% stabilised Vitamin C"*.
  4. Attempt to approve the contradicted claim without an override reason: show the validation alert requiring a **Mandatory Policy Override justification ($\ge 10$ characters)**.
  5. Select **Modify Claim**, apply the suggested 10% phrasing, and submit.
- **Spoken Script**:
  > *"BrandShield AI doesn't just say 'no'—it empowers compliance officers with defensible copy suggestions derived from approved clinical dossiers.*  
  > *Human governance is strictly enforced: compliance reviewers cannot arbitrarily override a high-risk violation without documenting a legally defensible justification for corporate legal records."*

---

### Segment 5: Tamper-Evident Auditability (2:25 – 2:50)
- **Navigation**: Click **Audit Trail** in the sidebar navigation (`/audit`).
- **Actions in UI**:
  - Show the chronological event stream displaying `submission_created`, `claims_extracted`, `claim_verified`, and `review_decision_recorded`.
  - Point to the actor attribution and immutable timestamps.
- **Spoken Script**:
  > *"Every single action—from AI extraction to rule verification and reviewer overrides—is logged to our PostgreSQL audit trail.*  
  > *At the database layer, this table is protected by a native trigger that throws an exception on any UPDATE or DELETE query. It is a permanent, tamper-evident record ready for FTC or FDA inspection."*

---

### Segment 6: Closing Value Proposition (2:50 – 3:00)
- **Ending Screen**: Return to `/dashboard` or open **Presenter View**.
- **Spoken Script**:
  > *"BrandShield AI gives enterprise marketing teams the speed to compete, and gives compliance officers the certainty they require. Trust before publication. Thank you."*

---

## Presenter Operational & Fallback Guide

| Operational Scenario | Underlying Root Cause | Safe Presenter Action (Never Pretend False Success) |
| :--- | :--- | :--- |
| **Ollama Service Offline** | Local Ollama daemon not running on port `11434` | The platform automatically falls back to its deterministic mock extractor. Explain: *"Our platform is built for resilience; since local Ollama is offline, the system safely engages its deterministic offline mock provider without halting the workflow."* |
| **Supabase Remote Latency** | Network delay to remote PostgreSQL host | The UI displays skeleton states and optimistic badge updates. If queries timeout, the system displays descriptive error banners without corrupting local state. |
| **Resetting the Demo** | Evaluator requests to see the workflow again | Click **Guided Demo** in the top navigation and select **Reset Demo Experience**. This resets local client view states cleanly without deleting live database records. |
