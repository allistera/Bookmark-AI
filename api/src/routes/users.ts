/**
 * User routes
 */

import { Env } from '../types/env';
import { User, PublicUser, UserSettings } from '../types/user';
import { UserRepository } from '../db/repositories/userRepository';
import { APIKeyRepository } from '../db/repositories/apiKeyRepository';
import { RefreshTokenRepository } from '../db/repositories/refreshTokenRepository';
import { verifyPassword, hashPassword } from '../services/auth/password';
import { generateAPIKey } from '../services/auth/apiKeys';
import { encrypt } from '../services/encryption';
import {
  successResponse,
  noContentResponse,
} from '../utils/responses';
import {
  validateRequest,
  UpdateUserSchema,
  ChangePasswordSchema,
  CreateAPIKeySchema,
} from '../utils/validators';
import { UnauthorizedError, NotFoundError } from '../utils/errors';

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
 * GET /api/users/me
 */
export async function handleGetCurrentUser(
  _request: Request,
  _env: Env,
  user: User
): Promise<Response> {
  return successResponse(toPublicUser(user));
}

/**
 * PUT /api/users/me
 */
export async function handleUpdateCurrentUser(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const data = await validateRequest(request, UpdateUserSchema);

  const userRepo = new UserRepository(env.DB);

  // Update profile fields
  if (data.fullName !== undefined) {
    await userRepo.updateProfile(user.id, {
      fullName: data.fullName,
    });
  }

  // Update settings
  if (data.settings) {
    const newSettings: Partial<UserSettings> = {};

    // Handle Instapaper credentials
    if (data.settings.instapaperUsername || data.settings.instapaperPassword) {
      newSettings.instapaper = {
        username:
          data.settings.instapaperUsername ||
          user.settings.instapaper?.username ||
          '',
        password: data.settings.instapaperPassword
          ? await encrypt(data.settings.instapaperPassword, env)
          : user.settings.instapaper?.password || '',
      };
    }

    // Handle Todoist credentials
    if (data.settings.todoistApiToken) {
      newSettings.todoist = {
        apiToken: await encrypt(data.settings.todoistApiToken, env),
      };
    }

    // Handle other settings
    if (data.settings.autoBookmark !== undefined) {
      newSettings.autoBookmark = data.settings.autoBookmark;
    }

    if (data.settings.defaultFolder !== undefined) {
      newSettings.defaultFolder = data.settings.defaultFolder;
    }

    await userRepo.updateSettings(user.id, newSettings);
  }

  // Fetch updated user
  const updatedUser = await userRepo.findById(user.id);
  if (!updatedUser) {
    throw new NotFoundError('User not found');
  }

  return successResponse(toPublicUser(updatedUser));
}

/**
 * PUT /api/users/me/password
 */
export async function handleChangePassword(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const data = await validateRequest(request, ChangePasswordSchema);

  const userRepo = new UserRepository(env.DB);
  const tokenRepo = new RefreshTokenRepository(env.DB);

  // Verify current password
  const isValid = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await hashPassword(data.newPassword);

  // Update password
  await userRepo.updatePassword(user.id, newPasswordHash);

  // Revoke all refresh tokens (force re-login on all devices)
  await tokenRepo.revokeAllForUser(user.id);

  return successResponse({
    message: 'Password updated successfully. Please log in again.',
  });
}

/**
 * GET /api/users/me/api-keys
 */
export async function handleGetAPIKeys(
  _request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const apiKeyRepo = new APIKeyRepository(env.DB);

  const apiKeys = await apiKeyRepo.findByUserId(user.id);

  return successResponse({
    apiKeys: apiKeys.map((key) => APIKeyRepository.toPublic(key)),
  });
}

/**
 * POST /api/users/me/api-keys
 */
export async function handleCreateAPIKey(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const data = await validateRequest(request, CreateAPIKeySchema);

  const apiKeyRepo = new APIKeyRepository(env.DB);

  // Generate API key
  const { key, hash, prefix } = await generateAPIKey();

  // Store in database
  const apiKey = await apiKeyRepo.create({
    userId: user.id,
    keyHash: hash,
    keyPrefix: prefix,
    name: data.name,
    expiresAt: data.expiresAt,
  });

  return successResponse(
    {
      apiKey: key, // Only returned once!
      keyInfo: APIKeyRepository.toPublic(apiKey),
    },
    201
  );
}

/**
 * DELETE /api/users/me/api-keys/:id
 */
export async function handleDeleteAPIKey(
  request: Request,
  env: Env,
  user: User,
  keyId: string
): Promise<Response> {
  const apiKeyRepo = new APIKeyRepository(env.DB);

  await apiKeyRepo.delete(keyId, user.id);

  return noContentResponse();
}
