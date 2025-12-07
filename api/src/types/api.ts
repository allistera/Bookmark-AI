/**
 * API request and response types
 */

import { PublicUser, PublicAPIKey, CategoryTree } from './user';
import { TokenPair } from './auth';

// Standard API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Authentication responses
export interface AuthResponse {
  user: PublicUser;
  tokens: TokenPair;
}

// Bookmark analysis
export interface BookmarkAnalysisRequest {
  url: string;
  title?: string;
  createTodoistTask?: boolean;
}

export interface BookmarkAnalysisResponse {
  url: string;
  isArticle: boolean;
  contentType: string;
  title: string;
  summary: string;
  categories: string[];
  matchedCategory: string;
  instapaper?: {
    saved: boolean;
    bookmarkId?: number;
    error?: string;
  };
  todoist?: {
    created: boolean;
    taskId?: string;
    error?: string;
  };
  analyzedAt: string;
}

// Category responses
export interface CategoryResponse {
  categoryTree: CategoryTree;
  updatedAt: number;
}

// User update request
export interface UpdateUserRequest {
  fullName?: string;
  settings?: {
    instapaperUsername?: string;
    instapaperPassword?: string;
    todoistApiToken?: string;
    autoBookmark?: boolean;
    defaultFolder?: string;
  };
}

// API Key requests
export interface CreateAPIKeyRequest {
  name: string;
  expiresAt?: number;
}

export interface CreateAPIKeyResponse {
  apiKey: string; // Only returned once!
  keyInfo: PublicAPIKey;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
