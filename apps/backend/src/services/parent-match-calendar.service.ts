import type {
  ParentMatchCalendarDto,
  ParentMatchCalendarItemDto,
} from '@velocesport/shared';
import {
  parentMatchCalendarRepository,
  type ParentCalendarMatchRow,
} from '../repositories/parent-match-calendar.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { ForbiddenError } from '../types/index.js';

function mapRow(row: ParentCalendarMatchRow): ParentMatchCalendarItemDto {
  return {
    matchId: row.match_id,
    opponent: row.opponent,
    matchDatetime: row.match_datetime.toISOString(),
    location: row.location,
    matchType: row.match_type,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.category_name,
    playerId: row.player_id,
    playerFirstName: row.player_first_name,
    playerLastName: row.player_last_name,
    playerJerseyNumber: row.player_jersey_number,
  };
}

export class ParentMatchCalendarService {
  async getCalendar(
    tenantId: number,
    parentUserId: number,
    options?: { playerId?: number; pastLimit?: number },
  ): Promise<ParentMatchCalendarDto> {
    if (options?.playerId != null) {
      const owns = await playerRepository.isLinkedToParent(
        tenantId,
        parentUserId,
        options.playerId,
      );
      if (!owns) {
        throw new ForbiddenError('No tienes acceso a este jugador');
      }
    }

    const [rows, timezone] = await Promise.all([
      parentMatchCalendarRepository.findMatchesForParent(tenantId, parentUserId, options),
      parentMatchCalendarRepository.getAcademyTimezone(tenantId),
    ]);

    return {
      timezone,
      upcoming: rows.upcoming.map(mapRow),
      past: rows.past.map(mapRow),
    };
  }
}

export const parentMatchCalendarService = new ParentMatchCalendarService();
