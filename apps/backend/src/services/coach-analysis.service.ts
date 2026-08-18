import {
  MatchLineupRole,
  UserRole,
  buildDimensionCountsFromActions,
  normalizeRadarScores,
  type ActionImpact as ActionImpactType,
  type CoachAnalysisActionByCodeDto,
  type CoachAnalysisFiltersDto,
  type CoachPlayerAnalysisDetailDto,
  type CoachPlayerAnalysisListDto,
  type CoachPlayerAnalysisRowDto,
} from '@velocesport/shared';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import {
  coachAnalysisRepository,
  type CoachAnalysisFilterParams,
} from '../repositories/coach-analysis.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { actionCatalogRepository } from '../repositories/action-catalog.repository.js';
import { ForbiddenError, NotFoundError } from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';
import type { AuthUser } from '../types/index.js';
import { buildCsv, buildExportFilename } from './report-csv.service.js';
import { generateReportPdf } from './report-pdf.service.js';
import { playerPhotoService } from './player-photo.service.js';
import type { CoachAnalysisQuery } from '../validators/coach-analysis.validator.js';

interface AnalysisActor {
  user: AuthUser;
  tenantId: number;
}

function playerInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function estimateMinutesPlayed(
  lineup: MatchLineupRole | null,
  fullMatchMinutes: number,
  maxActionMinute: number,
): number {
  if (lineup === MatchLineupRole.STARTER) return fullMatchMinutes;
  if (maxActionMinute > 0) return Math.min(fullMatchMinutes, Math.max(maxActionMinute, 1));
  return Math.max(1, Math.floor(fullMatchMinutes * 0.5));
}

function toPublicFilters(query: CoachAnalysisQuery): CoachAnalysisFiltersDto {
  return {
    ...(query.categoryId != null ? { categoryId: query.categoryId } : {}),
    ...(query.matchId != null ? { matchId: query.matchId } : {}),
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
    ...(query.actionCode != null ? { actionCode: query.actionCode } : {}),
    ...(query.impact ? { impact: query.impact } : {}),
  };
}

function buildFilterSummary(filters: CoachAnalysisFiltersDto, matchCount: number): string {
  if (filters.matchId != null) return 'En el partido filtrado';
  if (filters.dateFrom && filters.dateTo) {
    return `Del ${filters.dateFrom} al ${filters.dateTo}`;
  }
  if (filters.dateFrom) return `Desde ${filters.dateFrom}`;
  if (filters.dateTo) return `Hasta ${filters.dateTo}`;
  if (matchCount > 0) return `En ${matchCount} partidos filtrados`;
  return 'En todos tus partidos';
}

function mergeActionsByCode(
  aggs: Array<{ action_code: number; action_name: string; impact: string; action_count: number | string }>,
): CoachAnalysisActionByCodeDto[] {
  const byCode = new Map<number, CoachAnalysisActionByCodeDto>();
  for (const agg of aggs) {
    const count = Number(agg.action_count);
    const existing = byCode.get(agg.action_code);
    if (existing) {
      existing.count += count;
    } else {
      byCode.set(agg.action_code, {
        code: agg.action_code,
        name: agg.action_name,
        count,
        impact: agg.impact as ActionImpactType,
      });
    }
  }
  return [...byCode.values()]
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count || a.code - b.code);
}

export class CoachAnalysisService {
  private async resolveCategoryIds(actor: AnalysisActor, categoryId?: number): Promise<number[]> {
    let allowed: number[];

    if (userHasRole(actor.user, UserRole.ACADEMY_ADMIN)) {
      const cats = await categoryRepository.findByTenantId(actor.tenantId);
      allowed = cats.map((c) => c.id);
    } else if (userHasRole(actor.user, UserRole.COACH)) {
      allowed = await coachCategoryRepository.findCategoryIdsForCoach(
        actor.tenantId,
        actor.user.userId,
      );
    } else {
      throw new ForbiddenError('No tienes permiso para ver el análisis de jugadores');
    }

    if (categoryId != null) {
      if (!allowed.includes(categoryId)) {
        throw new ForbiddenError('No tienes permiso para analizar esta categoría');
      }
      return [categoryId];
    }

    return allowed;
  }

