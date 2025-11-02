/**
 * CORS middleware
 */

import { Env } from '../types/env';

/**
 * Get CORS headers
 */
export function getCORSHeaders(env: Env, origin?: string): HeadersInit {
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) =>
    o.trim()
  );

  // Check if origin is allowed
  let allowOrigin = '*';
  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed === '*') return true;
      if (allowed.includes('*')) {
        // Handle wildcard patterns like "chrome-extension://*"
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(env: Env, request: Request): Response {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders(env, origin || undefined),
  });
}
