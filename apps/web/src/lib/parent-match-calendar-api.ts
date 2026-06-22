import type { ParentMatchCalendarDto } from '@velocesport/shared';
import { parentFetch } from './parent-api';

export async function fetchParentMatchCalendar(
  playerId?: number,
): Promise<ParentMatchCalendarDto> {
  const query = playerId != null ? `?playerId=${playerId}` : '';
  return parentFetch<ParentMatchCalendarDto>(`matches/calendar${query}`);
}
