import type {
  PlayerMatchInsightDto,
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

export async function fetchParentInsight(
  playerId: number,
  matchId: number,
  options: { forceRegenerate?: boolean; locale?: string } = {},
): Promise<PlayerMatchInsightDto> {
  return parentFetch<PlayerMatchInsightDto>(`children/${playerId}/matches/${matchId}/insight`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function fetchStaffInsight(
  matchId: number,
  playerId: number,
  options: { forceRegenerate?: boolean; locale?: string } = {},
): Promise<PlayerMatchInsightDto> {
  return matchesFetch<PlayerMatchInsightDto>(`${matchId}/players/${playerId}/insight`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function fetchPlayerInsight(
  matchId: number,
  options: { forceRegenerate?: boolean; locale?: string } = {},
): Promise<PlayerMatchInsightDto> {
  return playerFetch<PlayerMatchInsightDto>(`matches/${matchId}/insight`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}
