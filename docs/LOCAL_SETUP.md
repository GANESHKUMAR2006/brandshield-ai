# BrandShield AI — Local Development & Environment Setup Guide

This guide walks you through setting up a complete, working local development instance of **BrandShield AI** from scratch.

---

## Quick Reference Checklist

- [ ] Node.js `>= 20.x` or `>= 22.x` (LTS) installed
- [ ] Git installed and repository cloned
- [ ] Dependencies installed via `npm install`
- [ ] Supabase project created with PostgreSQL 17
- [ ] `pgvector` extension enabled in Supabase
- [ ] `.env.local` configured from `.env.example`
- [ ] Database migrations and seed applied (`npm run db:seed`)
- [ ] Verified reviewer accounts seeded (`npm run db:seed:auth`)
- [ ] Groq API key configured (or `LLM_PROVIDER="mock"` for offline testing)
- [ ] Development server running (`npm run dev`) at `http://localhost:3000`

---

## Step 1: System Prerequisites

Before starting, ensure your local workstation meets the following runtime requirements:

| Component | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.9.0` | `v22.x` LTS | Required for Next.js 16 and native ES modules |
| **npm** | `v10.1.0` | `v10.x` | Bundled with Node.js |
| **Git** | `v2.40.0+` | Latest | Version control |
| **Operating System** | Windows 10/11, macOS, Linux | Any | Cross-platform compatible |

Verify your installed versions:
```bash
node -v
npm -v
git --version
```

---

## Step 2: Clone the Repository

Clone the official BrandShield AI repository from GitHub:

```bash
git clone https://github.com/GANESHKUMAR2006/brandshield-ai.git
cd brandshield-ai
```

Verify you are on the `main` branch:
```bash
git status
```

---

## Step 3: Install Node.js Dependencies

Install the project dependencies using `npm install`:

```bash
npm install
```

> **Note on Peer Dependencies:** Next.js 16 with React 19 and Tailwind CSS v4 are fully configured in `package.json`. No `--force` or `--legacy-peer-deps` flags are required.

---

## Step 4: Supabase Cloud Database Provisioning

BrandShield AI uses Supabase PostgreSQL 17 with the `pgvector` extension for tenant isolation, evidentiary RAG embeddings, and audit logging.

### 4.1 Create a New Supabase Project
1. Log in to [Supabase Dashboard](https://database.new) or sign up for a free account.
2. Click **New Project**.
3. Choose your organization, assign a project name (e.g. `brandshield-dev`), and choose a geographic region close to you.
4. Set a strong **Database Password** and save it securely.
5. Click **Create new project** and wait ~2 minutes for provisioning to finish.

### 4.2 Obtain Connection Details
Navigate to **Project Settings** (gear icon in the sidebar):

1. **API Keys (Project Settings $\rightarrow$ API):**
   - **Project URL:** Copy the URL (e.g., `https://abcdefghijklmno.supabase.co`).
   - **anon / public key:** Copy the `anon` JWT token.
2. **Database Connection URI (Project Settings $\rightarrow$ Database):**
   - Scroll down to **Connection String**.
   - Select the **URI** tab.
   - Choose **Session Mode (port 5432)** or **Transaction Mode (port 6543)**.
   - The connection string looks like:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmno.supabase.co:5432/postgres
     ```
   - Replace `[YOUR-PASSWORD]` with the actual database password you created in step 4.1.

### 4.3 Enable PostgreSQL Extensions
Open the **SQL Editor** in your Supabase Dashboard and run:

```sql
-- Enable pgvector for 1536-dimensional evidence embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generator functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 4.4 Create Storage Bucket (Optional)
If you plan to test raw evidence file uploads to Supabase Storage:
1. Navigate to **Storage** in the Supabase Dashboard.
2. Click **New Bucket**.
3. Bucket Name: `evidence`
4. Set Public bucket to **OFF** (Keep it private; RLS policies govern document access).
5. Click **Save bucket**.

---

## Step 5: Configure Local Environment Variables

