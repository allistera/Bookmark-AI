/**
 * Refresh Token repository for database operations
 */

import { RefreshToken } from '../../types/user';

export class RefreshTokenRepository {
  constructor(private db: D1Database) {}

  /**
   * Find refresh token by hash
   */
  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM refresh_tokens
         WHERE token_hash = ? AND revoked = 0 AND expires_at > unixepoch()`
      )
      .bind(tokenHash)
      .first();

    if (!result) return null;
    return this.mapToRefreshToken(result);
  }

  /**
   * Create a new refresh token
   */
  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: number;
  }): Promise<RefreshToken> {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Math.floor(Date.now() / 1000);

    await this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, data.userId, data.tokenHash, data.expiresAt, now)
      .run();

    const token = await this.db
      .prepare('SELECT * FROM refresh_tokens WHERE id = ?')
      .bind(id)
      .first();

    if (!token) throw new Error('Failed to create refresh token');
    return this.mapToRefreshToken(token);
  }

  /**
   * Revoke a refresh token
   */
  async revoke(tokenHash: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE refresh_tokens
         SET revoked = 1
         WHERE token_hash = ?`
      )
      .bind(tokenHash)
      .run();
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE refresh_tokens
         SET revoked = 1
         WHERE user_id = ?`
      )
      .bind(userId)
      .run();
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpired(): Promise<void> {
    await this.db
      .prepare('DELETE FROM refresh_tokens WHERE expires_at < unixepoch()')
      .run();
  }

  /**
   * Map database row to RefreshToken object
   */
  private mapToRefreshToken(row: any): RefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      revoked: Boolean(row.revoked),
      createdAt: row.created_at,
    };
  }
}
