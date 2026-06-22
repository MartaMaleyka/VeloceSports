/** Slugs estables para i18n y frases motivacionales */
export const PerformanceDimensionSlug = {
  ATTACK: 'attack',
  CREATION: 'creation',
  DEFENSE: 'defense',
  RECOVERY: 'recovery',
  GOALKEEPING: 'goalkeeping',
  DISCIPLINE: 'discipline',
} as const;

export type PerformanceDimensionSlug =
  (typeof PerformanceDimensionSlug)[keyof typeof PerformanceDimensionSlug];

export const PERFORMANCE_DIMENSION_SLUGS: readonly PerformanceDimensionSlug[] = [
  PerformanceDimensionSlug.ATTACK,
  PerformanceDimensionSlug.CREATION,
  PerformanceDimensionSlug.DEFENSE,
  PerformanceDimensionSlug.RECOVERY,
  PerformanceDimensionSlug.GOALKEEPING,
  PerformanceDimensionSlug.DISCIPLINE,
];

export interface PerformanceDimensionRule {
  slug: PerformanceDimensionSlug;
  /** Códigos del catálogo base — solo pista si el tenant los conserva */
  codeHints: readonly number[];
  /** Palabras clave ES/EN para catálogos personalizados */
  keywords: readonly string[];
}

/**
 * Reglas semánticas para agrupar acciones del catálogo del tenant en ≤6 ejes de radar.
 * No fija acciones concretas: cada entrada del catálogo se mapea en runtime por código+texto.
 */
export const PERFORMANCE_DIMENSION_RULES: readonly PerformanceDimensionRule[] = [
  {
    slug: PerformanceDimensionSlug.ATTACK,
    codeHints: [1, 5, 6],
    keywords: ['gol', 'goal', 'tiro', 'shot', 'arco', 'shoot'],
  },
  {
    slug: PerformanceDimensionSlug.CREATION,
    codeHints: [2, 3, 4],
    keywords: ['asist', 'assist', 'pase', 'pass', 'regate', 'dribbl'],
  },
  {
    slug: PerformanceDimensionSlug.DEFENSE,
    codeHints: [10, 11, 12],
    keywords: ['intercep', 'quite', 'tackle', 'despej', 'clear', 'block', 'defen'],
  },
  {
    slug: PerformanceDimensionSlug.RECOVERY,
    codeHints: [13, 9],
    keywords: ['recuper', 'recover', 'pérdida', 'perdida', 'possession', 'balón', 'ball', 'turnover'],
  },
  {
    slug: PerformanceDimensionSlug.GOALKEEPING,
    codeHints: [14, 15],
    keywords: ['atajad', 'save', 'porter', 'goalkeeper', 'keeper', 'salida'],
  },
  {
    slug: PerformanceDimensionSlug.DISCIPLINE,
    codeHints: [7, 8],
    keywords: ['falta', 'foul', 'tarjeta', 'card'],
  },
] as const;

export interface CatalogActionForDimension {
  code: number;
  name: string;
  description?: string | null;
}

export function resolveActionDimension(
  action: CatalogActionForDimension,
): PerformanceDimensionSlug {
  for (const rule of PERFORMANCE_DIMENSION_RULES) {
    if (rule.codeHints.includes(action.code)) {
      return rule.slug;
    }
  }

  const text = `${action.name} ${action.description ?? ''}`.toLowerCase();
  let bestSlug: PerformanceDimensionSlug = PerformanceDimensionSlug.RECOVERY;
  let bestScore = 0;

  for (const rule of PERFORMANCE_DIMENSION_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
    }
  }

  return bestSlug;
}

export interface DimensionCountInput {
  slug: PerformanceDimensionSlug;
  count: number;
}

/** Normaliza conteos a 0–100 para el radar (máximo del partido = 100). */
export function normalizeRadarScores(
  dimensions: DimensionCountInput[],
): Array<{ slug: PerformanceDimensionSlug; count: number; score: number }> {
  const withData = dimensions.filter((d) => d.count > 0);
  const max = Math.max(...withData.map((d) => d.count), 0);
  if (max === 0) {
    return withData.map((d) => ({ slug: d.slug, count: d.count, score: 0 }));
  }
  return withData.map((d) => ({
    slug: d.slug,
    count: d.count,
    score: Math.round((d.count / max) * 100),
  }));
}

export function buildDimensionCountsFromActions(
  catalog: CatalogActionForDimension[],
  countsByCode: Map<number, number>,
): DimensionCountInput[] {
  const totals = new Map<PerformanceDimensionSlug, number>();
  for (const slug of PERFORMANCE_DIMENSION_SLUGS) {
    totals.set(slug, 0);
  }

  for (const item of catalog) {
    const count = countsByCode.get(item.code) ?? 0;
    if (count <= 0) continue;
    const slug = resolveActionDimension(item);
    totals.set(slug, (totals.get(slug) ?? 0) + count);
  }

  return PERFORMANCE_DIMENSION_SLUGS.map((slug) => ({
    slug,
    count: totals.get(slug) ?? 0,
  })).filter((d) => d.count > 0);
}

export function pickTopDimensionSlug(
  dimensions: DimensionCountInput[],
): PerformanceDimensionSlug | null {
  const sorted = [...dimensions].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  return sorted[0]?.slug ?? null;
}

export function averagePerMinute(total: number, minutes: number): number | null {
  if (minutes <= 0 || total <= 0) return null;
  return Math.round((total / minutes) * 100) / 100;
}
