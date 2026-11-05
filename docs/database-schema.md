# BrandShield AI — PostgreSQL Database Schema (Phase 5)

## 1. Schema Diagram & Relationships

```
workspaces (1) ────< (N) products (1) ────< (N) approved_facts
   │                        │
   │                        ├────< (N) promotions
   │                        │
   │                        └────< (N) submissions (1) ────< (N) submission_versions (1)
   │                                                                      │
   │                                                                      └────< (N) claims (1) ────< (N) claim_evidence
   │                                                                                   │
   ├────< (N) source_documents (1) ────< (N) document_versions (1)                     ├────< (N) verification_runs
   │                                              │                                    └────< (N) review_decisions
   │                                              └────< (N) document_chunks
   │
   └────< (N) audit_events (Append-only, immutable)
```

## 2. Table Catalog

### `workspaces`
- `id` (UUID PK): Unique workspace identifier.
- `name` (TEXT): Display name (`DermaGlow`).
- `slug` (TEXT UNIQUE): URL-safe unique slug (`dermaglow`).
- `created_at`, `updated_at` (TIMESTAMPTZ).

### `products`
- `id` (UUID PK): Product identifier.
- `workspace_id` (UUID FK -> `workspaces.id` ON DELETE CASCADE).
- `name` (TEXT): Product name (`DermaGlow Vitamin C Serum`).
- `sku` (TEXT UNIQUE): Unique Stock Keeping Unit (`DG-VTC-001`).
- `description` (TEXT): Clinical formulation summary.
- `category` (TEXT): Product classification (`Facial Serums & Antioxidants`).
- `reference_price` (NUMERIC(12,2)): Base catalog MRP (`2499.00`).
- `currency` (TEXT): Currency code (`INR`).
- `status` (TEXT): `active` | `archived` | `draft`.
- `created_at`, `updated_at` (TIMESTAMPTZ).

### `approved_facts`
- `id` (UUID PK): Ground-truth fact record.
- `product_id` (UUID FK -> `products.id` ON DELETE CASCADE).
- `fact_key` (TEXT): Unique fact identifier (e.g. `vitamin_c_concentration`, `reference_price`, `product_status`, `dermatological_safety`).
- `fact_value` (JSONB): Structured payload (e.g. `{"concentration": "10%", "ingredient": "L-Ascorbic Acid"}`).
- `fact_type` (TEXT): `ingredient_specification` | `pricing_catalogue` | `safety_claim`.
- `approval_status` (TEXT): `approved` | `pending` | `rejected` | `superseded`.
- `source_document_id` (UUID FK -> `source_documents.id` ON DELETE SET NULL).
- `valid_from` (TIMESTAMPTZ): Start of fact validity.
- `valid_until` (TIMESTAMPTZ NULL): Expiration timestamp.

### `promotions`
- `id` (UUID PK): Promotional discount record.
- `product_id` (UUID FK -> `products.id` ON DELETE CASCADE).
- `promotion_name` (TEXT): Campaign name (`Festival Glow Launch Offer`).
- `discount_type` (TEXT): `fixed` | `percentage` | `bundle`.
- `discount_value` (NUMERIC(12,2)): Discount magnitude (`500.00`).
- `resulting_price` (NUMERIC(12,2)): Net discounted promotional price (`1999.00`).
- `currency` (TEXT): `INR`.
- `start_date` (TIMESTAMPTZ): Promotion launch window.
- `end_date` (TIMESTAMPTZ): Promotion conclusion window (inclusive through 23:59:59 UTC).
- `applicable_channels` (JSONB/TEXT[]): Array of authorized channels (`["Instagram", "DTC Website", "Meta Ads"]`).
- `terms` (TEXT): Regulatory promotional disclaimer.
- `status` (TEXT): `active` | `expired` | `cancelled`.

### `source_documents`
- `id` (UUID PK): Clinical study or compliance document header.
- `workspace_id` (UUID FK -> `workspaces.id` ON DELETE CASCADE).
- `title` (TEXT): Document title (`DG-CT-2025-04 Double-Blind Efficacy Study`).
- `document_type` (TEXT): `clinical_study` | `regulatory_dossier` | `spec_sheet`.
- `current_version_id` (UUID FK -> `document_versions.id` ON DELETE SET NULL).
- `approval_status` (TEXT): `approved` | `draft` | `superseded` | `archived`.
- `valid_from`, `valid_until` (TIMESTAMPTZ).

