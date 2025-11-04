/**
 * Category service for parsing and managing bookmark categories
 */

import { CategoryTree } from '../types/user';

/**
 * Format a YAML key by replacing underscores with spaces
 */
function formatKey(key: string): string {
  return key.replace(/_/g, ' ');
}

/**
 * Recursively extract all category paths from a category tree
 */
export function extractCategories(
  obj: CategoryTree,
  prefix: string = ''
): string[] {
  const categories: string[] = [];

  for (const key in obj) {
    // Skip root keys that might be user-specific
    if (key.endsWith('_Bookmarks')) {
      categories.push(...extractCategories(obj[key] as CategoryTree, ''));
      continue;
    }

    const formattedKey = formatKey(key);
    const currentPath = prefix ? `${prefix}/${formattedKey}` : formattedKey;

    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      // This is a category with subcategories
      categories.push(currentPath);
      categories.push(...extractCategories(obj[key] as CategoryTree, currentPath));
    } else if (Array.isArray(obj[key])) {
      // This is a leaf category with items
      categories.push(currentPath);
    }
  }

  return categories;
}

/**
 * Get default category tree for new users
 */
export function getDefaultCategoryTree(): CategoryTree {
  return {
    Personal: {
      Reading_List: [],
      Learning: {
        Programming: [],
        Design: [],
        Business: [],
      },
      Tools: [],
      Inspiration: [],
    },
    Work: {
      Documentation: [],
      Resources: [],
      Projects: [],
    },
    Archive: [],
  };
}

/**
 * Validate category tree structure
 */
export function validateCategoryTree(tree: unknown): tree is CategoryTree {
  if (typeof tree !== 'object' || tree === null) {
    return false;
  }

  // Recursively check structure
  function isValid(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = (obj as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        // Leaf node - should be array of strings
        if (!value.every((item) => typeof item === 'string')) {
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Branch node - recursively check
        if (!isValid(value)) {
          return false;
        }
      } else {
        // Invalid node type
        return false;
      }
    }
    return true;
  }

  return isValid(tree);
}
