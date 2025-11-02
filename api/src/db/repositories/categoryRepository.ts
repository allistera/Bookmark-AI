/**
 * Category repository for database operations
 */

import { Category, CategoryTree } from '../../types/user';

export class CategoryRepository {
  constructor(private readonly _db: D1Database) {}

  /**
   * Find category by user ID
   */
  async findByUserId(userId: string): Promise<Category | null> {
    const result = await this._db
      .prepare('SELECT * FROM categories WHERE user_id = ?')
      .bind(userId)
      .first();

    if (!result) return null;
    return this.mapToCategory(result);
  }

  /**
   * Create category tree for user
   */
  async create(userId: string, categoryTree: CategoryTree): Promise<Category> {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Math.floor(Date.now() / 1000);

    await this._db
      .prepare(
        `INSERT INTO categories (id, user_id, category_tree, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, userId, JSON.stringify(categoryTree), now, now)
      .run();

    const category = await this.findByUserId(userId);
    if (!category) throw new Error('Failed to create category');
    return category;
  }

  /**
   * Update category tree for user
   */
  async update(userId: string, categoryTree: CategoryTree): Promise<Category> {
    await this._db
      .prepare(
        `UPDATE categories
         SET category_tree = ?, updated_at = unixepoch()
         WHERE user_id = ?`
      )
      .bind(JSON.stringify(categoryTree), userId)
      .run();

    const category = await this.findByUserId(userId);
    if (!category) throw new Error('Failed to update category');
    return category;
  }

  /**
   * Delete category tree for user
   */
  async delete(userId: string): Promise<void> {
    await this._db
      .prepare('DELETE FROM categories WHERE user_id = ?')
      .bind(userId)
      .run();
  }

  /**
   * Map database row to Category object
   */
  private mapToCategory(row: Record<string, unknown>): Category {
    return {
      id: row.id,
      userId: row.user_id,
      categoryTree: JSON.parse(row.category_tree) as CategoryTree,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
