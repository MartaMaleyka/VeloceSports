import type { MatchStatus } from './statuses.js';
import type { MatchType } from './match.js';

export interface ParentMatchCalendarItemDto {
  matchId: number;
  opponent: string;
  matchDatetime: string;
  location: string | null;
  matchType: MatchType;
  status: MatchStatus;
  categoryId: number;
  categoryName: string;
  playerId: number;
  playerFirstName: string;
  playerLastName: string;
  playerJerseyNumber: number;
}

export interface ParentMatchCalendarDto {
  timezone: string;
  upcoming: ParentMatchCalendarItemDto[];
  past: ParentMatchCalendarItemDto[];
}
