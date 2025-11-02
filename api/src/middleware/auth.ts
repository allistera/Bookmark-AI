/**
 * Authentication middleware
 */

import { User } from '../types/user';
import { Env } from '../types/env';
import { verifyToken } from '../services/auth/jwt';
import { hashAPIKey } from '../services/auth/apiKeys';
import { UserRepository } from '../db/repositories/userRepository';
import { APIKeyRepository } from '../db/repositories/apiKeyRepository';
import { UnauthorizedError } from '../utils/errors';

/**
 * Authenticate user from request (JWT or API key)
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<User> {
  const userRepo = new UserRepository(env.DB);
  const apiKeyRepo = new APIKeyRepository(env.DB);

  // Try JWT first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = await verifyToken(token, env);

      // Verify token type is access token
      if (payload.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }

      const user = await userRepo.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account is deactivated');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  // Try API key
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader && apiKeyHeader.startsWith('bkm_')) {
    const keyHash = await hashAPIKey(apiKeyHeader);
    const apiKey = await apiKeyRepo.findByHash(keyHash);

    if (!apiKey) {
      throw new UnauthorizedError('Invalid API key');
    }

    const user = await userRepo.findById(apiKey.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated');
    }

    // Update last used timestamp (don't await to avoid slowing down request)
    apiKeyRepo.updateLastUsed(keyHash);

    return user;
  }

  throw new UnauthorizedError('Missing authentication credentials');
}

/**
 * Optional authentication - returns null if not authenticated
 */
export async function optionalAuth(
  request: Request,
  env: Env
): Promise<User | null> {
  try {
    return await authenticate(request, env);
  } catch {
    return null;
  }
}
