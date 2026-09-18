import { z } from 'zod';
import type { PlayerMatchInsightFactsDto, PlayerPeriodInsightFactsDto } from '@velocesport/shared';
import { env } from '../config/env.js';

export interface OllamaInsightResult {
  player: string;
  parent: string;
  coach: string;
}

export interface GenerateInsightResult {
  result: OllamaInsightResult;
  source: 'ollama' | 'fallback';
}

const MAX_TEXT_LENGTH = 600;

const ollamaInsightSchema = z.object({
  player: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  parent: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  coach: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

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

/**
 * Frases base de respaldo (sin red), mantenidas alineadas a mano con
 * reportCard.motivation.<slug> en packages/i18n. Solo se usan si Ollama
 * no está disponible o no devuelve un JSON válido.
 */
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

function dimensionLabel(slug: string | undefined, locale: Locale): string | null {
  if (!slug) return null;
  return DIMENSION_LABELS[locale][slug] ?? slug;
}

export function buildFallbackInsight(
  facts: PlayerMatchInsightFactsDto,
  locale: Locale = 'es',
): OllamaInsightResult {
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

function buildSystemPrompt(locale: Locale): string {
  if (locale === 'en') {
    return `You are an assistant that helps interpret performance statistics for young football/sports academy players. Work EXCLUSIVELY from the data given in the user message: never invent numbers, results, opponent names, injuries, or comparisons to matches not explicitly mentioned.

Generate three short texts (2 to 4 sentences each) about the same match, each with a different tone:
- "player": addressed directly to the player (who may be a minor). Close, positive, motivating tone, second person ("you played", "you achieved"). Never critical, sarcastic, or harmful to a child's or teen's self-esteem. If there's something to improve, frame it as an achievable challenge, never as criticism.
- "parent": addressed to the player's parent or guardian. Informative, neutral tone, third person, explaining strengths and one concrete way to support practice at home (avoid excessive technical language).
- "coach": addressed to the coach. Technical, direct tone, third person, naming the strong dimension, the dimension to reinforce, and one concrete training suggestion.

If the data shows few minutes played or few recorded actions, say so explicitly and avoid categorical conclusions ("with limited data it's not yet possible to say for certain that...").

Never mention medical records, injuries, comparisons naming other players, or personal data beyond what is given.

Respond ONLY with a valid JSON object, no text before or after, with exactly this shape:
{"player": "...", "parent": "...", "coach": "..."}`;
  }

  return `Eres un asistente que ayuda a interpretar estadísticas de rendimiento de jugadores jóvenes de fútbol/deporte formativo. Trabajas EXCLUSIVAMENTE con los datos que se te entregan en el mensaje del usuario: nunca inventes cifras, resultados, nombres de rivales, lesiones ni comparaciones con partidos anteriores que no se mencionen explícitamente.

Debes generar tres textos breves (2 a 4 frases cada uno) sobre el mismo partido, cada uno con un tono distinto:
- "player": dirigido directamente al jugador (puede ser menor de edad). Tono cercano, positivo y motivador, en segunda persona ("jugaste", "lograste"). Nunca uses lenguaje crítico, sarcástico ni que pueda herir la autoestima de un niño o adolescente. Si hay algo a mejorar, formúlalo como un reto alcanzable, nunca como una crítica.
- "parent": dirigido a la madre, padre o tutor del jugador. Tono informativo y neutral, en tercera persona, explicando fortalezas y una recomendación concreta de apoyo en casa (sin lenguaje técnico excesivo).
- "coach": dirigido al entrenador. Tono técnico y directo, en tercera persona, mencionando la dimensión fuerte, la dimensión a reforzar y una sugerencia concreta de entrenamiento.

Si los datos indican pocos minutos jugados o pocas acciones registradas, dilo explícitamente y evita conclusiones categóricas ("con pocos datos aún no se puede afirmar con certeza que...").

Nunca menciones tarjetas médicas, lesiones, comparaciones con otros jugadores por nombre, ni datos personales fuera de los entregados.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con exactamente esta forma:
{"player": "...", "parent": "...", "coach": "..."}`;
}

function buildUserPrompt(facts: PlayerMatchInsightFactsDto, locale: Locale): string {
  const strong = facts.strongestDimension;
  const weak = facts.weakestDimension;
  const missing = facts.missingDimensions.map((slug) => dimensionLabel(slug, locale)).join(', ');
  const actions = facts.notableActions
    .map((a) => `- ${a.name}: ${a.count} ${locale === 'en' ? 'time(s)' : 'vez/veces'} (${a.impact})`)
    .join('\n');

  if (locale === 'en') {
    return `Match data to generate the analysis:

Player: ${facts.playerFirstName}
Category: ${facts.categoryName}
Opponent: ${facts.opponent}
Minutes played: ${facts.minutesPlayed}
Total active actions: ${facts.totalActiveActions}
Average actions per minute: ${facts.averagePerMinute ?? 'n/a'}
Enough data to draw confident conclusions?: ${facts.hasEnoughData ? 'yes' : 'no'}
Strongest dimension: ${strong ? `${dimensionLabel(strong.slug, locale)} (score ${strong.score}/100, ${strong.count} actions)` : 'not enough data'}
Weakest dimension with recorded data: ${weak ? `${dimensionLabel(weak.slug, locale)} (score ${weak.score}/100, ${weak.count} actions)` : 'not enough data'}
Dimensions with no recorded actions this match: ${missing || 'none'}
Most notable actions:
${actions || '- none recorded'}

Generate the JSON with the three texts per the system instructions.`;
  }

  return `Datos del partido para generar el análisis:

Jugador: ${facts.playerFirstName}
Categoría: ${facts.categoryName}
Rival: ${facts.opponent}
Minutos jugados: ${facts.minutesPlayed}
Acciones activas totales: ${facts.totalActiveActions}
Promedio de acciones por minuto: ${facts.averagePerMinute ?? 'sin datos'}
¿Hay suficientes datos para opinar con confianza?: ${facts.hasEnoughData ? 'sí' : 'no'}
Dimensión más fuerte: ${strong ? `${dimensionLabel(strong.slug, locale)} (score ${strong.score}/100, ${strong.count} acciones)` : 'sin datos suficientes'}
Dimensión más débil con datos registrados: ${weak ? `${dimensionLabel(weak.slug, locale)} (score ${weak.score}/100, ${weak.count} acciones)` : 'sin datos suficientes'}
Dimensiones sin acciones registradas en este partido: ${missing || 'ninguna'}
Acciones más notables:
${actions || '- ninguna registrada'}

Genera el JSON con los tres textos según las instrucciones del sistema.`;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callOllama(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.4 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const body = (await response.json()) as { response?: string };
    return body.response ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Serializa las llamadas a Ollama backend-wide: el servidor corre el modelo en CPU
 * con poca RAM libre, así que no conviene disparar varias inferencias de 8B a la vez.
 */
let ollamaQueue: Promise<unknown> = Promise.resolve();

function withOllamaLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = ollamaQueue.then(fn, fn);
  ollamaQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function generatePlayerMatchInsight(
  facts: PlayerMatchInsightFactsDto,
  locale: Locale = 'es',
): Promise<GenerateInsightResult> {
  if (!env.OLLAMA_ENABLED) {
    return { result: buildFallbackInsight(facts, locale), source: 'fallback' };
  }

  const raw = await withOllamaLock(() =>
    callOllama(buildSystemPrompt(locale), buildUserPrompt(facts, locale)),
  );
  if (raw) {
    const parsed = tryParseJson(raw);
    const validated = ollamaInsightSchema.safeParse(parsed);
    if (validated.success) {
      return { result: validated.data, source: 'ollama' };
    }
  }

  return { result: buildFallbackInsight(facts, locale), source: 'fallback' };
}

export interface GeneratePeriodInsightResult {
  text: string;
  source: 'ollama' | 'fallback';
}

const ollamaPeriodInsightSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

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

function buildPeriodSystemPrompt(locale: Locale): string {
  if (locale === 'en') {
    return `You are an assistant that helps a coach interpret a young player's performance statistics over a period (a date range, a category, or a set of matches — not a single match). Work EXCLUSIVELY from the data given in the user message: never invent numbers, opponent names, injuries, or comparisons not explicitly mentioned.

Write one short paragraph (3 to 5 sentences) addressed to the coach: technical, direct, third person. Name the player's strongest dimension, the dimension to reinforce, mention the trend if it is meaningful, and end with one concrete training suggestion.

If the data shows few minutes or few recorded actions for this period, say so explicitly and avoid categorical conclusions.

Never mention medical records, injuries, or comparisons naming other players.

Respond ONLY with a valid JSON object, no text before or after, with exactly this shape:
{"text": "..."}`;
  }

  return `Eres un asistente que ayuda a un entrenador a interpretar las estadísticas de rendimiento de un jugador joven durante un periodo (un rango de fechas, una categoría, o un conjunto de partidos — no un solo partido). Trabajas EXCLUSIVAMENTE con los datos que se te entregan en el mensaje del usuario: nunca inventes cifras, nombres de rivales, lesiones ni comparaciones que no se mencionen explícitamente.

Escribe un solo párrafo breve (3 a 5 frases) dirigido al entrenador: tono técnico y directo, en tercera persona. Nombra la dimensión más fuerte del jugador, la dimensión a reforzar, menciona la tendencia si es relevante, y termina con una sugerencia concreta de entrenamiento.

Si los datos indican pocos minutos o pocas acciones registradas en este periodo, dilo explícitamente y evita conclusiones categóricas.

Nunca menciones tarjetas médicas, lesiones, ni comparaciones con otros jugadores por nombre.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con exactamente esta forma:
{"text": "..."}`;
}

function buildPeriodUserPrompt(facts: PlayerPeriodInsightFactsDto, locale: Locale): string {
  const strong = facts.strongestDimension;
  const weak = facts.weakestDimension;
  const missing = facts.missingDimensions.map((slug) => dimensionLabel(slug, locale)).join(', ');
  const actions = facts.notableActions
    .map((a) => `- ${a.name}: ${a.count} ${locale === 'en' ? 'time(s)' : 'vez/veces'} (${a.impact})`)
    .join('\n');
  const trendLabel = TREND_LABELS[locale][facts.trend];

  if (locale === 'en') {
    return `Period data to generate the analysis:

Player: ${facts.playerFirstName}
Category: ${facts.categoryName}
Period/filter applied: ${facts.filterSummary}
Matches played: ${facts.matchesPlayed}
Minutes played: ${facts.minutesPlayed}
Total actions: ${facts.totalActions}
Monthly trend: ${trendLabel}
Enough data to draw confident conclusions?: ${facts.hasEnoughData ? 'yes' : 'no'}
Strongest dimension: ${strong ? `${dimensionLabel(strong.slug, locale)} (score ${strong.score}/100, ${strong.count} actions)` : 'not enough data'}
Weakest dimension with recorded data: ${weak ? `${dimensionLabel(weak.slug, locale)} (score ${weak.score}/100, ${weak.count} actions)` : 'not enough data'}
Dimensions with no recorded actions in this period: ${missing || 'none'}
Most notable actions:
${actions || '- none recorded'}
Coach observations on file for this player/period: ${facts.observationsCount}

Generate the JSON with the text per the system instructions.`;
  }

  return `Datos del periodo para generar el análisis:

Jugador: ${facts.playerFirstName}
Categoría: ${facts.categoryName}
Periodo/filtro aplicado: ${facts.filterSummary}
Partidos jugados: ${facts.matchesPlayed}
Minutos jugados: ${facts.minutesPlayed}
Acciones totales: ${facts.totalActions}
Tendencia mensual: ${trendLabel}
¿Hay suficientes datos para opinar con confianza?: ${facts.hasEnoughData ? 'sí' : 'no'}
Dimensión más fuerte: ${strong ? `${dimensionLabel(strong.slug, locale)} (score ${strong.score}/100, ${strong.count} acciones)` : 'sin datos suficientes'}
Dimensión más débil con datos registrados: ${weak ? `${dimensionLabel(weak.slug, locale)} (score ${weak.score}/100, ${weak.count} acciones)` : 'sin datos suficientes'}
Dimensiones sin acciones registradas en este periodo: ${missing || 'ninguna'}
Acciones más notables:
${actions || '- ninguna registrada'}
Observaciones del coach registradas para este jugador/periodo: ${facts.observationsCount}

Genera el JSON con el texto según las instrucciones del sistema.`;
}

export async function generatePlayerPeriodInsight(
  facts: PlayerPeriodInsightFactsDto,
  locale: Locale = 'es',
): Promise<GeneratePeriodInsightResult> {
  if (!env.OLLAMA_ENABLED) {
    return { text: buildFallbackPeriodInsight(facts, locale), source: 'fallback' };
  }

  const raw = await withOllamaLock(() =>
    callOllama(buildPeriodSystemPrompt(locale), buildPeriodUserPrompt(facts, locale)),
  );
  if (raw) {
    const parsed = tryParseJson(raw);
    const validated = ollamaPeriodInsightSchema.safeParse(parsed);
    if (validated.success) {
      return { text: validated.data.text, source: 'ollama' };
    }
  }

  return { text: buildFallbackPeriodInsight(facts, locale), source: 'fallback' };
}
