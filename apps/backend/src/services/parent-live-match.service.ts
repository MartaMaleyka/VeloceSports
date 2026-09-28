import {
  GameActionStatus,
  MatchStatus,
  PlayerStatus,
  type ParentLiveMatchDto,
  type ParentLiveMatchesDto,
} from '@velocesport/shared';
import { gameActionRepository } from '../repositories/game-action.repository.js';
import { matchAttendanceRepository } from '../repositories/match-attendance.repository.js';
import { matchRepository, type MatchWithCategoryRow } from '../repositories/match.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { NotFoundError } from '../types/index.js';
import { buildClockDtoFromRow } from '../utils/match-clock-mapper.js';

const RECENT_ACTIONS_LIMIT = 5;

/**
 * Partido en curso visto por la familia: reloj y acciones vigentes del jugador, que se
 * reflejan en cuanto el entrenador las captura (o las anula).
 */
export class ParentLiveMatchService {
  async getLiveForParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<ParentLiveMatchesDto> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new NotFoundError('Jugador no encontrado');

    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');

    const now = Date.now();
    if (player.category_id == null || player.status !== PlayerStatus.ACTIVE) {
      return { matches: [], generatedAt: new Date(now).toISOString() };
    }

    const rows = await matchRepository.findByTenantId(tenantId, {
      categoryId: player.category_id,
      status: MatchStatus.IN_PROGRESS,
    });
    const matches = await Promise.all(
      rows.map((row) => this.toLiveDto(tenantId, playerId, row, now)),
    );
    return { matches, generatedAt: new Date(now).toISOString() };
  }

  private async toLiveDto(
    tenantId: number,
    playerId: number,
    row: MatchWithCategoryRow,
    now: number,
  ): Promise<ParentLiveMatchDto> {
    const attendance = await matchAttendanceRepository.findByMatchAndPlayer(
      tenantId,
      row.id,
      playerId,
    );
    const attended = Boolean(attendance?.attended);

    const base = {
      matchId: row.id,
      opponent: row.opponent,
      categoryName: row.category_name,
      location: row.location,
      clock: buildClockDtoFromRow(row, now),
      attended,
      matchJerseyNumber: attended ? (attendance?.match_jersey_number ?? null) : null,
    };
    if (!attended) {
      return { ...base, totalActions: 0, actions: [], recentActions: [] };
    }

    const [actions, allActions] = await Promise.all([
      gameActionRepository.countActiveByPlayerMatchGroupedByCode(tenantId, row.id, playerId),
      gameActionRepository.findByMatchId(tenantId, row.id),
    ]);
    const recentActions = allActions
      .filter((a) => a.player_id === playerId && a.status === GameActionStatus.ACTIVE)
      .sort((a, b) => b.period - a.period || b.minute - a.minute || b.id - a.id)
      .slice(0, RECENT_ACTIONS_LIMIT)
      .map((a) => ({
        id: a.id,
        actionCode: a.action_code,
        actionName: a.action_name,
        minute: a.minute,
        period: a.period,
      }));

    return {
      ...base,
      totalActions: actions.reduce((sum, a) => sum + a.count, 0),
      actions,
      recentActions,
    };
  }
}

export const parentLiveMatchService = new ParentLiveMatchService();
