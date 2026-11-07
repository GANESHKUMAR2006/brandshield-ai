# BrandShield AI — Phase 19: Staging Deployment & Infrastructure Plan

**Application**: BrandShield AI  
**Release Target**: v1.0.0 RC-1  
**Environment**: Isolated Staging  
**Date**: November 7, 2026  
**Auditor & Deployment Engineer**: Senior Full-Stack Engineer, PostgreSQL DBA & System Architect

---

## 1. Pre-Deployment Baseline & Audit Confirmation

Before preparing staging deployment assets, the release baseline established in Phase 18 was audited:

- **Application Version**: Confirmed `1.0.0` in `package.json`, `CHANGELOG.md`, and health telemetry.
- **Production Build Status**: Verified clean build (`npm run build` compiled in 4.2s with Turbopack, generating all 25 routes).
- **TypeScript & Lint Quality**: `npx tsc --noEmit` (**0 errors**) and `npm run lint` (**0 errors, 0 warnings**).
- **Automated Test Baseline**: `npm test` passing **116 unit test assertions** offline with zero live database mutations.
- **Secrets & Git Hygiene**: Verified `.env.local` is ignored in `.gitignore`; no API keys or database passwords are tracked in Git.

---

## 2. Staging Infrastructure Architecture

To ensure authentic pre-production validation without risking production data or confusing demo states, the staging environment enforces strict architectural isolation:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      Staging Web Runtime                               │
│              Platform: Vercel / AWS ECS Container                      │
│     • Next.js 16.4.5 (App Router, Server Actions, Dynamic Routes)      │
│     • Domain: https://staging.brandshield-ai.internal (HTTPS Enforced) │
│     • Dedicated Staging Environment Variables                          │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
┌───────────────────────────────────┐   ┌────────────────────────────────┐
│   Isolated Staging Supabase DB    │   │   Staging AI Inference Host    │
│   • Separate PostgreSQL 17 Cluster│   │   • Cloud OpenAI (gpt-4o-mini) │
│   • Staging Workspace: DermaGlow  │   │     OR Dedicated Cloud vLLM    │
│   • Staging Credentials & URL     │   │   • Bounded HTTP Timeouts (5s) │
│   • Zero Shared Production Data   │   │   • Fallback Mock Enabled      │
└───────────────────────────────────┘   └────────────────────────────────┘
```

### Hosting Justification
1. **Next.js 16 App Router on Vercel / Containerized Node 20**:
   - Next.js 16 App Router requires Node.js `>= 20.x` and support for React 19 Server Components and dynamic route handlers.
   - Vercel or an AWS ECS container running `next start` provides native streaming SSR, server action execution, and automated SSL/TLS termination.
2. **Dedicated Staging Supabase Project**:
   - **Strict Isolation Rule**: Under no circumstances will the staging web app connect to the existing live Supabase database (`db.ref.supabase.co`).
   - Staging requires an independent Supabase project with its own database credentials, storage buckets, and RLS policies.
3. **Cloud AI Inference Network Accessibility**:
   - A local Ollama daemon running on a developer machine (`http://localhost:11434`) is **not reachable** from cloud runtimes without an active ngrok/Cloudflare tunnel or private VPN.
   - For staging, `LLM_PROVIDER` must be configured to cloud OpenAI (`gpt-4o-mini`) or a cloud vLLM endpoint with an explicitly supplied API key.

---

## 3. Staging Environment Configuration Matrix

The staging environment requires dedicated configuration variables:

```env
# Application Settings (Staging)
NEXT_PUBLIC_APP_NAME="BrandShield AI (Staging)"
NEXT_PUBLIC_APP_URL="https://staging.brandshield-ai.internal"
NEXT_PUBLIC_APP_ENV="staging"
NEXT_PUBLIC_DEFAULT_WORKSPACE="DermaGlow"

# Staging Supabase Project (Strictly Isolated from Production)
NEXT_PUBLIC_SUPABASE_URL="https://staging-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_staging_anon_placeholder"
SUPABASE_DATABASE_URL="postgresql://postgres:[password]@db.staging-ref.supabase.co:5432/postgres"

# Staging AI Provider (Cloud Inference)
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-staging-openai-key-placeholder"
OPENAI_MODEL="gpt-4o-mini"
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
```

---

## 4. Staging Deployment Execution Sequence

1. **Step 1: Staging Database Provisioning**:
   - Create fresh staging Supabase project.
   - Apply migrations 1 through 6 sequentially.
   - Seed baseline DermaGlow workspace, products, and approved clinical trial facts (`seed.sql`).
2. **Step 2: Secrets Configuration**:
   - Inject staging variables into hosting environment secret store (Vercel Project Settings or AWS Secrets Manager).
3. **Step 3: Build & Deploy**:
   - Execute production build: `npm run build`.
   - Deploy bundle to staging runtime.
4. **Step 4: Automated Smoke Testing**:
   - Execute the 12-category staging smoke-test checklist ([`docs/production-smoke-tests.md`](docs/production-smoke-tests.md)).
   - Verify `/api/health` returns HTTP 200 with `services.database.status: "connected"`.
