import type { PlayerMatchInsightFactsDto, PlayerPeriodInsightFactsDto } from '@velocesport/shared';

export interface InsightTexts {
  player: string;
  parent: string;
  coach: string;
}

export interface GenerateInsightResult {
  result: InsightTexts;
  source: 'fallback';
}

export interface GeneratePeriodInsightResult {
  text: string;
  source: 'fallback';
}

type Locale = 'es' | 'en';

const DIMENSION_LABELS: Record<Locale, Record<string, string>> = {
  es: {
    attack: 'ataque',
    creation: 'creación de juego',
    defense: 'defensa',
    recovery: 'recuperación de balón',
    goalkeeping: 'portería',
    discipline: 'disciplina',
  },
  en: {
    attack: 'attack',
    creation: 'playmaking',
    defense: 'defense',
    recovery: 'ball recovery',
    goalkeeping: 'goalkeeping',
    discipline: 'discipline',
  },
};

const FALLBACK_MOTIVATION: Record<Locale, Record<string, string>> = {
  es: {
    default: '¡Buen partido! Cada minuto en la cancha suma experiencia.',
    attack: '¡Pura pólvora en ataque! Hoy marcaste la diferencia arriba.',
    creation: '¡Creatividad pura! Tus pases y regates abrieron el juego.',
    defense: '¡Dominaste la defensa hoy! Un muro en la cancha.',
    recovery: '¡Motor incansable! Recuperaste el balón una y otra vez.',
    goalkeeping: '¡Manos de oro! Protegiste el arco como un profesional.',
    discipline: '¡Juego limpio y concentrado! Gran actitud en la cancha.',
  },
  en: {
    default: 'Good match! Every minute on the pitch adds experience.',
    attack: 'Pure firepower up front! You made the difference today.',
    creation: 'Pure creativity! Your passes and dribbles opened up the game.',
    defense: 'You owned the defense today! A wall on the pitch.',
    recovery: 'Tireless engine! You won the ball back again and again.',
    goalkeeping: 'Golden hands! You protected the goal like a pro.',
    discipline: 'Clean, focused play! Great attitude on the pitch.',
  },
};

const TREND_LABELS: Record<Locale, Record<string, string>> = {
  es: {
    up: 'en aumento respecto al mes anterior',
    down: 'en descenso respecto al mes anterior',
    stable: 'estable respecto al mes anterior',
    unknown: 'sin suficiente historial para ver tendencia',
  },
  en: {
    up: 'trending up from the previous month',
    down: 'trending down from the previous month',
    stable: 'stable compared to the previous month',
    unknown: 'not enough history yet to see a trend',
  },
};

function dimensionLabel(slug: string | undefined, locale: Locale): string | null {
  if (!slug) return null;
  return DIMENSION_LABELS[locale][slug] ?? slug;
}

export function buildFallbackInsight(
  facts: PlayerMatchInsightFactsDto,
  locale: Locale = 'es',
): InsightTexts {
  const phrases = FALLBACK_MOTIVATION[locale];
  const strongLabel = dimensionLabel(facts.strongestDimension?.slug, locale);
  const weakLabel = dimensionLabel(facts.weakestDimension?.slug, locale);
  const motivation = strongLabel && facts.strongestDimension
    ? phrases[facts.strongestDimension.slug] ?? phrases.default
    : phrases.default;

  if (locale === 'en') {
    const caveat = !facts.hasEnoughData
      ? " There's still little data from this match to draw firm conclusions."
      : '';
    const improvementHint = weakLabel && weakLabel !== strongLabel
      ? ` Keep practicing ${weakLabel} to keep growing.`
      : '';
    return {
      player: `${motivation}${improvementHint}${caveat}`,
      parent: `${facts.playerFirstName} played ${facts.minutesPlayed} minutes against ${facts.opponent}.${strongLabel ? ` Their strongest area was ${strongLabel}.` : ''}${weakLabel ? ` A good way to help at home is encouraging practice around ${weakLabel}.` : ''}${caveat}`,
      coach: `${facts.playerFirstName}: ${strongLabel ? `strong in ${strongLabel}` : 'limited data this match'}${weakLabel ? `, with room to grow in ${weakLabel}` : ''}. Consider a focused drill on ${weakLabel ?? 'ball involvement'} in the next training session.${caveat}`,
    };
  }

  const caveat = !facts.hasEnoughData
    ? ' Todavía hay pocos datos de este partido para sacar conclusiones firmes.'
    : '';
  const improvementHint = weakLabel && weakLabel !== strongLabel
    ? ` Sigue practicando ${weakLabel} para seguir creciendo.`
    : '';
  return {
    player: `${motivation}${improvementHint}${caveat}`,
    parent: `${facts.playerFirstName} jugó ${facts.minutesPlayed} minutos frente a ${facts.opponent}.${strongLabel ? ` Su punto más fuerte fue ${strongLabel}.` : ''}${weakLabel ? ` Una buena forma de apoyar en casa es animarlo a practicar ${weakLabel}.` : ''}${caveat}`,
    coach: `${facts.playerFirstName}: ${strongLabel ? `destacó en ${strongLabel}` : 'pocos datos en este partido'}${weakLabel ? `, con espacio para crecer en ${weakLabel}` : ''}. Considera un ejercicio enfocado en ${weakLabel ?? 'participación con el balón'} en el próximo entrenamiento.${caveat}`,
  };
}

export function buildFallbackPeriodInsight(
  facts: PlayerPeriodInsightFactsDto,
  locale: Locale = 'es',
): string {
  const strongLabel = dimensionLabel(facts.strongestDimension?.slug, locale);
  const weakLabel = dimensionLabel(facts.weakestDimension?.slug, locale);
  const trendLabel = TREND_LABELS[locale][facts.trend];

  if (locale === 'en') {
    const caveat = !facts.hasEnoughData
      ? ' There is still limited data for this period to draw firm conclusions.'
      : '';
    return `${facts.playerFirstName}: ${facts.matchesPlayed} match(es), ${facts.minutesPlayed} minutes, ${facts.totalActions} actions (${trendLabel}).${strongLabel ? ` Strongest in ${strongLabel}.` : ''}${weakLabel && weakLabel !== strongLabel ? ` Room to grow in ${weakLabel} — consider a focused drill on it.` : ''}${caveat}`;
  }

  const caveat = !facts.hasEnoughData
    ? ' Todavía hay pocos datos en este periodo para sacar conclusiones firmes.'
    : '';
  return `${facts.playerFirstName}: ${facts.matchesPlayed} partido(s), ${facts.minutesPlayed} minutos, ${facts.totalActions} acciones (${trendLabel}).${strongLabel ? ` Su punto más fuerte es ${strongLabel}.` : ''}${weakLabel && weakLabel !== strongLabel ? ` Tiene espacio para crecer en ${weakLabel} — considera un ejercicio enfocado en eso.` : ''}${caveat}`;
}

export async function generatePlayerMatchInsight(
  facts: PlayerMatchInsightFactsDto,
  locale: Locale = 'es',
): Promise<GenerateInsightResult> {
  return { result: buildFallbackInsight(facts, locale), source: 'fallback' };
}

export async function generatePlayerPeriodInsight(
  facts: PlayerPeriodInsightFactsDto,
  locale: Locale = 'es',
): Promise<GeneratePeriodInsightResult> {
  return { text: buildFallbackPeriodInsight(facts, locale), source: 'fallback' };
}
