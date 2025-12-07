/**
 * User repository for database operations
 */

import { User, UserSettings } from '../../types/user';

export class UserRepository {
  constructor(private readonly _db: D1Database) {}

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this._db
      .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .bind(email.toLowerCase())
      .first();

    if (!result) return null;
    return this.mapToUser(result);
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await this._db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first();

    if (!result) return null;
    return this.mapToUser(result);
  }

  /**
   * Create a new user
   */
  async create(data: {
    email: string;
    passwordHash: string;
    fullName?: string;
  }): Promise<User> {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Math.floor(Date.now() / 1000);

    await this._db
      .prepare(
        `INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.email.toLowerCase(),
        data.passwordHash,
        data.fullName || null,
        now,
        now
      )
      .run();

    const user = await this.findById(id);
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    settings: Partial<UserSettings>
  ): Promise<void> {
    // Get current settings
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    // Merge settings
    const newSettings = {
      ...user.settings,
      ...settings,
    };

    await this._db
      .prepare(
        `UPDATE users
         SET settings = ?, updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(JSON.stringify(newSettings), userId)
      .run();
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { fullName?: string }
  ): Promise<void> {
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.fullName !== undefined) {
      updates.push('full_name = ?');
      bindings.push(data.fullName);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = unixepoch()');
    bindings.push(userId);

    await this._db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this._db
      .prepare(
        `UPDATE users
         SET last_login_at = unixepoch()
         WHERE id = ?`
      )
      .bind(userId)
      .run();
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this._db
      .prepare(
        `UPDATE users
         SET password_hash = ?, updated_at = unixepoch()
         WHERE id = ?`
      )
      .bind(passwordHash, userId)
      .run();
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const result = await this._db
      .prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE')
      .bind(email.toLowerCase())
      .first();

    return result !== null;
  }

  /**
   * Deactivate user account
   */
  async deactivate(userId: string): Promise<void> {
    await this._db
      .prepare('UPDATE users SET is_active = 0 WHERE id = ?')
      .bind(userId)
      .run();
  }

  /**
   * Map database row to User object
   */
  private mapToUser(row: Record<string, unknown>): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      isActive: Boolean(row.is_active),
      settings: JSON.parse(row.settings || '{}') as UserSettings,
    };
  }
}
