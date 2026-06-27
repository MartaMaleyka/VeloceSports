import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../config/db.js';

export interface UserSessionRow extends RowDataPacket {
  id: number;
  user_id: number;
  tenant_id: number | null;
  refresh_token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export class UserSessionRepository {
  async create(input: {
    userId: number;
    tenantId: number | null;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ipAddress?: string | null;
  }): Promise<number> {
    const pool = getPool();
    const now = new Date();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO user_sessions
         (user_id, tenant_id, refresh_token_hash, user_agent, ip_address, last_activity_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.tenantId,
        input.refreshTokenHash,
        input.userAgent ?? null,
        input.ipAddress ?? null,
        now,
        input.expiresAt,
      ],
    );
    return result.insertId;
  }

  async findById(sessionId: number): Promise<UserSessionRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<UserSessionRow[]>(
      'SELECT * FROM user_sessions WHERE id = ? LIMIT 1',
      [sessionId],
    );
    return rows[0] ?? null;
  }

  async updateRefreshCredentials(
    sessionId: number,
    refreshTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const pool = getPool();
    const now = new Date();
    await pool.execute(
      `UPDATE user_sessions
       SET refresh_token_hash = ?, expires_at = ?, last_activity_at = ?, revoked_at = NULL
       WHERE id = ?`,
      [refreshTokenHash, expiresAt, now, sessionId],
    );
  }

  async revoke(sessionId: number): Promise<void> {
    const pool = getPool();
    await pool.execute(
      'UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
      [new Date(), sessionId],
    );
  }

  async revokeAllForUser(userId: number): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
      [new Date(), userId],
    );
    return result.affectedRows;
  }

  async revokeAllForUserExcept(userId: number, exceptSessionId: number): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE user_sessions SET revoked_at = ?
       WHERE user_id = ? AND revoked_at IS NULL AND id != ?`,
      [new Date(), userId, exceptSessionId],
    );
    return result.affectedRows;
  }

  async revokeAllForTenant(tenantId: number): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE user_sessions SET revoked_at = ? WHERE tenant_id = ? AND revoked_at IS NULL',
      [new Date(), tenantId],
    );
    return result.affectedRows;
  }

  async countActiveForUser(userId: number): Promise<number> {
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [userId],
    );
    return Number(rows[0]?.cnt ?? 0);
  }
}

export const userSessionRepository = new UserSessionRepository();
