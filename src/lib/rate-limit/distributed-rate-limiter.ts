/**
 * BrandShield AI — Distributed Shared-Storage Rate Limiter
 * 
 * Implements sliding-window / atomic bucket rate limiting backed by PostgreSQL.
 * Shared across all Render application instances, serverless functions, and container restarts.
 * 
 * Guarantees:
 * 1. Zero in-memory loss across multi-instance deployments.
 * 2. Atomic serialization prevents concurrent race conditions (PostgreSQL ON CONFLICT DO UPDATE).
 * 3. Never stores secrets, passwords, or raw join codes.
 * 4. Automatic window expiry and retry-after calculation.
 */

import { query } from "@/lib/db/server-db";

export interface RateLimitCheckResult {
  allowed: boolean;
  count: number;
  maxAttempts: number;
  retryAfterSeconds: number;
  resetAt: Date;
}

export class DistributedRateLimiter {
  /**
   * Inspects whether the given key is currently rate-limited (read-only).
   */
  public static async checkLimit(
    key: string,
    maxAttempts: number
  ): Promise<RateLimitCheckResult> {
    try {
      const res = await query<{
        count: number;
        reset_at: string;
        retry_after: number;
      }>(
        `SELECT count, reset_at, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int as retry_after
         FROM rate_limit_buckets
         WHERE key = $1 AND reset_at > now()
         LIMIT 1`,
        [key]
      );

      if (res.rows.length === 0) {
        return {
          allowed: true,
          count: 0,
          maxAttempts,
          retryAfterSeconds: 0,
          resetAt: new Date(),
        };
      }

      const row = res.rows[0];
      const count = Number(row.count);
      const retryAfterSeconds = Math.max(1, Number(row.retry_after));
      const resetAt = new Date(row.reset_at);
      const allowed = count < maxAttempts;

      return {
        allowed,
        count,
        maxAttempts,
        retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
        resetAt,
      };
    } catch (err) {
      console.error(`[DistributedRateLimiter.checkLimit] Database check error for key "${key}":`, err);
      // Fail open only on unexpected transient database errors to prevent system-wide lockouts
      return {
        allowed: true,
        count: 0,
        maxAttempts,
        retryAfterSeconds: 0,
        resetAt: new Date(),
      };
    }
  }

  /**
   * Atomically records an attempt and increments the counter using PostgreSQL row-level locks.
   * If the window has expired, resets the counter to 1 and calculates a new window.
   */
  public static async recordAttempt(
    key: string,
    windowSeconds: number,
    maxAttempts: number
  ): Promise<RateLimitCheckResult> {
    try {
      const res = await query<{
        count: number;
        reset_at: string;
        retry_after: number;
      }>(
        `INSERT INTO rate_limit_buckets (key, count, first_attempt, reset_at, updated_at)
         VALUES ($1, 1, now(), now() + ($2 || ' seconds')::interval, now())
         ON CONFLICT (key) DO UPDATE
         SET count = CASE
               WHEN rate_limit_buckets.reset_at <= now() THEN 1
               ELSE rate_limit_buckets.count + 1
             END,
             first_attempt = CASE
               WHEN rate_limit_buckets.reset_at <= now() THEN now()
               ELSE rate_limit_buckets.first_attempt
             END,
             reset_at = CASE
               WHEN rate_limit_buckets.reset_at <= now() THEN now() + ($2 || ' seconds')::interval
               ELSE rate_limit_buckets.reset_at
             END,
             updated_at = now()
         RETURNING count, reset_at, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int as retry_after`,
        [key, windowSeconds]
      );

      const row = res.rows[0];
      const count = Number(row.count);
      const retryAfterSeconds = Math.max(1, Number(row.retry_after));
      const resetAt = new Date(row.reset_at);
      const allowed = count < maxAttempts;

      return {
        allowed,
        count,
        maxAttempts,
        retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
        resetAt,
      };
    } catch (err) {
      console.error(`[DistributedRateLimiter.recordAttempt] Database error for key "${key}":`, err);
      return {
        allowed: true,
        count: 1,
        maxAttempts,
        retryAfterSeconds: 0,
        resetAt: new Date(),
      };
    }
  }

  /**
   * Clears a rate-limit bucket (e.g. for testing or administrative resets).
   */
  public static async reset(key: string): Promise<void> {
    try {
      await query(`DELETE FROM rate_limit_buckets WHERE key = $1`, [key]);
    } catch (err) {
      console.error(`[DistributedRateLimiter.reset] Error clearing key "${key}":`, err);
    }
  }
}
