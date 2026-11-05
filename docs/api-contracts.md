# BrandShield AI — API Contracts (Phase 5)

## 1. System Health & Diagnostic Endpoint

### `GET /api/health`
Evaluates application runtime readiness and tests Supabase database connectivity.

#### Success Response (`200 OK`):
```json
{
  "status": "ok",
  "application": "BrandShield AI",
  "version": "1.0.0",
  "database": {
    "status": "connected",
    "latencyMs": 42
  },
  "timestamp": "2026-11-05T14:45:00.000Z"
}
```

---

## 2. Phase 5 Deterministic Verification Endpoints

### A. Verify Single Claim
- **Endpoint**: `POST /api/claims/[id]/verify`
- **Description**: Deterministically verifies a single extracted claim against approved catalogue facts, promotional price rules, and clinical trial evidence.
- **Request Body**: Empty or `{}`
- **Success Response (`200 OK`)**:
```json
{
  "data": {
    "runId": "4c24d078-8d29-4b37-8a43-cb1bad738ccf",
    "claimId": "00000000-0000-0000-0000-000000000203",
    "status": "supported",
    "riskLevel": "low",
    "explanation": "Advertised concentration of 10% Vitamin C matches approved product specification (10%).",
    "suggestedCorrection": null,
    "evidenceSufficiency": "sufficient",
    "evidenceCount": 1,
    "evidence": [
      {
        "approvedFactId": "00000000-0000-0000-0000-000000000011",
        "evidenceType": "approved_fact",
        "evidenceExcerpt": "Approved fact (vitamin_c_concentration): DermaGlow Vitamin C Serum contains precisely 10% stabilised L-Ascorbic Acid.",
        "relevanceScore": 1.0
      }
    ],
    "verifiedAt": "2026-11-05T16:51:25.000Z"
  }
}
```
- **Error Response (`404 Not Found`)**:
```json
{
  "error": "Active claim \"uuid\" not found in DermaGlow workspace."
}
```

### B. Verify Submission Claims (Batch)
- **Endpoint**: `POST /api/submissions/[id]/verify`
- **Description**: Executes deterministic claim verification across all active extracted claims for a marketing submission version in an atomic transaction.
- **Request Body**: Empty or `{}`
- **Success Response (`200 OK`)**:
```json
{
  "data": [
    {
      "runId": "run-uuid-1",
      "claimId": "claim-uuid-1",
      "status": "supported",
      "riskLevel": "low",
      "explanation": "Advertised concentration matches approved specification.",
      "suggestedCorrection": null,
      "evidenceSufficiency": "sufficient",
      "evidenceCount": 1,
      "verifiedAt": "2026-11-05T16:51:25.000Z"
    },
    {
      "runId": "run-uuid-2",
      "claimId": "claim-uuid-2",
      "status": "contradicted",
      "riskLevel": "high",
      "explanation": "Advertised price of ₹999 contradicts approved catalogue pricing (MRP ₹2,499).",
      "suggestedCorrection": "Festival launch price of ₹1,999 (Regular MRP ₹2,499)",
      "evidenceSufficiency": "sufficient",
      "evidenceCount": 1,
      "verifiedAt": "2026-11-05T16:51:25.000Z"
    }
  ]
}
```

---

## 3. Claim Registry & Audit Endpoints

### A. List Claims Ledger
- **Endpoint**: `GET /api/claims`
- **Query Parameters**:
  - `status`: Filter by verification status (`supported`, `contradicted`, `outdated`, `unverified`, `needs_review`)
  - `risk`: Filter by risk level (`low`, `medium`, `high`, `critical`)
  - `type`: Filter by claim type (`price`, `product_attribute`, etc.)
  - `search`: Case-insensitive substring query on claim text or product name
- **Response (`200 OK`)**:
```json
{
  "data": [
    {
      "id": "claim-uuid",
      "claim_text": "Contains 10% stabilised Vitamin C",
      "claim_type": "product_attribute",
      "verification_status": "supported",
      "risk_level": "low",
      "verified_at": "2026-11-05T16:51:25.000Z",
      "evidence_count": 1,
      "extraction_confidence": 0.98,
      "product_name": "DermaGlow Vitamin C Serum",
      "product_sku": "DG-VTC-001",
      "submission_title": "DermaGlow Instagram Campaign",
      "submission_channel": "instagram"
    }
  ]
}
```

### B. Single Claim Details & Verification Provenance
- **Endpoint**: `GET /api/claims/[id]`
- **Response (`200 OK`)**:
```json
{
  "data": {
    "id": "claim-uuid",
    "claim_text": "Contains 10% stabilised Vitamin C",
    "claim_type": "product_attribute",
    "text_start": 0,
    "text_end": 32,
    "verification_status": "supported",
    "risk_level": "low",
    "verified_at": "2026-11-05T16:51:25.000Z",
    "explanation": "Advertised concentration of 10% matches approved specification.",
    "suggested_correction": null,
    "version_content": "Contains 10% stabilised Vitamin C for luminous skin.",
    "evidence": [
      {
        "id": "evidence-uuid",
        "evidence_type": "approved_fact",
        "evidence_excerpt": "Approved fact (vitamin_c_concentration): DermaGlow Vitamin C Serum contains precisely 10% stabilised L-Ascorbic Acid.",
        "relevance_score": 1.0,
        "fact_key": "vitamin_c_concentration"
      }
    ],
    "verification_history": [
      {
        "id": "run-uuid",
        "engine_version": "1.0.0",
        "verification_status": "supported",
        "risk_level": "low",
        "explanation": "Advertised concentration of 10% matches approved specification.",
        "created_at": "2026-11-05T16:51:25.000Z"
      }
    ]
  }
}
```

---

## 4. Verification Status Enums & Risk Matrix

| Status | Evidentiary Pre-Condition | Risk Levels Possible |
|---|---|---|
| `supported` | Direct approved fact, active promotion, or clinical endpoint matches assertion | `low` |
| `contradicted` | Authoritative approved evidence explicitly conflicts with assertion | `high`, `critical` |
| `outdated` | Evidence was valid historically but is expired or superseded | `medium` |
| `unverified` | Absence of corroborating evidence in library (Never contradicted on absence) | `low` |
| `needs_review` | Conflicting facts, ambiguous product, comparative, absolute guarantee | `medium`, `high`, `critical` |
