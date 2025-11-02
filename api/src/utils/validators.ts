/**
 * Zod validation schemas for API requests
 */

import { z } from 'zod';

// Auth schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z.string().min(1).max(255).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// Bookmark schemas
export const BookmarkAnalysisSchema = z.object({
  url: z.string().url('Invalid URL'),
  title: z.string().optional(),
  createTodoistTask: z.boolean().optional(),
});

// Category schemas
export const UpdateCategorySchema = z.object({
  categoryTree: z.record(z.any()).or(z.string()),
});

// User update schemas
export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  settings: z
    .object({
      instapaperUsername: z.string().optional(),
      instapaperPassword: z.string().optional(),
      todoistApiToken: z.string().optional(),
      autoBookmark: z.boolean().optional(),
      defaultFolder: z.string().optional(),
    })
    .optional(),
});

// API Key schemas
export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.number().int().positive().optional(),
});

/**
 * Validate request body against a schema
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw {
        name: 'ValidationError',
        message: 'Validation failed',
        errors: error.errors,
      };
    }
    throw error;
  }
}
