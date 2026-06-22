import {
  ActionCatalogStatus,
  MatchLineupRole,
  MatchStatus,
  UserRole,
  averagePerMinute,
  buildDimensionCountsFromActions,
  normalizeRadarScores,
  pickTopDimensionSlug,
  type MatchPeriodsConfigDto,
  type PlayerMatchReportCardDto,
  type PlayerMatchReportListItemDto,
} from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { actionCatalogRepository } from '../repositories/action-catalog.repository.js';
import { gameActionRepository } from '../repositories/game-action.repository.js';
import { matchAttendanceRepository } from '../repositories/match-attendance.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { ForbiddenError, NotFoundError } from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';
import type { AuthUser } from '../types/index.js';
import { getPool } from '../config/db.js';

interface ReportActorContext {
  user: AuthUser;
  tenantId: number;
}

function playerInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

async function resolveEffectivePeriods(
  tenantId: number,
  row: { periods_count: number | null; period_duration_minutes: number | null },
): Promise<MatchPeriodsConfigDto> {
  const pool = getPool();
  const [academyRows] = await pool.execute<
    Array<{ default_periods_count: number; default_period_duration_minutes: number } & import('mysql2/promise').RowDataPacket>
  >(
    'SELECT default_periods_count, default_period_duration_minutes FROM academies WHERE id = ? LIMIT 1',
    [tenantId],
  );
  const academy = academyRows[0];
  const defaultPeriods = Number(academy?.default_periods_count ?? 2);
  const defaultDuration = Number(academy?.default_period_duration_minutes ?? 45);

  if (row.periods_count != null && row.period_duration_minutes != null) {
    return {
      periodsCount: row.periods_count,
      periodDurationMinutes: row.period_duration_minutes,
      source: 'match',
    };
  }

  return {
    periodsCount: row.periods_count ?? defaultPeriods,
    periodDurationMinutes: row.period_duration_minutes ?? defaultDuration,
    source: 'academy',
  };
}

function estimateMinutesPlayed(
  attended: boolean,
  lineup: MatchLineupRole | null,
  periods: MatchPeriodsConfigDto,
  maxActionMinute: number,
): number {
  if (!attended) return 0;
  const full = periods.periodsCount * periods.periodDurationMinutes;
  if (lineup === MatchLineupRole.STARTER) return full;
  if (maxActionMinute > 0) return Math.min(full, Math.max(maxActionMinute, 1));
  return Math.max(1, Math.floor(full * 0.5));
}

export class PlayerMatchReportService {
  private async assertStaffAccess(
    actor: ReportActorContext,
    categoryId: number,
  ): Promise<void> {
    if (userHasRole(actor.user, UserRole.ACADEMY_ADMIN)) return;

    if (userHasRole(actor.user, UserRole.COACH)) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        actor.tenantId,
        actor.user.userId,
        categoryId,
      );
      if (!assigned) {
        throw new ForbiddenError('No tienes permiso para ver fichas de este partido');
      }
      return;
    }

    throw new ForbiddenError('No tienes permiso para ver fichas de partido');
  }

  private async assertParentAccess(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<void> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new NotFoundError('Jugador no encontrado');
  }

  async listMatchesForParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<PlayerMatchReportListItemDto[]> {
    await this.assertParentAccess(tenantId, parentUserId, playerId);

    const rows = await matchAttendanceRepository.findFinishedMatchesForPlayer(tenantId, playerId);
    const items: PlayerMatchReportListItemDto[] = [];

    for (const row of rows) {
      const totalActiveActions = await gameActionRepository.countActiveByPlayerMatchGroupedByCode(
        tenantId,
        row.match_id,
        playerId,
      );
      const total = totalActiveActions.reduce((sum, r) => sum + r.count, 0);
      items.push({
        matchId: row.match_id,
        opponent: row.opponent,
        matchDatetime: row.match_datetime.toISOString(),
        categoryName: row.category_name,
        matchJerseyNumber: row.match_jersey_number,
        totalActiveActions: total,
      });
    }

    return items;
  }

  async getReportCardForParent(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    matchId: number,
  ): Promise<PlayerMatchReportCardDto> {
    await this.assertParentAccess(tenantId, parentUserId, playerId);
    return this.buildReportCard(tenantId, playerId, matchId);
  }

  async getReportCardForStaff(
    actor: ReportActorContext,
    matchId: number,
    playerId: number,
  ): Promise<PlayerMatchReportCardDto> {
    const match = await matchRepository.findById(actor.tenantId, matchId);
    if (!match) throw new NotFoundError('Partido no encontrado');
    await this.assertStaffAccess(actor, match.category_id);

    const player = await playerRepository.findById(actor.tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');

    return this.buildReportCard(actor.tenantId, playerId, matchId);
  }

  private async buildReportCard(
    tenantId: number,
    playerId: number,
    matchId: number,
  ): Promise<PlayerMatchReportCardDto> {
    const match = await matchRepository.findById(tenantId, matchId);
    if (!match) throw new NotFoundError('Partido no encontrado');

    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');

    const attendance = await matchAttendanceRepository.findByMatchAndPlayer(
      tenantId,
      matchId,
      playerId,
    );
    if (!attendance?.attended) {
      throw new NotFoundError('El jugador no asistió a este partido');
    }

    const academy = await academyRepository.findById(tenantId);
    const catalogRows = await actionCatalogRepository.findByTenantId(tenantId, {
      status: ActionCatalogStatus.ACTIVE,
    });
    const catalog = catalogRows.map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
    }));

    const grouped = await gameActionRepository.countActiveByPlayerMatchGroupedByCode(
      tenantId,
      matchId,
      playerId,
    );

    const countsByCode = new Map<number, number>();
    for (const row of grouped) {
      countsByCode.set(row.actionCode, row.count);
    }

    const totalActiveActions = grouped.reduce((sum, r) => sum + r.count, 0);
    const periods = await resolveEffectivePeriods(tenantId, match);
    const maxMinute = await gameActionRepository.maxActiveMinuteForPlayerMatch(
      tenantId,
      matchId,
      playerId,
    );
    const minutesPlayed = estimateMinutesPlayed(
      Boolean(attendance.attended),
      attendance.lineup,
      periods,
      maxMinute,
    );
    const avg = averagePerMinute(totalActiveActions, minutesPlayed);

    const dimensionCounts = buildDimensionCountsFromActions(catalog, countsByCode);
    const radarDimensions = normalizeRadarScores(dimensionCounts);
    const topDimensionSlug = pickTopDimensionSlug(dimensionCounts);

    const actionsByCode = grouped.map((row) => ({
      code: row.actionCode,
      name: row.actionName,
      impact: row.impact as PlayerMatchReportCardDto['actionsByCode'][number]['impact'],
      count: row.count,
      averagePerMinute: averagePerMinute(row.count, minutesPlayed),
    }));

    return {
      player: {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        initials: playerInitials(player.first_name, player.last_name),
      },
      academy: {
        name: academy?.name ?? '',
      },
      match: {
        id: match.id,
        opponent: match.opponent,
        matchDatetime: match.match_datetime.toISOString(),
        categoryName: match.category_name,
        status: match.status,
        matchJerseyNumber: attendance.match_jersey_number,
      },
      minutesPlayed,
      totalActiveActions,
      averagePerMinute: avg,
      actionsByCode,
      radarDimensions,
      topDimensionSlug,
    };
  }
}

export const playerMatchReportService = new PlayerMatchReportService();
