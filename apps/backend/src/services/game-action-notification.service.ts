/**
 * RN-09 / RN-18: punto de extensión para notificaciones a padres.
 * NO envía notificaciones en este paso — solo deja el hook explícito.
 */
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

export interface GameActionNotificationHookResult {
  /** false hasta que se implemente el despachador real */
  queued: false;
  skippedReason: 'not_implemented';
}

export class GameActionNotificationService {
  async onNotifiableActionRegistered(
    _payload: NotifiableGameActionPayload,
  ): Promise<GameActionNotificationHookResult> {
    // TODO(RN-09/RN-18): encolar/enviar notificación al padre según canal y preferencias
    return { queued: false, skippedReason: 'not_implemented' };
  }
}

export const gameActionNotificationService = new GameActionNotificationService();
