/**
 * Rate limiting middleware
 *
 * Note: This is a simple in-memory rate limiter for demonstration.
 * For production, consider using Cloudflare Workers KV or Durable Objects
 * for distributed rate limiting across multiple workers.
 */

import { TooManyRequestsError } from '../utils/errors';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (limited to single worker instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 }, // 5 per 15min
  register: { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 per hour
  bookmark: { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
  api: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 per minute
};

/**
 * Check rate limit for a key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // No entry or expired window
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return true;
  }

  // Increment count
  entry.count++;

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    return false;
  }

  return true;
}

/**
 * Get rate limit key from request
 */
export function getRateLimitKey(
  request: Request,
  prefix: string
): string {
  // Use IP address if available (Cloudflare provides CF-Connecting-IP header)
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'unknown';

  return `${prefix}:${ip}`;
}

/**
 * Rate limit middleware
 */
export function rateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS
): void {
  const config = RATE_LIMITS[limitType];
  const key = getRateLimitKey(request, limitType);

  const allowed = checkRateLimit(key, config);

  if (!allowed) {
    throw new TooManyRequestsError(
      'Too many requests. Please try again later.'
    );
  }
}

/**
 * Cleanup expired entries (should be called periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}
