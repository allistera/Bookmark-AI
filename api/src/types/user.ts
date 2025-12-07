/**
 * User-related types and interfaces
 */

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
  isActive: boolean;
  settings: UserSettings;
}

export interface UserSettings {
  instapaper?: {
    username: string;
    password: string; // Encrypted
  };
  todoist?: {
    apiToken: string; // Encrypted
  };
  autoBookmark?: boolean;
  defaultFolder?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: number;
  settings?: {
    autoBookmark?: boolean;
    defaultFolder?: string;
    instapaperEnabled?: boolean;
    todoistEnabled?: boolean;
  };
}

export interface Category {
  id: string;
  userId: string;
  categoryTree: CategoryTree;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryTree {
  [key: string]: CategoryTree | string[];
}

export interface APIKey {
  id: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string | null;
  lastUsedAt: number | null;
  expiresAt: number | null;
  isActive: boolean;
  createdAt: number;
}

export interface PublicAPIKey {
  id: string;
  name: string | null;
  prefix: string;
  lastUsedAt: number | null;
  expiresAt: number | null;
  isActive: boolean;
  createdAt: number;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
}
