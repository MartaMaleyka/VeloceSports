import { PERFORMANCE_DIMENSION_SLUGS, type PerformanceDimensionSlug } from './performance-dimensions.js';
import type { CoachPlayerAnalysisDetailDto } from './coach-player-analysis.js';
import type { ActionImpact } from './statuses.js';

export const MIN_MINUTES_FOR_CONFIDENT_PERIOD_INSIGHT = 30;
export const MIN_ACTIONS_FOR_CONFIDENT_PERIOD_INSIGHT = 5;

export interface PlayerPeriodInsightDimensionFactDto {
  slug: PerformanceDimensionSlug;
  score: number;
  count: number;
}

export interface PlayerPeriodInsightActionFactDto {
  name: string;
  impact: ActionImpact;
  count: number;
}

export type PlayerPeriodInsightTrend = 'up' | 'down' | 'stable' | 'unknown';

export interface PlayerPeriodInsightFactsDto {
  playerFirstName: string;
  categoryName: string;
  filterSummary: string;
  matchesPlayed: number;
  minutesPlayed: number;
  totalActions: number;
  hasEnoughData: boolean;
  strongestDimension: PlayerPeriodInsightDimensionFactDto | null;
  weakestDimension: PlayerPeriodInsightDimensionFactDto | null;
  missingDimensions: PerformanceDimensionSlug[];
  notableActions: PlayerPeriodInsightActionFactDto[];
  trend: PlayerPeriodInsightTrend;
  observationsCount: number;
}

function computeTrend(evolutionByMonth: CoachPlayerAnalysisDetailDto['evolutionByMonth']): PlayerPeriodInsightTrend {
  if (evolutionByMonth.length < 2) return 'unknown';
  const sorted = [...evolutionByMonth].sort((a, b) => a.month.localeCompare(b.month));
  const last = sorted[sorted.length - 1]!.totalActions;
  const prev = sorted[sorted.length - 2]!.totalActions;
  if (prev === 0 && last === 0) return 'stable';
  if (last > prev) return 'up';
  if (last < prev) return 'down';
  return 'stable';
}

/**
 * Deriva señales estructuradas y verificables de un CoachPlayerAnalysisDetailDto ya
 * calculado (rango de fechas/categoría/partido que haya filtrado el coach). Sin red
 * ni DB: pura función de datos a datos.
 */
export function buildPeriodInsightFacts(
  detail: CoachPlayerAnalysisDetailDto,
): PlayerPeriodInsightFactsDto {
  const { radarDimensions, actionsByCode, summary, evolutionByMonth } = detail;

  const hasEnoughData =
    summary.minutesPlayed >= MIN_MINUTES_FOR_CONFIDENT_PERIOD_INSIGHT &&
    summary.totalActions >= MIN_ACTIONS_FOR_CONFIDENT_PERIOD_INSIGHT;

  const sortedByScoreDesc = [...radarDimensions].sort((a, b) => b.score - a.score);
  const strongestDimension = sortedByScoreDesc[0] ?? null;
  const weakestDimension =
    sortedByScoreDesc.length > 0 ? sortedByScoreDesc[sortedByScoreDesc.length - 1] : null;

  const presentSlugs = new Set(radarDimensions.map((d) => d.slug));
  const missingDimensions = PERFORMANCE_DIMENSION_SLUGS.filter((slug) => !presentSlugs.has(slug));

  const notableActions = [...actionsByCode]
    .sort((a, b) => {
      if (a.impact === 'negative' && b.impact !== 'negative') return -1;
      if (b.impact === 'negative' && a.impact !== 'negative') return 1;
      return b.count - a.count;
    })
    .slice(0, 3)
    .map((a) => ({ name: a.name, impact: a.impact, count: a.count }));

  return {
    playerFirstName: detail.player.firstName,
    categoryName: detail.player.category,
    filterSummary: detail.filterSummary,
    matchesPlayed: summary.matchesPlayed,
    minutesPlayed: summary.minutesPlayed,
    totalActions: summary.totalActions,
    hasEnoughData,
    strongestDimension,
    weakestDimension,
    missingDimensions,
    notableActions,
    trend: computeTrend(evolutionByMonth),
    observationsCount: detail.observations.length,
  };
}
