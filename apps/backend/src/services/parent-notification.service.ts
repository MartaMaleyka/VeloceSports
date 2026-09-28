import type {
  ParentNotificationDto,
  ParentNotificationListDto,
  NotificationPayloadDto,
  ParentNotificationPreferencesDto,
  UpdateParentNotificationPreferencesBody,
  UpdateParentPlayerNotificationPreferenceBody,
} from '@velocesport/shared';
import { notificationRepository } from '../repositories/notification.repository.js';
import { notificationPreferenceRepository } from '../repositories/notification-preference.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { ForbiddenError, NotFoundError } from '../types/index.js';

function parsePayload(raw: unknown): NotificationPayloadDto | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as NotificationPayloadDto;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as NotificationPayloadDto;
  return null;
}

function toDto(row: {
  id: number;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  player_id: number;
  player_first_name: string;
  player_last_name: string;
  match_id: number;
  game_action_id: number | null;
  read_at: Date | null;
  voided_at: Date | null;
  created_at: Date;
}): ParentNotificationDto {
  return {
    id: row.id,
    type: row.type as ParentNotificationDto['type'],
    title: row.title,
    body: row.body,
    payload: parsePayload(row.payload),
    playerId: row.player_id,
    playerFirstName: row.player_first_name,
    playerLastName: row.player_last_name,
    matchId: row.match_id,
    gameActionId: row.game_action_id,
    readAt: row.read_at?.toISOString() ?? null,
    voidedAt: row.voided_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export class ParentNotificationService {
  /**
   * Canales por los que avisar a un padre de una acción de su hijo (RN-09/RN-18):
   * - la academia debe tener las notificaciones activas;
   * - in-app está activo salvo que el padre lo apague; el email solo si lo activó;
   * - silenciar a un hijo concreto lo silencia en todos los canales.
   */
  async resolveChannels(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<{ inApp: boolean; email: boolean }> {
    const off = { inApp: false, email: false };
    const academyEnabled =
      await notificationPreferenceRepository.isAcademyNotificationsEnabled(tenantId);
    if (!academyEnabled) return off;

    const playerPref = await notificationPreferenceRepository.findPlayerOverride(
      tenantId,
      parentUserId,
      playerId,
    );
    if (playerPref && !playerPref.in_app_enabled) return off;

    const globalPref = await notificationPreferenceRepository.findParentPreference(
      tenantId,
      parentUserId,
    );
    return {
      inApp: globalPref ? Boolean(globalPref.in_app_enabled) : true,
      email: globalPref ? Boolean(globalPref.email_enabled) : false,
    };
  }

  async canNotifyParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<boolean> {
    return (await this.resolveChannels(tenantId, parentUserId, playerId)).inApp;
  }

  async listForParent(
    tenantId: number,
    parentUserId: number,
    options?: { limit?: number; offset?: number },
  ): Promise<ParentNotificationListDto> {
    const [rows, total, unreadCount] = await Promise.all([
      notificationRepository.findByRecipient(tenantId, parentUserId, options),
      notificationRepository.countByRecipient(tenantId, parentUserId),
      notificationRepository.countUnread(tenantId, parentUserId),
    ]);

    return {
      items: rows.map(toDto),
      total,
      unreadCount,
    };
  }

  async getUnreadCount(tenantId: number, parentUserId: number): Promise<number> {
    return notificationRepository.countUnread(tenantId, parentUserId);
  }

  async markRead(
    tenantId: number,
    parentUserId: number,
    notificationId: number,
  ): Promise<void> {
    const ok = await notificationRepository.markRead(tenantId, notificationId, parentUserId);
    if (!ok) throw new NotFoundError('Notificación no encontrada');
  }

  async markAllRead(tenantId: number, parentUserId: number): Promise<number> {
    return notificationRepository.markAllRead(tenantId, parentUserId);
  }

  async getPreferences(
    tenantId: number,
    parentUserId: number,
  ): Promise<ParentNotificationPreferencesDto> {
    const [globalPref, overrides, children] = await Promise.all([
      notificationPreferenceRepository.findParentPreference(tenantId, parentUserId),
      notificationPreferenceRepository.listPlayerOverrides(tenantId, parentUserId),
      playerRepository.findByParentUserId(tenantId, parentUserId),
    ]);

    const overrideMap = new Map(overrides.map((o) => [o.player_id, Boolean(o.in_app_enabled)]));

    return {
      inAppEnabled: globalPref ? Boolean(globalPref.in_app_enabled) : true,
      emailEnabled: globalPref ? Boolean(globalPref.email_enabled) : false,
      playerOverrides: children.map((child) => ({
        playerId: child.id,
        playerFirstName: child.first_name,
        playerLastName: child.last_name,
        inAppEnabled: overrideMap.has(child.id) ? overrideMap.get(child.id)! : true,
      })),
    };
  }

  async updatePreferences(
    tenantId: number,
    parentUserId: number,
    body: UpdateParentNotificationPreferencesBody,
  ): Promise<ParentNotificationPreferencesDto> {
    await notificationPreferenceRepository.upsertParentPreference(tenantId, parentUserId, {
      inAppEnabled: body.inAppEnabled,
      emailEnabled: body.emailEnabled,
    });
    return this.getPreferences(tenantId, parentUserId);
  }

  async updatePlayerPreference(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    body: UpdateParentPlayerNotificationPreferenceBody,
  ): Promise<ParentNotificationPreferencesDto> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new ForbiddenError('No tienes acceso a este jugador');

    await notificationPreferenceRepository.upsertPlayerOverride(
      tenantId,
      parentUserId,
      playerId,
      body.inAppEnabled,
    );
    return this.getPreferences(tenantId, parentUserId);
  }

  async markVoidedByGameAction(tenantId: number, gameActionId: number): Promise<void> {
    await notificationRepository.markVoidedByGameActionId(tenantId, gameActionId);
  }
}

export const parentNotificationService = new ParentNotificationService();
