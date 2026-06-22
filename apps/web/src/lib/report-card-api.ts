import type {
  PlayerMatchReportCardDto,
  PlayerMatchReportListItemDto,
} from '@velocesport/shared';
import { MatchesApiError, matchesFetch } from './matches-api';
import { ParentApiError, parentFetch, parentFetchList } from './parent-api';

export { MatchesApiError, ParentApiError };

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
