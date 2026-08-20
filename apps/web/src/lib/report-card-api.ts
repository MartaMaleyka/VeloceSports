import type {
  PlayerMatchReportCardDto,
  PlayerMatchReportListItemDto,
} from '@velocesport/shared';
import { MatchesApiError, matchesFetch } from './matches-api.js';
import { ParentApiError, parentFetch, parentFetchList } from './parent-api.js';
import { PlayerApiError, playerFetch } from './player-api.js';

export { MatchesApiError, ParentApiError, PlayerApiError };

export async function fetchParentReportCard(
  playerId: number,
  matchId: number,
): Promise<PlayerMatchReportCardDto> {
  return parentFetch<PlayerMatchReportCardDto>(
    `children/${playerId}/matches/${matchId}/report-card`,
  );
}

export async function fetchParentMatchList(
  playerId: number,
): Promise<PlayerMatchReportListItemDto[]> {
  return parentFetchList<PlayerMatchReportListItemDto>(`children/${playerId}/matches`);
}

export async function fetchStaffReportCard(
  matchId: number,
  playerId: number,
): Promise<PlayerMatchReportCardDto> {
  return matchesFetch<PlayerMatchReportCardDto>(
    `${matchId}/players/${playerId}/report-card`,
  );
}

export async function fetchPlayerReportCard(
  matchId: number,
): Promise<PlayerMatchReportCardDto> {
  return playerFetch<PlayerMatchReportCardDto>(`matches/${matchId}/report-card`);
}
