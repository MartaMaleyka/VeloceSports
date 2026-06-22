import type {
  CreatePlayerObservationBody,
  PlayerObservationDto,
  UpdatePlayerObservationBody,
} from '@velocesport/shared';
import { MatchesApiError, matchesFetch, matchesFetchList } from './matches-api';
import { ParentApiError, parentFetchList } from './parent-api';

export { MatchesApiError, ParentApiError };

export async function fetchCoachObservations(
  playerId: number,
  matchId?: number,
): Promise<PlayerObservationDto[]> {
  return matchesFetchList<PlayerObservationDto>(`players/${playerId}/observations`, {
    matchId,
  });
}

export async function createCoachObservation(
  playerId: number,
  body: CreatePlayerObservationBody,
): Promise<PlayerObservationDto> {
  return matchesFetch<PlayerObservationDto>(`players/${playerId}/observations`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCoachObservation(
  observationId: number,
  body: UpdatePlayerObservationBody,
): Promise<PlayerObservationDto> {
  return matchesFetch<PlayerObservationDto>(`player-observations/${observationId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteCoachObservation(observationId: number): Promise<void> {
  await matchesFetch(`player-observations/${observationId}`, { method: 'DELETE' });
}

export async function fetchParentObservations(
  playerId: number,
): Promise<PlayerObservationDto[]> {
  return parentFetchList<PlayerObservationDto>(`children/${playerId}/observations`);
}
