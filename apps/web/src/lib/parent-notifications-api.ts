import type {
  ParentNotificationListDto,
  ParentNotificationPreferencesDto,
  ParentNotificationUnreadCountDto,
} from '@velocesport/shared';
import { parentFetch } from './parent-api';

export async function fetchParentNotifications(
  limit = 20,
  offset = 0,
): Promise<ParentNotificationListDto> {
  return parentFetch<ParentNotificationListDto>(
    `notifications?limit=${limit}&offset=${offset}`,
  );
}

export async function fetchParentUnreadCount(): Promise<number> {
  const data = await parentFetch<ParentNotificationUnreadCountDto>('notifications/unread-count');
  return data.unreadCount;
}

export async function markParentNotificationRead(notificationId: number): Promise<void> {
  await parentFetch(`notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllParentNotificationsRead(): Promise<void> {
  await parentFetch('notifications/read-all', { method: 'PATCH' });
}

export async function fetchParentNotificationPreferences(): Promise<ParentNotificationPreferencesDto> {
  return parentFetch<ParentNotificationPreferencesDto>('notification-preferences');
}

export async function updateParentNotificationPreferences(
  body: Partial<Pick<ParentNotificationPreferencesDto, 'inAppEnabled' | 'emailEnabled'>>,
): Promise<ParentNotificationPreferencesDto> {
  return parentFetch<ParentNotificationPreferencesDto>('notification-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateParentPlayerNotificationPreference(
  playerId: number,
  inAppEnabled: boolean,
): Promise<ParentNotificationPreferencesDto> {
  return parentFetch<ParentNotificationPreferencesDto>(
    `notification-preferences/players/${playerId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inAppEnabled }),
    },
  );
}
