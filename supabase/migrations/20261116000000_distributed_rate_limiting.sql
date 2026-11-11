-- ============================================================================
-- BRANDSHIELD AI — DISTRIBUTED RATE LIMITING (SHARED STORAGE)
-- Migration: 20261116000000_distributed_rate_limiting.sql
-- Description: Centralized PostgreSQL sliding-window rate limit buckets
--              shared across all server instances and container lifecycles.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  first_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient expired bucket pruning
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at 
  ON public.rate_limit_buckets(reset_at);

-- Enable RLS
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Service role and server queries can manage buckets
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.rate_limit_buckets;
CREATE POLICY "Service role manages rate limits"
  ON public.rate_limit_buckets
  FOR ALL
  USING (true)
  WITH CHECK (true);
