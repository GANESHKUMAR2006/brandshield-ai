# BrandShield AI — Production Environment Configuration Specification

> **Security & Operations Mandate**:  
> Never commit `.env.local` or raw credentials to version control. This document details the exact configuration schema required for production, staging, and local environments.

---

## 1. Environment Variable Inventory

| Variable Name | Required / Optional | Scope | Default Value | Description |
| :--- | :---: | :---: | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Required | Public / Client | `"BrandShield AI"` | Display name used across headers and metadata. |
| `NEXT_PUBLIC_APP_URL` | Required | Public / Client | `"http://localhost:3000"` | Canonical base URL of the web application. |
| `NEXT_PUBLIC_APP_ENV` | Required | Public / Client | `"development"` | Environment identifier (`development`, `staging`, `production`). |
| `NEXT_PUBLIC_DEFAULT_WORKSPACE`| Required | Public / Client | `"DermaGlow"` | Default organization slug loaded on startup. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Public / Client | — | HTTPS endpoint of the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Public / Client | — | Public anonymous API key for browser client access. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Public / Client | — | Alternative name for Supabase publishable key. |
| `SUPABASE_DATABASE_URL` | Required | Server-Only | — | Direct PostgreSQL connection string for connection pooling (`pg`). |
| `SUPABASE_DB_HOST` | Optional | Server-Only | — | PostgreSQL host (used if URL constructed from parts). |
| `SUPABASE_DB_PORT` | Optional | Server-Only | `"5432"` | PostgreSQL port. |
| `SUPABASE_DB_NAME` | Optional | Server-Only | `"postgres"` | Target database name. |
| `SUPABASE_DB_USER` | Optional | Server-Only | `"postgres"` | Database username. |
| `SUPABASE_DB_PASSWORD` | Optional | Server-Only | — | Database password (masked in all telemetry). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Server-Only | — | High-privilege key for backend migration workers. |
| `LLM_PROVIDER` | Required | Server-Only | `"ollama"` | Active AI provider (`"ollama"`, `"openai"`, `"huggingface"`, `"mock"`). |
| `OLLAMA_BASE_URL` | Required if Ollama | Server-Only | `"http://localhost:11434/v1"` | HTTP endpoint for local Ollama service. |
| `OLLAMA_MODEL` | Required if Ollama | Server-Only | `"qwen3:4b"` | Model tag pulled in Ollama (`qwen3:4b` or `llama3`). |
| `OPENAI_API_KEY` | Required if OpenAI | Server-Only | — | Secret API key for OpenAI extraction. |
| `OPENAI_MODEL` | Optional | Server-Only | `"gpt-4o-mini"` | Target OpenAI model. |
| `EMBEDDING_PROVIDER` | Optional | Server-Only | `"mock"` | Provider for vector embeddings (`"openai"` or `"mock"`). |
| `HF_TOKEN` | Optional | Server-Only | — | Hugging Face inference token (if HF provider used). |

---

## 2. Security Invariants & Secret Hygiene

1. **Client vs. Server Separation**:
   - Variables prefixed with `NEXT_PUBLIC_` are inlined into client JavaScript bundles at build time.
   - **Never prefix secret connection strings or API keys with `NEXT_PUBLIC_`**.
   - `SUPABASE_DATABASE_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` must remain strictly server-only.
2. **Zero Credential Exposure in Telemetry**:
   - The health diagnostic endpoint (`/api/health`) inspects database latency and Ollama reachability.
   - Connection strings are scrubbed using regex masks (`postgresql://user:***@host:port/db`) before JSON emission.
3. **No Insecure Production Defaults**:
   - In production (`NODE_ENV === "production"`), the application strictly requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_DATABASE_URL`.
   - The application fails closed with explicit error messages rather than silently substituting mock database credentials.

---

## 3. Provider Configuration Profiles

### Profile A: Local Offline Development (Default Hackathon Setup)
```env
LLM_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="qwen3:4b"
EMBEDDING_PROVIDER="mock"
```
*Benefits*: 100% private, zero external API costs, works without internet connectivity once model is pulled.

### Profile B: Cloud Production (OpenAI Backend)
```env
LLM_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-your-production-key"
OPENAI_MODEL="gpt-4o-mini"
EMBEDDING_PROVIDER="openai"
EMBEDDING_MODEL="text-embedding-3-small"
```
*Benefits*: High concurrency, structured output guarantees, scalable without GPU server maintenance.

### Profile C: Automated CI/CD Testing (Offline Deterministic Mock)
```env
LLM_PROVIDER="mock"
EMBEDDING_PROVIDER="mock"
```
*Benefits*: 100% deterministic, zero network dependency, runs in GitHub Actions or isolated test runners.

---

## 4. Environment Startup Validation

The application validates critical environment variables during startup in `src/lib/supabase/env.ts`:
- If `NEXT_PUBLIC_SUPABASE_URL` is missing: Logs descriptive error and directs developer to `.env.example`.
- If database connection fails: Health endpoint surfaces degraded status with actionable recovery hints.
