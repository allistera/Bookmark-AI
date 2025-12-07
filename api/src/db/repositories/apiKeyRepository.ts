/**
 * API Key repository for database operations
 */

import { APIKey, PublicAPIKey } from '../../types/user';

export class APIKeyRepository {
  constructor(private readonly _db: D1Database) {}

  /**
   * Find API key by hash
   */
  async findByHash(keyHash: string): Promise<APIKey | null> {
    const result = await this._db
      .prepare(
        `SELECT * FROM api_keys
         WHERE key_hash = ? AND is_active = 1
         AND (expires_at IS NULL OR expires_at > unixepoch())`
      )
      .bind(keyHash)
      .first();

    if (!result) return null;
    return this.mapToAPIKey(result);
  }

  /**
   * Find all API keys for a user
   */
  async findByUserId(userId: string): Promise<APIKey[]> {
    const results = await this._db
      .prepare(
        `SELECT * FROM api_keys
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .bind(userId)
      .all();

    return results.results.map((row) => this.mapToAPIKey(row));
  }

  /**
   * Create a new API key
   */
  async create(data: {
    userId: string;
    keyHash: string;
    keyPrefix: string;
    name?: string;
    expiresAt?: number;
  }): Promise<APIKey> {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Math.floor(Date.now() / 1000);

    await this._db
      .prepare(
        `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.userId,
        data.keyHash,
        data.keyPrefix,
        data.name || null,
        data.expiresAt || null,
        now
      )
      .run();

    const apiKey = await this._db
      .prepare('SELECT * FROM api_keys WHERE id = ?')
      .bind(id)
      .first();

    if (!apiKey) throw new Error('Failed to create API key');
    return this.mapToAPIKey(apiKey);
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(keyHash: string): Promise<void> {
    await this._db
      .prepare(
        `UPDATE api_keys
         SET last_used_at = unixepoch()
         WHERE key_hash = ?`
      )
      .bind(keyHash)
      .run();
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revoke(keyId: string, userId: string): Promise<void> {
    await this._db
      .prepare(
        `UPDATE api_keys
         SET is_active = 0
         WHERE id = ? AND user_id = ?`
      )
      .bind(keyId, userId)
      .run();
  }

  /**
   * Delete an API key
   */
  async delete(keyId: string, userId: string): Promise<void> {
    await this._db
      .prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
      .bind(keyId, userId)
      .run();
  }

  /**
   * Map database row to APIKey object
   */
  private mapToAPIKey(row: Record<string, unknown>): APIKey {
    return {
      id: row.id,
      userId: row.user_id,
      keyHash: row.key_hash,
      keyPrefix: row.key_prefix,
      name: row.name,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
  }

  /**
   * Map APIKey to PublicAPIKey (excludes sensitive data)
   */
  static toPublic(apiKey: APIKey): PublicAPIKey {
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      lastUsedAt: apiKey.lastUsedAt,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }
}
