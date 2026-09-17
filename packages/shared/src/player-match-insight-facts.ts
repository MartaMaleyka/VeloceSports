import { PERFORMANCE_DIMENSION_SLUGS, type PerformanceDimensionSlug } from './performance-dimensions.js';
import type { PlayerMatchReportCardDto } from './player-match-report.js';
import type { ActionImpact } from './statuses.js';

export const MIN_MINUTES_FOR_CONFIDENT_INSIGHT = 10;
export const MIN_ACTIONS_FOR_CONFIDENT_INSIGHT = 3;

export interface PlayerMatchInsightDimensionFactDto {
  slug: PerformanceDimensionSlug;
  score: number;
  count: number;
}

export interface PlayerMatchInsightActionFactDto {
  name: string;
  impact: ActionImpact;
  count: number;
}

export interface PlayerMatchInsightFactsDto {
  playerFirstName: string;
  opponent: string;
  categoryName: string;
  minutesPlayed: number;
  totalActiveActions: number;
  averagePerMinute: number | null;
  hasEnoughData: boolean;
  strongestDimension: PlayerMatchInsightDimensionFactDto | null;
  weakestDimension: PlayerMatchInsightDimensionFactDto | null;
  missingDimensions: PerformanceDimensionSlug[];
  notableActions: PlayerMatchInsightActionFactDto[];
}

/**
 * Deriva señales estructuradas y verificables de un PlayerMatchReportCardDto ya calculado.
 * Sin red ni DB: pura función de datos a datos, para que el LLM redacte a partir de hechos
 * exactos en vez de tener que interpretar filas crudas.
 */
export function buildInsightFacts(
  reportCard: PlayerMatchReportCardDto,
): PlayerMatchInsightFactsDto {
  const { radarDimensions, actionsByCode, minutesPlayed, totalActiveActions } = reportCard;

  const hasEnoughData =
    minutesPlayed >= MIN_MINUTES_FOR_CONFIDENT_INSIGHT &&
    totalActiveActions >= MIN_ACTIONS_FOR_CONFIDENT_INSIGHT;

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
    playerFirstName: reportCard.player.firstName,
    opponent: reportCard.match.opponent,
    categoryName: reportCard.match.categoryName,
    minutesPlayed,
    totalActiveActions,
    averagePerMinute: reportCard.averagePerMinute,
    hasEnoughData,
    strongestDimension,
    weakestDimension,
    missingDimensions,
    notableActions,
  };
}
