# BrandShield AI — Production Deployment Guide

> **Operational Warning**:  
> BrandShield AI v1.0.0 is packaged as a release candidate. Local Ollama instances running on developer machines are **not** accessible from public cloud runtimes (e.g. Vercel, AWS ECS) without a secure VPN, reverse proxy, or dedicated cloud GPU instance. Follow the deployment architectures below.

---

## 1. Recommended Deployment Architectures

### Architecture 1: Cloud Production (Recommended for Web Hosting)
- **Web App Hosting**: Vercel, AWS Amplify, or self-hosted Docker container (Node.js 20+).
- **Database**: Managed Supabase PostgreSQL 17 with `pgvector`.
- **AI Extraction**: Cloud OpenAI (`gpt-4o-mini`) via API key or dedicated cloud vLLM endpoint.
- **RAG Embeddings**: Cloud OpenAI `text-embedding-3-small`.

### Architecture 2: Private Air-Gapped Enterprise VPC
- **Web App Hosting**: Docker container running `next start` on AWS ECS or Kubernetes.
- **Database**: Self-hosted PostgreSQL 17 with `pgvector` inside the same VPC.
- **AI Extraction**: Dedicated GPU instance (e.g. AWS `g5.xlarge`) running Ollama or vLLM (`qwen3:4b` or `llama3`) on internal DNS (`http://ollama-internal.vpc:11434/v1`).
- **Data Privacy**: Zero customer marketing text leaves corporate VPC boundaries.

---

## 2. Server & Runtime Requirements

- **Node.js Runtime**: Node.js `>= 20.x` or `>= 22.x` (LTS).
- **Memory**:
  - Web Container: Minimum 1 GB RAM (2 GB recommended).
  - Local Ollama Daemon (if co-located): Minimum 8 GB RAM (16 GB recommended for 4B/8B models).
- **Disk**: 500 MB for application bundle; 10 GB+ if local Ollama models are stored.
- **Network Ports**:
  - `3000`: Next.js web application.
  - `5432`: PostgreSQL database port (outbound to Supabase).
  - `11434`: Ollama HTTP API port (if local provider configured).

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Environment Provisioning
Configure your production secrets in the hosting platform's environment variables dashboard (or `.env.production`):
```env
NEXT_PUBLIC_APP_NAME="BrandShield AI"
NEXT_PUBLIC_APP_URL="https://brandshield.yourdomain.com"
NEXT_PUBLIC_APP_ENV="production"
NEXT_PUBLIC_DEFAULT_WORKSPACE="DermaGlow"

NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_DATABASE_URL="postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres"

# For Cloud AI:
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-your-key"
OPENAI_MODEL="gpt-4o-mini"
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
```

### Step 2: Install Production Dependencies
```bash
npm ci --omit=dev
```
*(Or `npm install` in standard build environments).*

### Step 3: Execute Production Build
```bash
npm run build
```
- Next.js Turbopack compiles server components, client modules, and static assets.
- TypeScript type-checking runs automatically during build.
- Expected output: `✓ Compiled successfully` with `Generating static pages (25/25)`.

### Step 4: Start Production Server
```bash
npm run start
```
By default, the server listens on `http://0.0.0.0:3000`.

---

## 4. Post-Deployment Verification & Smoke Testing

### 1. Health Verification Endpoint
Immediately after deployment, invoke the health check:
```bash
curl -f https://brandshield.yourdomain.com/api/health
```
**Expected HTTP 200 Response**:
```json
{
  "status": "ok",
  "application": {
    "name": "BrandShield AI",
    "version": "1.0.0",
    "environment": "production"
  },
  "services": {
    "database": {
      "status": "connected",
      "workspace": "dermaglow"
    },
    "verificationEngine": {
      "status": "operational",
      "deterministicOffsetCorrection": "active"
    }
  }
}
```

### 2. Live Smoke-Test Suite
1. **Dashboard Load**: Navigate to `https://brandshield.yourdomain.com/dashboard`. Verify KPI cards and activity feed render without console errors.
2. **Submission Ingestion**: Navigate to `/submissions`, click **New Submission**, load **Scenario A**, and create.
3. **Extraction & Verification**: Click **Extract Claims** $\rightarrow$ Click **Verify All Claims**. Verify claims transition to `SUPPORTED` and the publication gate displays `ELIGIBLE`.
4. **Audit Trail**: Navigate to `/audit` and confirm the new actions are recorded in the event stream.
