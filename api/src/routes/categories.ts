/**
 * Category routes
 */

import { Env } from '../types/env';
import { User, CategoryTree } from '../types/user';
import { CategoryRepository } from '../db/repositories/categoryRepository';
import { validateCategoryTree } from '../services/categories';
import { successResponse } from '../utils/responses';
import { validateRequest, UpdateCategorySchema } from '../utils/validators';
import { NotFoundError, BadRequestError } from '../utils/errors';
import * as yaml from 'js-yaml';

/**
 * GET /api/categories
 */
export async function handleGetCategories(
  _request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const categoryRepo = new CategoryRepository(env.DB);

  const category = await categoryRepo.findByUserId(user.id);
  if (!category) {
    throw new NotFoundError('Category tree not found');
  }

  return successResponse({
    categoryTree: category.categoryTree,
    updatedAt: category.updatedAt,
  });
}

/**
 * PUT /api/categories
 */
export async function handleUpdateCategories(
  request: Request,
  env: Env,
  user: User
): Promise<Response> {
  const data = await validateRequest(request, UpdateCategorySchema);

  const categoryRepo = new CategoryRepository(env.DB);

  // Parse category tree if it's a string (YAML or JSON)
  let categoryTree: CategoryTree;
  if (typeof data.categoryTree === 'string') {
    try {
      // Try parsing as YAML first (YAML is a superset of JSON)
      categoryTree = yaml.load(data.categoryTree) as CategoryTree;
    } catch (error) {
      throw new BadRequestError(
        `Invalid YAML/JSON format: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  } else {
    categoryTree = data.categoryTree as CategoryTree;
  }

  // Validate category tree structure
  if (!validateCategoryTree(categoryTree)) {
    throw new BadRequestError(
      'Invalid category tree structure. Must be a nested object with string arrays as leaf nodes.'
    );
  }

  // Update or create category tree
  const existingCategory = await categoryRepo.findByUserId(user.id);
  let updatedCategory;

  if (existingCategory) {
    updatedCategory = await categoryRepo.update(user.id, categoryTree);
  } else {
    updatedCategory = await categoryRepo.create(user.id, categoryTree);
  }

  return successResponse({
    categoryTree: updatedCategory.categoryTree,
    updatedAt: updatedCategory.updatedAt,
  });
}
