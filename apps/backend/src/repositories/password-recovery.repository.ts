import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';

export interface PasswordRecoveryTokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}

export class PasswordRecoveryRepository {
  /** Crea un token e invalida los anteriores sin usar del mismo usuario (solo vale el último). */
  async createReplacingPrevious(input: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    requestedIp: string | null;
  }): Promise<void> {
    const pool = getPool();
    const now = new Date();
    await pool.execute(
      'UPDATE password_recovery_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
      [now, input.userId],
    );
    await pool.execute(
      `INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at, requested_ip)
       VALUES (?, ?, ?, ?)`,
      [input.userId, input.tokenHash, input.expiresAt, input.requestedIp],
    );
  }

  async findByHash(tokenHash: string): Promise<PasswordRecoveryTokenRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<PasswordRecoveryTokenRow[]>(
      'SELECT id, user_id, token_hash, expires_at, used_at FROM password_recovery_tokens WHERE token_hash = ? LIMIT 1',
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  /** Marca el token como usado solo si seguía libre: evita el doble canje concurrente. */
  async markUsed(id: number): Promise<boolean> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE password_recovery_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL',
      [new Date(), id],
    );
    return result.affectedRows === 1;
  }

  async deleteStale(cutoff: Date): Promise<number> {
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM password_recovery_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)',
      [cutoff, cutoff],
    );
    return result.affectedRows;
  }
}

export const passwordRecoveryRepository = new PasswordRecoveryRepository();
