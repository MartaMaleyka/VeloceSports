import { NotificationType } from '@velocesport/shared';
import { notificationRepository } from '../repositories/notification.repository.js';
import { notificationPreferenceRepository } from '../repositories/notification-preference.repository.js';
import { parentLinkRepository } from '../repositories/parent-link.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { buildGameActionNotificationMessage } from '../utils/notification-message.js';
import { emailNotificationService } from './email-notification.service.js';
import { parentNotificationService } from './parent-notification.service.js';

export interface NotifiableGameActionPayload {
  tenantId: number;
  matchId: number;
  gameActionId: number;
  playerId: number;
  actionCatalogId: number;
  actionCode: number;
  actionName: string;
  minute: number;
  period: number;
  matchJerseyNumber: number;
}

export type GameActionNotificationSkipReason =
  | 'academy_disabled'
  | 'no_parents'
  | 'all_parents_opted_out';

export interface GameActionNotificationHookResult {
  queued: boolean;
  createdCount: number;
  skippedReason?: GameActionNotificationSkipReason;
}

export class GameActionNotificationService {
  async onNotifiableActionRegistered(
    payload: NotifiableGameActionPayload,
  ): Promise<GameActionNotificationHookResult> {
    const academyEnabled =
      await notificationPreferenceRepository.isAcademyNotificationsEnabled(payload.tenantId);
    if (!academyEnabled) {
      return { queued: false, createdCount: 0, skippedReason: 'academy_disabled' };
    }

    const parentIds = await parentLinkRepository.findParentUserIdsForPlayer(
      payload.tenantId,
      payload.playerId,
    );
    if (parentIds.length === 0) {
      return { queued: false, createdCount: 0, skippedReason: 'no_parents' };
    }

    const player = await playerRepository.findById(payload.tenantId, payload.playerId);
    const playerFirstName = player?.first_name ?? 'Tu hijo';

    const message = buildGameActionNotificationMessage(
      playerFirstName,
      payload.actionCode,
      payload.actionName,
      payload.minute,
    );

    let createdCount = 0;
    for (const parentUserId of parentIds) {
      const allowed = await parentNotificationService.canNotifyParent(
        payload.tenantId,
        parentUserId,
        payload.playerId,
      );
      if (!allowed) continue;

      const notificationId = await notificationRepository.createIfNotExists({
        tenantId: payload.tenantId,
        recipientUserId: parentUserId,
        playerId: payload.playerId,
        matchId: payload.matchId,
        gameActionId: payload.gameActionId,
        type: NotificationType.GAME_ACTION,
        title: message.title,
        body: message.body,
        payload: message.payload,
      });

      if (notificationId == null) continue;

      createdCount += 1;

      const parentUser = await userRepository.findById(payload.tenantId, parentUserId);
      if (parentUser?.email) {
        await emailNotificationService.sendEmailNotification({
          tenantId: payload.tenantId,
          recipientUserId: parentUserId,
          recipientEmail: parentUser.email,
          subject: message.title,
          body: message.body,
          notificationId,
        });
      }
    }

    if (createdCount === 0) {
      return { queued: false, createdCount: 0, skippedReason: 'all_parents_opted_out' };
    }

    return { queued: true, createdCount };
  }

  async onGameActionVoided(tenantId: number, gameActionId: number): Promise<void> {
    await parentNotificationService.markVoidedByGameAction(tenantId, gameActionId);
  }
}

export const gameActionNotificationService = new GameActionNotificationService();