  private buildRepoFilters(
    categoryIds: number[],
    query: CoachAnalysisQuery,
  ): CoachAnalysisFilterParams {
    const filters: CoachAnalysisFilterParams = { categoryIds };
    if (query.categoryId != null) filters.categoryId = query.categoryId;
    if (query.matchId != null) {
      filters.matchId = query.matchId;
    } else {
      if (query.dateFrom) filters.dateFrom = query.dateFrom;
      if (query.dateTo) filters.dateTo = query.dateTo;
    }
    if (query.actionCode != null) filters.actionCode = query.actionCode;
    if (query.impact) filters.impact = query.impact;
    return filters;
  }

  private async buildPlayerRows(
    actor: AnalysisActor,
    query: CoachAnalysisQuery,
  ): Promise<{
    players: CoachPlayerAnalysisRowDto[];
    matchCount: number;
    filters: CoachAnalysisFilterParams;
    publicFilters: CoachAnalysisFiltersDto;
    catalogActions: Array<{ code: number; name: string; impact: ActionImpactType }>;
  }> {
    const categoryIds = await this.resolveCategoryIds(actor, query.categoryId);
    const filters = this.buildRepoFilters(categoryIds, query);
    const publicFilters = toPublicFilters(query);

    const [players, catalogRows] = await Promise.all([
      coachAnalysisRepository.findPlayersInCategories(actor.tenantId, categoryIds),
      actionCatalogRepository.findActiveByTenantId(actor.tenantId),
    ]);

    const catalogActions = catalogRows
      .map((r) => ({
        code: r.code,
        name: r.name,
        impact: r.impact as ActionImpactType,
      }))
      .sort((a, b) => a.code - b.code);

    const playerIds = players.map((p) => p.player_id);
    const matchCount = await coachAnalysisRepository.countMatchesInScope(actor.tenantId, filters);

    if (playerIds.length === 0) {
      return { players: [], matchCount, filters, publicFilters, catalogActions };
    }

    const [attendance, actionAggs, observationCounts, academyDefaults] = await Promise.all([
      coachAnalysisRepository.findAttendanceInScope(actor.tenantId, filters, playerIds),
      coachAnalysisRepository.findActionAggregates(actor.tenantId, filters, playerIds),
      coachAnalysisRepository.findObservationCounts(actor.tenantId, filters, playerIds),
      coachAnalysisRepository.getAcademyPeriodDefaults(actor.tenantId),
    ]);

    const maxMinutes = await coachAnalysisRepository.findMaxActionMinutes(
      actor.tenantId,
      attendance.map((a) => ({ matchId: a.match_id, playerId: a.player_id })),
    );

    const matchesByPlayer = new Map<number, typeof attendance>();
    for (const row of attendance) {
      const list = matchesByPlayer.get(row.player_id) ?? [];
      list.push(row);
      matchesByPlayer.set(row.player_id, list);
    }

    const actionsByPlayer = new Map<number, typeof actionAggs>();
    for (const row of actionAggs) {
      const list = actionsByPlayer.get(row.player_id) ?? [];
      list.push(row);
      actionsByPlayer.set(row.player_id, list);
    }

    const obsByPlayer = new Map<number, number>();
    for (const row of observationCounts) {
      obsByPlayer.set(row.player_id, Number(row.observation_count));
    }

    const result: CoachPlayerAnalysisRowDto[] = await Promise.all(
      players.map(async (player) => {
        const playerMatches = matchesByPlayer.get(player.player_id) ?? [];
        let minutesPlayed = 0;
        for (const att of playerMatches) {
          const periods =
            att.periods_count != null && att.period_duration_minutes != null
              ? att.periods_count * att.period_duration_minutes
              : academyDefaults.periodsCount * academyDefaults.periodDurationMinutes;
          const maxMin = maxMinutes.get(`${att.match_id}:${att.player_id}`) ?? 0;
          minutesPlayed += estimateMinutesPlayed(att.lineup, periods, maxMin);
        }

        const actionsByCode = mergeActionsByCode(actionsByPlayer.get(player.player_id) ?? []);
        const totalActions = actionsByCode.reduce((sum, a) => sum + a.count, 0);
        const photoUrl = await playerPhotoService.resolveSignedUrl(player.photo_object_key);

        return {
          playerId: player.player_id,
          playerName: `${player.first_name} ${player.last_name}`.trim(),
          firstName: player.first_name,
          lastName: player.last_name,
          dorsal: player.jersey_number,
          categoryName: player.category_name,
          categoryId: player.category_id,
          matchesPlayed: playerMatches.length,
          minutesPlayed,
          totalActions,
          actionsByCode,
          observationsCount: obsByPlayer.get(player.player_id) ?? 0,
          photoUrl,
        };
      }),
    );

    result.sort((a, b) => b.totalActions - a.totalActions || a.playerName.localeCompare(b.playerName, 'es'));

    return { players: result, matchCount, filters, publicFilters, catalogActions };
  }

