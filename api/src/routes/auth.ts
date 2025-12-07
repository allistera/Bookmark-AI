/**
 * Authentication routes
 */

import { Env } from '../types/env';
import { User, PublicUser } from '../types/user';
import { UserRepository } from '../db/repositories/userRepository';
import { CategoryRepository } from '../db/repositories/categoryRepository';
import { RefreshTokenRepository } from '../db/repositories/refreshTokenRepository';
import { hashPassword, verifyPassword } from '../services/auth/password';
import { generateTokenPair, verifyToken } from '../services/auth/jwt';
import { getDefaultCategoryTree } from '../services/categories';
import { sha256 } from '../utils/crypto';
import {
  successResponse,
  noContentResponse,
} from '../utils/responses';
import {
  validateRequest,
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
} from '../utils/validators';
import {
  ForbiddenError,
  UnauthorizedError,
  ConflictError,
} from '../utils/errors';
import { rateLimit } from '../middleware/rateLimit';

/**
 * Convert User to PublicUser (removes sensitive fields)
 */
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    createdAt: user.createdAt,
    settings: {
      autoBookmark: user.settings.autoBookmark,
      defaultFolder: user.settings.defaultFolder,
      instapaperEnabled: !!user.settings.instapaper,
      todoistEnabled: !!user.settings.todoist,
    },
  };
}

/**
 * POST /api/auth/register
 */
export async function handleRegister(
  request: Request,
  env: Env
): Promise<Response> {
  // Check if registration is disabled
  if (env.DISABLE_REGISTRATION === 'true') {
    throw new ForbiddenError(
      'Registration is currently disabled. Please contact an administrator.'
    );
  }

  // Rate limiting
  rateLimit(request, 'register');

  // Validate request
  const data = await validateRequest(request, RegisterSchema);

  const userRepo = new UserRepository(env.DB);
  const categoryRepo = new CategoryRepository(env.DB);
  const tokenRepo = new RefreshTokenRepository(env.DB);

  // Check if email already exists
  const existingUser = await userRepo.findByEmail(data.email);
  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await userRepo.create({
    email: data.email,
    passwordHash,
    fullName: data.fullName,
  });

  // Create default categories for user
  const defaultCategories = getDefaultCategoryTree();
  await categoryRepo.create(user.id, defaultCategories);

  // Generate tokens
  const tokens = await generateTokenPair(user.id, user.email, env);

  // Store refresh token hash
  const refreshTokenHash = await sha256(tokens.refreshToken);
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  await tokenRepo.create({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt,
  });

  return successResponse(
    {
      user: toPublicUser(user),
      tokens,
    },
    201
  );
}

/**
 * POST /api/auth/login
 */
export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  // Rate limiting
  rateLimit(request, 'login');

  // Validate request
  const data = await validateRequest(request, LoginSchema);

  const userRepo = new UserRepository(env.DB);
  const tokenRepo = new RefreshTokenRepository(env.DB);

  // Find user by email
  const user = await userRepo.findByEmail(data.email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Verify password
  const isValid = await verifyPassword(data.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated');
  }

  // Update last login
  await userRepo.updateLastLogin(user.id);

  // Generate tokens
  const tokens = await generateTokenPair(user.id, user.email, env);

  // Store refresh token hash
  const refreshTokenHash = await sha256(tokens.refreshToken);
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  await tokenRepo.create({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt,
  });

  return successResponse({
    user: toPublicUser(user),
    tokens,
  });
}

/**
 * POST /api/auth/refresh
 */
export async function handleRefresh(
  request: Request,
  env: Env
): Promise<Response> {
  // Validate request
  const data = await validateRequest(request, RefreshSchema);

  const userRepo = new UserRepository(env.DB);
  const tokenRepo = new RefreshTokenRepository(env.DB);

  // Verify refresh token
  let payload;
  try {
    payload = await verifyToken(data.refreshToken, env);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  // Check if refresh token exists in database and is not revoked
  const refreshTokenHash = await sha256(data.refreshToken);
  const storedToken = await tokenRepo.findByHash(refreshTokenHash);

  if (!storedToken) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  // Get user
  const user = await userRepo.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Revoke old refresh token
  await tokenRepo.revoke(refreshTokenHash);

  // Generate new tokens
  const tokens = await generateTokenPair(user.id, user.email, env);

  // Store new refresh token hash
  const newRefreshTokenHash = await sha256(tokens.refreshToken);
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
  await tokenRepo.create({
    userId: user.id,
    tokenHash: newRefreshTokenHash,
    expiresAt,
  });

  return successResponse({ tokens });
}

/**
 * POST /api/auth/logout
 */
export async function handleLogout(
  request: Request,
  env: Env,
  _user: User
): Promise<Response> {
  // Validate request
  const data = await validateRequest(request, RefreshSchema);

  const tokenRepo = new RefreshTokenRepository(env.DB);

  // Revoke refresh token
  const refreshTokenHash = await sha256(data.refreshToken);
  await tokenRepo.revoke(refreshTokenHash);

  return noContentResponse();
}