Duplicate the provided `.env.example` file to create `.env.local`:

```bash
cp .env.example .env.local
```

Open `.env.local` in your code editor and populate your credentials:

```env
# ==============================================================================
# Application Settings
# ==============================================================================
NEXT_PUBLIC_APP_NAME="BrandShield AI"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_ENV="development"
NEXT_PUBLIC_DEFAULT_WORKSPACE="DermaGlow"

# ==============================================================================
# Supabase Client Credentials (Browser Safe)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmno.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."

# ==============================================================================
# Server-Side Database Connection Pool (STRICTLY PRIVATE)
# ==============================================================================
SUPABASE_DATABASE_URL="postgresql://postgres:YourSecurePassword@db.abcdefghijklmno.supabase.co:5432/postgres"

# ==============================================================================
# Showcase & Persona Quick-Login
# ==============================================================================
ALLOW_DEMO_AUTH="true"

# ==============================================================================
# AI Extraction Provider (Groq Cloud)
# ==============================================================================
LLM_PROVIDER="groq"
GROQ_API_KEY="gsk_your_actual_groq_api_key"
GROQ_MODEL="openai/gpt-oss-20b"
GROQ_BASE_URL="https://api.groq.com/openai/v1"

# ==============================================================================
# RAG Vector Embedding Provider
# ==============================================================================
# Use "mock" for local development without OpenAI costs.
# Set to "openai" with OPENAI_API_KEY for live production embeddings.
EMBEDDING_PROVIDER="mock"

# ==============================================================================
# Transactional Email (Optional for Local Dev)
# ==============================================================================
EMAIL_PROVIDER="gmail"
EMAIL_FROM="BrandShield AI <noreply@brandshield.ai>"
QA_EMAIL_CAPTURE="true"
```