  async listPlayers(actor: AnalysisActor, query: CoachAnalysisQuery): Promise<CoachPlayerAnalysisListDto> {
    const { players, matchCount, publicFilters, catalogActions } = await this.buildPlayerRows(
      actor,
      query,
    );
    const totalActions = players.reduce((sum, p) => sum + p.totalActions, 0);

    return {
      players,
      meta: {
        playerCount: players.length,
        totalActions,
        matchCount,
        catalogActions,
      },
      filters: publicFilters,
    };
  }

  async getPlayerDetail(
    actor: AnalysisActor,
    playerId: number,
    query: CoachAnalysisQuery,
  ): Promise<CoachPlayerAnalysisDetailDto> {
    const categoryIds = await this.resolveCategoryIds(actor, query.categoryId);
    const player = await coachAnalysisRepository.findPlayerInCategories(
      actor.tenantId,
      playerId,
      categoryIds,
    );
    if (!player) {
      throw new NotFoundError('Jugador no encontrado');
    }

    const filters = this.buildRepoFilters(categoryIds, query);
    const publicFilters = toPublicFilters(query);

    const [attendance, actionAggs, observations, academyDefaults, matchCount] = await Promise.all([
      coachAnalysisRepository.findAttendanceInScope(actor.tenantId, filters, [playerId]),
      coachAnalysisRepository.findActionAggregates(actor.tenantId, filters, [playerId]),
      coachAnalysisRepository.findObservationsForPlayer(actor.tenantId, playerId, filters),
      coachAnalysisRepository.getAcademyPeriodDefaults(actor.tenantId),
      coachAnalysisRepository.countMatchesInScope(actor.tenantId, filters),
    ]);

    const maxMinutes = await coachAnalysisRepository.findMaxActionMinutes(
      actor.tenantId,
      attendance.map((a) => ({ matchId: a.match_id, playerId: a.player_id })),
    );

    const actionsByMatch = new Map<number, typeof actionAggs>();
    for (const agg of actionAggs) {
      const list = actionsByMatch.get(agg.match_id) ?? [];
      list.push(agg);
      actionsByMatch.set(agg.match_id, list);
    }

    const matches = attendance
      .map((att) => {
        const periods =
          att.periods_count != null && att.period_duration_minutes != null
            ? att.periods_count * att.period_duration_minutes
            : academyDefaults.periodsCount * academyDefaults.periodDurationMinutes;
        const maxMin = maxMinutes.get(`${att.match_id}:${att.player_id}`) ?? 0;
        const minutesPlayed = estimateMinutesPlayed(att.lineup, periods, maxMin);
        const matchActions = mergeActionsByCode(actionsByMatch.get(att.match_id) ?? []);
        const actionsCount = matchActions.reduce((s, a) => s + a.count, 0);

        return {
          matchId: att.match_id,
          rival: att.opponent,
          date: new Date(att.match_datetime).toISOString(),
          minutesPlayed,
          actionsCount,
          actions: matchActions,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const actionsByCode = mergeActionsByCode(actionAggs);
    const totalActions = actionsByCode.reduce((sum, a) => sum + a.count, 0);
    const topAction = actionsByCode[0] ?? null;
    const minutesPlayed = matches.reduce((s, m) => s + m.minutesPlayed, 0);

    const countsByCode = new Map<number, number>();
    const catalogForRadar: Array<{ code: number; name: string }> = [];
    for (const action of actionsByCode) {
      countsByCode.set(action.code, action.count);
      catalogForRadar.push({ code: action.code, name: action.name });
    }

    const dimensionCounts = buildDimensionCountsFromActions(catalogForRadar, countsByCode);
    const radarScores = normalizeRadarScores(dimensionCounts);
    const radarDimensions = radarScores.map((r) => ({
      slug: r.slug,
      count: r.count,
      score: r.score,
    }));

    const evolutionMap = new Map<
      string,
      { totalActions: number; matchIds: Set<number> }
    >();
    for (const att of attendance) {
      const d = new Date(att.match_datetime);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const entry = evolutionMap.get(month) ?? {
        totalActions: 0,
        matchIds: new Set<number>(),
      };
      entry.matchIds.add(att.match_id);
      evolutionMap.set(month, entry);
    }
    for (const agg of actionAggs) {
      const d = new Date(agg.match_datetime);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const entry = evolutionMap.get(month) ?? {
        totalActions: 0,
        matchIds: new Set<number>(),
      };
      entry.totalActions += Number(agg.action_count);
      evolutionMap.set(month, entry);
    }

    const evolutionByMonth = [...evolutionMap.entries()]
      .map(([month, e]) => ({
        month,
        totalActions: e.totalActions,
        matchesPlayed: e.matchIds.size,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const photoUrl = await playerPhotoService.resolveSignedUrl(player.photo_object_key);

    return {
      player: {
        id: player.player_id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        firstName: player.first_name,
        lastName: player.last_name,
        dorsal: player.jersey_number,
        category: player.category_name,
        categoryId: player.category_id,
        avatar: playerInitials(player.first_name, player.last_name),
        photoUrl,
      },
      summary: {
        matchesPlayed: matches.length,
        minutesPlayed,
        totalActions,
        topAction,
      },
      actionsByCode,
      matches,
      evolutionByMonth,
      observations: observations.map((o) => {
        const coachName =
          [o.coach_first_name, o.coach_last_name].filter(Boolean).join(' ').trim() ||
          o.coach_email;
        return {
          id: o.id,
          date: new Date(o.created_at).toISOString(),
          coach: coachName,
          text: o.content,
          matchId: o.match_id,
        };
      }),
      radarDimensions,
      filters: publicFilters,
      filterSummary: buildFilterSummary(publicFilters, matchCount),
    };
  }

  async exportCsv(
    actor: AnalysisActor,
    query: CoachAnalysisQuery,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { players, catalogActions } = await this.buildPlayerRows(actor, query);
    const academy = await academyRepository.findById(actor.tenantId);
    const slug = academy?.slug ?? 'academia';

    const headers = [
      'Nombre',
      'Dorsal',
      'Categoría',
      'Partidos jugados',
      'Minutos',
      'Acciones totales',
      'Observaciones',
      ...catalogActions.map((a) => a.name),
    ];

    const rows = players.map((p) => {
      const countByCode = new Map(p.actionsByCode.map((a) => [a.code, a.count]));
      return [
        p.playerName,
        String(p.dorsal),
        p.categoryName,
        String(p.matchesPlayed),
        String(p.minutesPlayed),
        String(p.totalActions),
        String(p.observationsCount),
        ...catalogActions.map((a) => String(countByCode.get(a.code) ?? 0)),
      ];
    });

    return {
      buffer: buildCsv(headers, rows),
      filename: buildExportFilename('coach-analysis-players', slug, 'csv'),
      contentType: 'text/csv; charset=utf-8',
    };
  }

  async exportPdf(
    actor: AnalysisActor,
    query: CoachAnalysisQuery,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { players } = await this.buildPlayerRows(actor, query);
    const academy = await academyRepository.findById(actor.tenantId);
    const slug = academy?.slug ?? 'academia';

    const headers = [
      'Jugador',
      'Dorsal',
      'Categoría',
      'Partidos',
      'Minutos',
      'Acciones',
      'Obs.',
      'Desglose',
    ];

    const rows = players.map((p) => [
      p.playerName,
      String(p.dorsal),
      p.categoryName,
      String(p.matchesPlayed),
      String(p.minutesPlayed),
      String(p.totalActions),
      String(p.observationsCount),
      p.actionsByCode.length > 0
        ? p.actionsByCode.map((a) => `${a.count}× ${a.name}`).join(', ')
        : 'Sin acciones',
    ]);

    const buffer = await generateReportPdf(
      {
        academyName: academy?.name ?? 'Academia',
        logoUrl: academy?.logo_url ?? null,
        reportType: 'coach-analysis-players',
        title: 'Análisis de jugadores',
        locale: 'es',
        generatedAt: new Date(),
      },
      { headers, rows },
    );

    return {
      buffer,
      filename: buildExportFilename('coach-analysis-players', slug, 'pdf'),
      contentType: 'application/pdf',
    };
  }
}

export const coachAnalysisService = new CoachAnalysisService();
