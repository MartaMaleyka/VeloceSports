export const NotificationType = {
  GAME_ACTION: 'game_action',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export interface NotificationPayloadDto {
  messageKey: string;
  params: Record<string, string | number>;
}

export interface ParentNotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  payload: NotificationPayloadDto | null;
  playerId: number;
  playerFirstName: string;
  playerLastName: string;
  matchId: number;
  gameActionId: number | null;
  readAt: string | null;
  voidedAt: string | null;
  createdAt: string;
}

export interface ParentNotificationListDto {
  items: ParentNotificationDto[];
  total: number;
  unreadCount: number;
}

export interface ParentNotificationUnreadCountDto {
  unreadCount: number;
}

export interface ParentNotificationPreferencesDto {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  playerOverrides: Array<{
    playerId: number;
    playerFirstName: string;
    playerLastName: string;
    inAppEnabled: boolean;
  }>;
}

export interface UpdateParentNotificationPreferencesBody {
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
}

export interface UpdateParentPlayerNotificationPreferenceBody {
  inAppEnabled: boolean;
}
