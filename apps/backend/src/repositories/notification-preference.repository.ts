import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export interface ParentNotificationPreferenceRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  parent_user_id: number;
  in_app_enabled: number;
  email_enabled: number;
}

export interface ParentPlayerNotificationPreferenceRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  parent_user_id: number;
  player_id: number;
  in_app_enabled: number;
}

export class NotificationPreferenceRepository extends TenantScopedRepository {
  async isAcademyNotificationsEnabled(tenantId: number): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT notifications_enabled FROM academies WHERE id = ? LIMIT 1',
      [tenantId],
    );
    return Boolean(rows[0]?.notifications_enabled ?? true);
  }

  async setAcademyNotificationsEnabled(tenantId: number, enabled: boolean): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute('UPDATE academies SET notifications_enabled = ? WHERE id = ?', [
      enabled ? 1 : 0,
      tenantId,
    ]);
  }

  async findParentPreference(
    tenantId: number,
    parentUserId: number,
  ): Promise<ParentNotificationPreferenceRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<ParentNotificationPreferenceRow[]>(
      `SELECT id, tenant_id, parent_user_id, in_app_enabled, email_enabled
       FROM parent_notification_preferences
       WHERE tenant_id = ? AND parent_user_id = ?
       LIMIT 1`,
      [tenantId, parentUserId],
    );
    return rows[0] ?? null;
  }

  async upsertParentPreference(
    tenantId: number,
    parentUserId: number,
    input: { inAppEnabled?: boolean; emailEnabled?: boolean },
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const existing = await this.findParentPreference(tenantId, parentUserId);
    const pool = getPool();

    if (!existing) {
      await pool.execute(
        `INSERT INTO parent_notification_preferences
           (tenant_id, parent_user_id, in_app_enabled, email_enabled)
         VALUES (?, ?, ?, ?)`,
        [
          tenantId,
          parentUserId,
          input.inAppEnabled !== false ? 1 : 0,
          input.emailEnabled ? 1 : 0,
        ],
      );
      return;
    }

    const fields: string[] = [];
    const params: (number)[] = [];
    if (input.inAppEnabled !== undefined) {
      fields.push('in_app_enabled = ?');
      params.push(input.inAppEnabled ? 1 : 0);
    }
    if (input.emailEnabled !== undefined) {
      fields.push('email_enabled = ?');
      params.push(input.emailEnabled ? 1 : 0);
    }
    if (fields.length === 0) return;

    params.push(tenantId, parentUserId);
    await pool.execute(
      `UPDATE parent_notification_preferences SET ${fields.join(', ')}
       WHERE tenant_id = ? AND parent_user_id = ?`,
      params,
    );
  }

  async findPlayerOverride(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<ParentPlayerNotificationPreferenceRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<ParentPlayerNotificationPreferenceRow[]>(
      `SELECT id, tenant_id, parent_user_id, player_id, in_app_enabled
       FROM parent_player_notification_preferences
       WHERE tenant_id = ? AND parent_user_id = ? AND player_id = ?
       LIMIT 1`,
      [tenantId, parentUserId, playerId],
    );
    return rows[0] ?? null;
  }

  async listPlayerOverrides(
    tenantId: number,
    parentUserId: number,
  ): Promise<ParentPlayerNotificationPreferenceRow[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<ParentPlayerNotificationPreferenceRow[]>(
      `SELECT id, tenant_id, parent_user_id, player_id, in_app_enabled
       FROM parent_player_notification_preferences
       WHERE tenant_id = ? AND parent_user_id = ?`,
      [tenantId, parentUserId],
    );
    return rows;
  }

  async upsertPlayerOverride(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    inAppEnabled: boolean,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      `INSERT INTO parent_player_notification_preferences
         (tenant_id, parent_user_id, player_id, in_app_enabled)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE in_app_enabled = VALUES(in_app_enabled)`,
      [tenantId, parentUserId, playerId, inAppEnabled ? 1 : 0],
    );
  }
}

export const notificationPreferenceRepository = new NotificationPreferenceRepository();
