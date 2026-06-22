import {
  ActionCatalogStatus,
  MatchLineupRole,
  type MatchPeriodsConfigDto,
  type ParentDashboardByMatchRowDto,
  type ParentDashboardByMonthRowDto,
  type ParentDashboardHighlightDto,
  type ParentDashboardPeriodOptionDto,
  type ParentDashboardPeriodValue,
  type ParentPlayerDashboardDto,
} from '@velocesport/shared';
import { actionCatalogRepository } from '../repositories/action-catalog.repository.js';
import { parentDashboardRepository } from '../repositories/parent-dashboard.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { NotFoundError } from '../types/index.js';
import { getPool } from '../config/db.js';

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
  lineup: MatchLineupRole | null,
  periods: MatchPeriodsConfigDto,
  maxActionMinute: number,
): number {
  const full = periods.periodsCount * periods.periodDurationMinutes;
  if (lineup === MatchLineupRole.STARTER) return full;
  if (maxActionMinute > 0) return Math.min(full, Math.max(maxActionMinute, 1));
  return Math.max(1, Math.floor(full * 0.5));
}

function parsePeriod(period: string): { value: ParentDashboardPeriodValue; monthKey: string | null } {
  if (period === 'all') return { value: 'all', monthKey: null };
  if (/^\d{4}-\d{2}$/.test(period)) {
    return { value: period as ParentDashboardPeriodValue, monthKey: period };
  }
  return { value: 'all', monthKey: null };
}

function formatMatchShortLabel(opponent: string, matchDatetime: Date): string {
  const date = matchDatetime.toISOString().slice(0, 10);
  const shortOpponent = opponent.length > 12 ? `${opponent.slice(0, 11)}…` : opponent;
  return `${shortOpponent} · ${date.slice(5)}`;
}

const IMPACT_ORDER: Record<string, number> = { positive: 0, neutral: 1, negative: 2 };

export class ParentDashboardService {
  private async assertOwnsPlayer(
    tenantId: number,
    parentUserId: number,
    playerId: number,
  ): Promise<void> {
    const linked = await playerRepository.isLinkedToParent(tenantId, parentUserId, playerId);
    if (!linked) throw new NotFoundError('Jugador no encontrado');
  }