> [!TIP]
> **Free Groq API Key:** You can generate a free, high-speed Groq API key in 30 seconds at [console.groq.com/keys](https://console.groq.com/keys).

---

## Step 6: Apply Database Migrations and Seed Data

BrandShield AI includes automated migration runners that connect to your Supabase PostgreSQL instance via `SUPABASE_DATABASE_URL`, execute all 16 schema migrations in transactional order, apply the demonstration seed dataset, and initialize the immutable audit trigger.

### 6.1 Run Schema Migrations and Core Seed

For a fresh development environment, execute the combined migration and seed runner:

```bash
npm run db:seed
```

> [!NOTE]
> **Migrations Only (No Seeding):** If you are updating an existing database or deploying to staging/production without inserting mock records, apply pending schema migrations without seeding:
> ```bash
> node --env-file=.env.local scripts/apply-pending-migrations.js
> ```

**Expected Terminal Output for `npm run db:seed`:**
```text
[1/4] Connecting to Supabase PostgreSQL database...
✓ Successfully connected to PostgreSQL.
[2/4] Checking 16 schema migration(s)...
  - [APPLYING] Migration: 20261105000000_initial_schema.sql...
  ✓ Applied migration: 20261105000000_initial_schema.sql
  - [APPLYING] Migration: 20261105010000_phase3_submissions_enhancements.sql...
  ✓ Applied migration: 20261105010000_phase3_submissions_enhancements.sql
  ...
  ✓ Applied migration: 20261117000000_custom_roles_and_permissions.sql
✓ All schema migrations up to date.
[3/4] Applying seed data: seed.sql...
✓ Seed data executed successfully.
[4/4] Verifying database tables and record counts...
  - workspaces          : 1 records
  - products            : 1 records
  - approved_facts      : 4 records
  - promotions          : 2 records
  - source_documents    : 2 records
  ...
✓ Seed idempotency verified: DermaGlow workspace count is strictly 1.
✓ Audit event protection verified: UPDATE blocked with: "Audit events are immutable and cannot be updated or deleted."

🎉 Phase 3 Database Setup & Verification Completed Successfully!
```

### 6.2 Seed Verified Reviewer Accounts (Local Development Only)
Next, seed the verified reviewer accounts into Supabase Auth (`auth.users` and `auth.identities`):

```bash
npm run db:seed:auth
```

> [!CAUTION]
> **Production Security Warning:** The `BrandShield2026!` credentials and evaluator personas are strictly for local development and offline review. **Never run `npm run db:seed:auth` against a production database.** Set `ALLOW_DEMO_AUTH="false"` in production.

This creates the three official enterprise personas with pre-confirmed email addresses and workspace memberships:

| Persona | Email | Password | Role | Organization |
| :--- | :--- | :--- | :--- | :--- |
| **Compliance Reviewer** | `elena.vance@dermaglow.com` | `BrandShield2026!` | `compliance_reviewer` | DermaGlow |
| **Legal Counsel** | `marcus.brody@dermaglow.com` | `BrandShield2026!` | `legal_reviewer` | DermaGlow |
| **Workspace Administrator** | `admin@dermaglow.com` | `BrandShield2026!` | `admin` | DermaGlow |

---

## Step 7: Verify Database Connectivity

Run the automated connection verification script to confirm pool connectivity and latency:

```bash
npm run test:db
```

Expected output:
```text
✓ PostgreSQL connection established successfully.
✓ Query execution latency: ~80ms
✓ Database version: PostgreSQL 17.x on x86_64
```

---

## Step 8: Start the Local Development Server

Start the Next.js development server with Turbopack:

```bash
npm run dev
```

The application will start on `http://localhost:3000`.

Open [http://localhost:3000](http://localhost:3000) in your browser:
- You will be redirected to `/dashboard`.
- If unauthenticated, click **Sign In** in the top navigation or navigate to `/login`.
- Log in with `admin@dermaglow.com` and `BrandShield2026!`.
- The interactive guided tour modal will appear to guide you through the 7-step governance lifecycle.

---

## Step 9: Run Automated Verification Tests

Verify that all system invariants, deterministic verification rules, and multi-tenant security gates pass on your local machine:

> [!IMPORTANT]
> **Test Database Safety Notice:**
> - `npm test` runs 100% in-memory (Phase 15, Phase 6, Phase 10D). It requires no database connection and modifies zero data.
> - Database-dependent suites (`test-workspace-membership-regression.ts`, `npm run test:db`, `npm run test:phase5`) connect to the database configured in `.env.local` (`SUPABASE_DATABASE_URL`).
> - **Never** point `SUPABASE_DATABASE_URL` to a production database while running test scripts.

```bash
# 1. Type Safety Check (0 errors)
npx tsc --noEmit

# 2. Workspace & Membership Regression Suite (22/22 passing)
npx tsx --env-file=.env.local scripts/test-workspace-membership-regression.ts

# 3. Core Workflow Invariants (114/114 passing)
npm test

# 4. Production Build Test (Compiles all 50 routes)
npm run build
```

---

## Step 10: Troubleshooting Common Local Setup Issues

### Issue 1: `Missing Supabase configuration` Error
**Symptom:** API routes or tests return `Error: Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`  
**Fix:** Ensure your `.env.local` file exists in the project root (not in `src/`) and contains valid non-empty values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Issue 2: PostgreSQL Connection Refused / Timeout
**Symptom:** `npm run db:seed` hangs or emits `ETIMEDOUT` or `ECONNREFUSED`.  
**Fix:**
1. Check that you used the correct database password.
2. In Supabase Dashboard, verify under **Project Settings $\rightarrow$ Database** that your project is not paused.
3. If using Supabase Connection Pooler, try switching between Session Mode (port `5432`) and Transaction Mode (port `6543`).

### Issue 3: Port 3000 Already in Use
**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`.  
**Fix:** Run on an alternate port:
```bash
npm run dev -- -p 3001
```

### Issue 4: Groq API Rate Limit (429 Too Many Requests)
**Symptom:** Claim extraction fails with HTTP 429 during heavy batch testing.  
**Fix:** In `.env.local`, temporarily switch to `LLM_PROVIDER="mock"` to run full automated extractions without consuming cloud tokens.

