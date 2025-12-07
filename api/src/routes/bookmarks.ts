/**
 * Bookmark routes
 */

import { Env } from '../types/env';
import { User } from '../types/user';
import { CategoryRepository } from '../db/repositories/categoryRepository';
import { analyzeBookmark } from '../services/ai/anthropic';
import { saveToInstapaper } from '../services/integrations/instapaper';
import { createTodoistTask } from '../services/integrations/todoist';
import { decrypt } from '../services/encryption';
import { successResponse } from '../utils/responses';
import {
  validateRequest,
  BookmarkAnalysisSchema,
} from '../utils/validators';
import { rateLimit } from '../middleware/rateLimit';
import { NotFoundError } from '../utils/errors';

/**
 * POST /api/bookmarks/analyze
 */
export async function handleAnalyzeBookmark(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  // Rate limiting
  rateLimit(request, 'bookmark');

  // Validate request
  const data = await validateRequest(request, BookmarkAnalysisSchema);

  const categoryRepo = new CategoryRepository(env.DB);

  // Get user's category tree
  const category = await categoryRepo.findByUserId(user.id);
  if (!category) {
    throw new NotFoundError('User category tree not found');
  }

  // Analyze bookmark with Claude AI
  const analysis = await analyzeBookmark(
    data.url,
    category.categoryTree,
    env,
    data.title
  );

  // Handle Instapaper integration
  let instapaperResult;
  if (analysis.isArticle && user.settings.instapaper) {
    try {
      const password = await decrypt(
        user.settings.instapaper.password,
        env
      );
      instapaperResult = await saveToInstapaper(
        data.url,
        analysis.title,
        user.settings.instapaper.username,
        password
      );
    } catch (error) {
      console.error('Error saving to Instapaper:', error);
      instapaperResult = {
        saved: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Handle Todoist integration
  let todoistResult;
  if (data.createTodoistTask && user.settings.todoist) {
    try {
      const apiToken = await decrypt(user.settings.todoist.apiToken, env);
      todoistResult = await createTodoistTask(
        analysis.title,
        data.url,
        analysis.summary,
        apiToken
      );
    } catch (error) {
      console.error('Error creating Todoist task:', error);
      todoistResult = {
        created: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Return analysis results (no storage)
  return successResponse({
    url: data.url,
    isArticle: analysis.isArticle,
    contentType: analysis.contentType,
    title: analysis.title,
    summary: analysis.summary,
    categories: analysis.categories,
    matchedCategory: analysis.matchedCategory || '',
    instapaper: instapaperResult,
    todoist: todoistResult,
    analyzedAt: new Date().toISOString(),
  });
}