  async getDashboard(
    tenantId: number,
    parentUserId: number,
    playerId: number,
    periodParam: string,
  ): Promise<ParentPlayerDashboardDto> {
    await this.assertOwnsPlayer(tenantId, parentUserId, playerId);

    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');

    const { value: period, monthKey } = parsePeriod(periodParam);

    const monthKeys = await parentDashboardRepository.findDistinctMonthKeys(tenantId, playerId);
    const availablePeriods: ParentDashboardPeriodOptionDto[] = [
      { value: 'all', monthKey: null },
      ...monthKeys.map((mk) => ({ value: mk as ParentDashboardPeriodValue, monthKey: mk })),
    ];

    const catalogRows = await actionCatalogRepository.findByTenantId(tenantId, {
      status: ActionCatalogStatus.ACTIVE,
    });
    catalogRows.sort((a, b) => a.code - b.code);

    const matches = await parentDashboardRepository.findFinishedMatchesForPlayer(
      tenantId,
      playerId,
      monthKey,
    );

    const actionsByMatch = await parentDashboardRepository.countActiveActionsByMatchAndCode(
      tenantId,
      playerId,
      monthKey,
    );
    const actionsByMonth = await parentDashboardRepository.countActiveActionsByMonthAndCode(
      tenantId,
      playerId,
      monthKey,
    );
    const timelineRows = await parentDashboardRepository.countActiveActionsTimelineByMonth(
      tenantId,
      playerId,
      monthKey,
    );

    const matchActionMap = new Map<string, number>();
    for (const row of actionsByMatch) {
      matchActionMap.set(`${row.matchId}:${row.actionCode}`, row.count);
    }

    const monthActionMap = new Map<string, number>();
    for (const row of actionsByMonth) {
      monthActionMap.set(`${row.monthKey}:${row.actionCode}`, row.count);
    }

    const monthColumns = monthKey
      ? [{ monthKey }]
      : [...new Set(actionsByMonth.map((r) => r.monthKey))].sort().map((mk) => ({ monthKey: mk }));

    const byMatchRows: ParentDashboardByMatchRowDto[] = catalogRows.map((ac) => {
      const countsByMatch: Record<number, number> = {};
      let rowTotal = 0;
      for (const match of matches) {
        const count = matchActionMap.get(`${match.match_id}:${ac.code}`) ?? 0;
        countsByMatch[match.match_id] = count;
        rowTotal += count;
      }
      return {
        code: ac.code,
        name: ac.name,
        impact: ac.impact,
        countsByMatch,
        rowTotal,
      };
    });

    const byMonthRows: ParentDashboardByMonthRowDto[] = catalogRows.map((ac) => {
      const countsByMonth: Record<string, number> = {};
      let rowTotal = 0;
      for (const { monthKey: mk } of monthColumns) {
        const count = monthActionMap.get(`${mk}:${ac.code}`) ?? 0;
        countsByMonth[mk] = count;
        rowTotal += count;
      }
      return {
        code: ac.code,
        name: ac.name,
        impact: ac.impact,
        countsByMonth,
        rowTotal,
      };
    });

    let totalMinutes = 0;
    let totalActions = 0;
    const actionTotals = new Map<number, { name: string; impact: string; count: number }>();

    for (const match of matches) {
      const periods = await resolveEffectivePeriods(tenantId, match);
      const maxMinute = await parentDashboardRepository.maxActiveMinuteForPlayerMatch(
        tenantId,
        match.match_id,
        playerId,
      );
      totalMinutes += estimateMinutesPlayed(
        match.lineup as MatchLineupRole | null,
        periods,
        maxMinute,
      );

      for (const ac of catalogRows) {
        const count = matchActionMap.get(`${match.match_id}:${ac.code}`) ?? 0;
        if (count > 0) {
          totalActions += count;
          const prev = actionTotals.get(ac.code);
          if (prev) prev.count += count;
          else actionTotals.set(ac.code, { name: ac.name, impact: ac.impact, count });
        }
      }
    }

    const highlights: ParentDashboardHighlightDto[] = [...actionTotals.entries()]
      .map(([code, data]) => ({
        code,
        name: data.name,
        count: data.count,
        impact: data.impact as ParentDashboardHighlightDto['impact'],
      }))
      .sort((a, b) => {
        const impactDiff = (IMPACT_ORDER[a.impact] ?? 9) - (IMPACT_ORDER[b.impact] ?? 9);
        if (impactDiff !== 0) return impactDiff;
        return b.count - a.count;
      })
      .slice(0, 5);

    return {
      player: {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        jerseyNumber: player.jersey_number,
        categoryName: player.category_name,
      },
      period,
      availablePeriods,
      catalog: catalogRows.map((ac) => ({
        code: ac.code,
        name: ac.name,
        impact: ac.impact,
      })),
      kpis: {
        matchesPlayed: matches.length,
        totalMinutes,
        totalActions,
        highlights,
      },
      timeline: timelineRows.map((row) => ({
        monthKey: row.monthKey,
        totalActions: row.totalActions,
        matchesPlayed: row.matchesPlayed,
      })),
      byMatch: {
        matches: matches.map((m) => ({
          matchId: m.match_id,
          opponent: m.opponent,
          matchDatetime: m.match_datetime.toISOString(),
          shortLabel: formatMatchShortLabel(m.opponent, m.match_datetime),
        })),
        rows: byMatchRows,
      },
      byMonth: {
        months: monthColumns,
        rows: byMonthRows,
      },
    };
  }
}

export const parentDashboardService = new ParentDashboardService();
