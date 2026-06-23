import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { NotificationType } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface NotificationRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  recipient_user_id: number;
  player_id: number;
  match_id: number;
  game_action_id: number | null;
  type: NotificationType;
  title: string;
  body: string;
  payload: string | Record<string, unknown> | null;
  read_at: Date | null;
  voided_at: Date | null;
  created_at: Date;
}

export interface NotificationWithPlayerRow extends NotificationRow {
  player_first_name: string;
  player_last_name: string;
}

export interface CreateNotificationInput {
  tenantId: number;
  recipientUserId: number;
  playerId: number;
  matchId: number;
  gameActionId: number;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
}

export class NotificationRepository extends TenantScopedRepository {
  async createIfNotExists(input: CreateNotificationInput): Promise<number | null> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO notifications
           (tenant_id, recipient_user_id, player_id, match_id, game_action_id, type, title, body, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.tenantId,
          input.recipientUserId,
          input.playerId,
          input.matchId,
          input.gameActionId,
          input.type,
          input.title,
          input.body,
          input.payload ? JSON.stringify(input.payload) : null,
        ],
      );
      return result.insertId;
    } catch (err: unknown) {
      const mysqlErr = err as { code?: string };
      if (mysqlErr.code === 'ER_DUP_ENTRY') return null;
      throw err;
    }
  }

  async findByRecipient(
    tenantId: number,
    recipientUserId: number,
    options?: { limit?: number; offset?: number },
  ): Promise<NotificationWithPlayerRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
    const offset = Math.max(options?.offset ?? 0, 0);

    const [rows] = await pool.execute<NotificationWithPlayerRow[]>(
      `SELECT n.id, n.tenant_id, n.recipient_user_id, n.player_id, n.match_id, n.game_action_id,
              n.type, n.title, n.body, n.payload, n.read_at, n.voided_at, n.created_at,
              p.first_name AS player_first_name, p.last_name AS player_last_name
       FROM notifications n
       INNER JOIN players p ON p.id = n.player_id AND p.tenant_id = n.tenant_id
       WHERE n.tenant_id = ? AND n.recipient_user_id = ?
       ORDER BY (n.read_at IS NULL) DESC, n.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [tenantId, recipientUserId],
    );
    return rows;
  }

  async countByRecipient(tenantId: number, recipientUserId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM notifications
       WHERE tenant_id = ? AND recipient_user_id = ?`,
      [tenantId, recipientUserId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async countUnread(tenantId: number, recipientUserId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM notifications
       WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [tenantId, recipientUserId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findByIdForRecipient(
    tenantId: number,
    notificationId: number,
    recipientUserId: number,
  ): Promise<NotificationWithPlayerRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<NotificationWithPlayerRow[]>(
      `SELECT n.id, n.tenant_id, n.recipient_user_id, n.player_id, n.match_id, n.game_action_id,
              n.type, n.title, n.body, n.payload, n.read_at, n.voided_at, n.created_at,
              p.first_name AS player_first_name, p.last_name AS player_last_name
       FROM notifications n
       INNER JOIN players p ON p.id = n.player_id AND p.tenant_id = n.tenant_id
       WHERE n.id = ? AND n.tenant_id = ? AND n.recipient_user_id = ?
       LIMIT 1`,
      [notificationId, tenantId, recipientUserId],
    );
    return rows[0] ?? null;
  }

  async markRead(
    tenantId: number,
    notificationId: number,
    recipientUserId: number,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ? AND tenant_id = ? AND recipient_user_id = ?`,
      [notificationId, tenantId, recipientUserId],
    );
    return result.affectedRows > 0;
  }

  async markAllRead(tenantId: number, recipientUserId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [tenantId, recipientUserId],
    );
    return result.affectedRows;
  }

  async markVoidedByGameActionId(tenantId: number, gameActionId: number): Promise<number> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE notifications SET voided_at = COALESCE(voided_at, CURRENT_TIMESTAMP)
       WHERE tenant_id = ? AND game_action_id = ? AND voided_at IS NULL`,
      [tenantId, gameActionId],
    );
    return result.affectedRows;
  }
}

export const notificationRepository = new NotificationRepository();