### `document_versions`
- `id` (UUID PK): Immutable document version revision.
- `document_id` (UUID FK -> `source_documents.id` ON DELETE CASCADE).
- `version_number` (INT): Sequential version integer (e.g. 1).
- `storage_path` (TEXT NULL): Supabase Storage object pointer.
- `extracted_text` (TEXT NULL): Full parsed text.
- `valid_from`, `valid_until` (TIMESTAMPTZ).
- `is_current` (BOOLEAN DEFAULT true).

### `claims`
- `id` (UUID PK): Extracted assertion.
- `submission_id` (UUID FK -> `submissions.id` ON DELETE CASCADE).
- `submission_version_id` (UUID FK -> `submission_versions.id` ON DELETE CASCADE).
- `extraction_run_id` (UUID FK -> `extraction_runs.id` ON DELETE SET NULL): Provenance link.
- `claim_text` (TEXT): Verbatim substring from marketing content.
- `claim_type` (TEXT): Closed enum: `price`, `discount`, `product_attribute`, `efficacy`, `guarantee`, `comparative`, `clinical`, `availability`, `promotional`, `other`.
- `text_start` (INT): Zero-based UTF-16 character start index.
- `text_end` (INT): Zero-based UTF-16 character end index.
- `product_id` (UUID FK -> `products.id` ON DELETE SET NULL): Normalized product association.
- `extracted_entities` (JSONB): Structured entities (ingredient, concentration, price, timeline, etc.).
- `extraction_confidence` (NUMERIC(4,3)): AI extraction confidence score.
- `verification_status` (TEXT): `supported` | `contradicted` | `outdated` | `unverified` | `needs_review`.
- `risk_level` (TEXT NULL): Added in Phase 5: `low` | `medium` | `high` | `critical`.
- `verified_at` (TIMESTAMPTZ NULL): Added in Phase 5: timestamp of most recent verification.
- `is_active` (BOOLEAN DEFAULT true): Indicates current active claims for a version.
- `explanation` (TEXT NULL): Rationale for verification determination.
- `suggested_correction` (TEXT NULL): Defensible alternative copy.

### `claim_evidence`
- `id` (UUID PK): Direct link between verified claim and approved evidence.
- `claim_id` (UUID FK -> `claims.id` ON DELETE CASCADE).
- `approved_fact_id` (UUID FK -> `approved_facts.id` ON DELETE SET NULL).
- `document_version_id` (UUID FK -> `document_versions.id` ON DELETE SET NULL).
- `evidence_excerpt` (TEXT): Verbatim citation snippet.
- `relevance_score` (NUMERIC(4,3)): Evidentiary match score (0.0 to 1.0).
- `created_at` (TIMESTAMPTZ DEFAULT now()).

### `verification_runs`
- `id` (UUID PK): Immutable run execution log.
- `claim_id` (UUID FK -> `claims.id` ON DELETE CASCADE).
- `engine_version` (TEXT): Verification pipeline build version (`1.0.0`).
- `verification_status` (TEXT): Determination status.
- `risk_level` (TEXT): `low` | `medium` | `high` | `critical`.
- `explanation` (TEXT): Determination explanation.
- `evidence_snapshot` (JSONB): Complete frozen state of matched evidence, product metadata, and rules at the exact millisecond of verification.
- `created_at` (TIMESTAMPTZ DEFAULT now()).

### `review_decisions`
- `id` (UUID PK): Human reviewer sign-off.
- `claim_id` (UUID FK -> `claims.id` ON DELETE CASCADE).
- `reviewer_id` (TEXT): Reviewer user identifier.
- `decision` (TEXT): `approved` | `rejected` | `escalated` | `modified`.
- `comments` (TEXT): Regulatory sign-off notes.

### `audit_events`
- `id` (UUID PK): Append-only audit record.
- `workspace_id` (UUID FK -> `workspaces.id` ON DELETE CASCADE).
- `actor_id` (TEXT): User or system component initiating change (`verification_engine`).
- `entity_type` (TEXT): `workspace` | `submission` | `claim` | `source_document`.
- `entity_id` (TEXT): Target entity UUID.
- `action` (TEXT): Action performed (e.g. `claim_verified`, `submission_created`).
- `before_state`, `after_state` (JSONB): Snapshot diff.
- `created_at` (TIMESTAMPTZ DEFAULT now()).
- **Immutability Enforcement**: Protected by trigger `trg_audit_events_immutable` preventing all UPDATE and DELETE commands.
