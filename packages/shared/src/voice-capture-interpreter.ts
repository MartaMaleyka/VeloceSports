import { PERFORMANCE_DIMENSION_RULES } from './performance-dimensions.js';

export type VoiceCaptureLocale = 'es' | 'en';

export interface VoiceCaptureCatalogAction {
  code: number;
  name: string;
  description?: string | null;
}

export interface VoiceCapturePresentPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
}

export type VoiceInterpretErrorCode =
  | 'empty'
  | 'no_jersey'
  | 'no_player'
  | 'no_action'
  | 'ambiguous_action';

export interface VoiceInterpretSuccess {
  ok: true;
  jerseyNumber: number;
  player: VoiceCapturePresentPlayer;
  action: VoiceCaptureCatalogAction;
  /** 0–100 */
  confidence: number;
  ambiguous: boolean;
}

export interface VoiceInterpretFailure {
  ok: false;
  code: VoiceInterpretErrorCode;
  confidence: number;
  jerseyNumber?: number;
  action?: VoiceCaptureCatalogAction;
  ambiguousCandidates?: VoiceCaptureCatalogAction[];
}

export type VoiceInterpretResult = VoiceInterpretSuccess | VoiceInterpretFailure;

/** Umbral para registrar sin confirmación cuando el toggle está off. */
export const VOICE_CAPTURE_AUTO_REGISTER_MIN_CONFIDENCE = 75;

const FILLER_WORDS: Record<VoiceCaptureLocale, readonly string[]> = {
  es: [
    'como',
    'en',
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'unos',
    'unas',
    'de',
    'del',
    'a',
    'al',
    'y',
    'e',
    'o',
    'u',
    'que',
    'es',
    'por',
    'para',
    'con',
    'sin',
    'su',
    'mi',
    'numero',
    'num',
    'dorsal',
    'camiseta',
    'jugador',
  ],
  en: [
    'like',
    'as',
    'in',
    'the',
    'a',
    'an',
    'to',
    'for',
    'of',
    'and',
    'or',
    'on',
    'at',
    'is',
    'it',
    'number',
    'num',
    'jersey',
    'player',
    'by',
  ],
};

const WORD_NUMBERS_ES: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
};

const WORD_NUMBERS_EN: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
};

const EN_COMPOUND_PREFIX: Record<string, number> = {
  twenty: 20,
  thirty: 30,
};

const EN_UNIT_SUFFIX: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};

/** Palabras de voz ES/EN que ayudan a emparejar acciones por código semántico (catálogo personalizable). */
const VOICE_SEMANTIC_KEYWORDS: Record<VoiceCaptureLocale, Record<number, readonly string[]>> = {
  es: {
    1: ['gol', 'goles', 'anoto', 'anotacion', 'marco', 'marco', 'convirtio', 'emboco'],
    2: ['asist', 'asistencia', 'asistio', 'asistió'],
    3: ['pase', 'paseo', 'completado', 'paso'],
    4: ['pase', 'errado', 'fallido', 'fallo'],
    5: ['tiro', 'arco', 'disparo', 'disparó', 'disparo'],
    6: ['tiro', 'desviado', 'fuera'],
    7: ['falta', 'cometida', 'cometio', 'cometió'],
    8: ['falta', 'recibida', 'recibio', 'recibió'],
    9: ['perdida', 'perdio', 'perdió', 'balon'],
    10: ['intercep', 'corte', 'intercepto', 'interceptó'],
    11: ['quite', 'entrada', 'tackle', 'quito', 'quitó'],
    12: ['despej', 'clear', 'despejo', 'despejó'],
    13: ['recuper', 'recuperacion', 'recupera', 'recupero', 'recuperó'],
    14: ['atajad', 'parada', 'porter', 'atajo', 'atajó'],
    15: ['salida', 'incorrecta'],
  },
  en: {
    1: ['goal', 'score', 'scored', 'scores'],
    2: ['assist'],
    3: ['pass', 'completed'],
    4: ['pass', 'wrong', 'failed'],
    5: ['shot', 'shoot', 'target'],
    6: ['shot', 'wide', 'miss'],
    7: ['foul', 'committed'],
    8: ['foul', 'received', 'drawn'],
    9: ['turnover', 'lost', 'possession'],
    10: ['intercept'],
    11: ['tackle', 'won'],
    12: ['clear', 'clearance'],
    13: ['recover', 'recovery', 'recovered', 'recovers'],
    14: ['save', 'keeper', 'goalkeeper'],
    15: ['clearance', 'wrong', 'distribution'],
  },
};

export function normalizeVoiceText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedNumberToken {
  value: number;
  start: number;
  end: number;
}

function wordNumberMap(locale: VoiceCaptureLocale): Record<string, number> {
  return locale === 'en' ? WORD_NUMBERS_EN : WORD_NUMBERS_ES;
}

function parseNumberTokens(normalized: string, locale: VoiceCaptureLocale): ParsedNumberToken[] {
  const tokens = normalized.split(' ').filter(Boolean);
  const map = wordNumberMap(locale);
  const found: ParsedNumberToken[] = [];
  let cursor = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const start = normalized.indexOf(token, cursor);
    const end = start + token.length;
    cursor = end;

    if (/^\d{1,2}$/.test(token)) {
      found.push({ value: Number.parseInt(token, 10), start, end });
      continue;
    }

    const direct = map[token];
    if (direct != null) {
      found.push({ value: direct, start, end });
      continue;
    }

    if (locale === 'en' && i + 1 < tokens.length) {
      const prefix = EN_COMPOUND_PREFIX[token];
      const suffix = EN_UNIT_SUFFIX[tokens[i + 1]];
      if (prefix != null && suffix != null) {
        const compound = `${token} ${tokens[i + 1]}`;
        const compoundStart = normalized.indexOf(compound, cursor - token.length);
        found.push({
          value: prefix + suffix,
          start: compoundStart,
          end: compoundStart + compound.length,
        });
        i += 1;
        cursor = compoundStart + compound.length;
      }
    }
  }

  return found;
}

function pickJerseyNumber(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length >= 2 && values.every((v) => v === values[0])) {
    return values[0];
  }
  return values[0];
}

function stripNumberTokens(normalized: string, tokens: ParsedNumberToken[]): string {
  if (tokens.length === 0) return normalized;
  let result = normalized;
  for (const token of [...tokens].sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, token.start)} ${result.slice(token.end)}`;
  }
  return normalizeVoiceText(result);
}

function removeFillerWords(normalized: string, locale: VoiceCaptureLocale): string {
  const fillers = new Set(FILLER_WORDS[locale]);
  return normalized
    .split(' ')
    .filter((token) => token.length > 0 && !fillers.has(token))
    .join(' ');
}

function semanticKeywordsForAction(
  action: VoiceCaptureCatalogAction,
  locale: VoiceCaptureLocale,
): string[] {
  const fromLocale = VOICE_SEMANTIC_KEYWORDS[locale][action.code] ?? [];
  const fromRules: string[] = [];
  for (const rule of PERFORMANCE_DIMENSION_RULES) {
    if (rule.codeHints.includes(action.code)) {
      fromRules.push(...rule.keywords);
    }
  }
  const nameTokens = normalizeVoiceText(action.name)
    .split(' ')
    .filter((t) => t.length >= 3);
  const descTokens = normalizeVoiceText(action.description ?? '')
    .split(' ')
    .filter((t) => t.length >= 4);

  return [...new Set([...fromLocale, ...fromRules, ...nameTokens, ...descTokens])];
}

interface ActionScore {
  action: VoiceCaptureCatalogAction;
  score: number;
}

function scoreActionMatch(
  remainder: string,
  action: VoiceCaptureCatalogAction,
  locale: VoiceCaptureLocale,
): number {
  if (!remainder) return 0;

  const normalizedName = normalizeVoiceText(action.name);
  let score = 0;

  if (remainder === normalizedName) {
    score += 120;
  } else if (normalizedName.includes(remainder) || remainder.includes(normalizedName)) {
    score += 90;
  }

  const nameTokens = normalizedName.split(' ').filter((t) => t.length >= 3);
  for (const token of nameTokens) {
    if (remainder.includes(token)) {
      score += 25;
    }
  }

  const keywords = semanticKeywordsForAction(action, locale);
  for (const keyword of keywords) {
    const kw = normalizeVoiceText(keyword);
    if (kw.length < 3) continue;
    if (remainder.includes(kw)) {
      score += 20;
    }
  }

  const tokens = remainder.split(' ').filter((t) => t.length >= 3);
  for (const token of tokens) {
    for (const keyword of keywords) {
      const kw = normalizeVoiceText(keyword);
      if (kw.length < 4) continue;
      if (token.startsWith(kw.slice(0, Math.min(kw.length, 5))) || kw.startsWith(token.slice(0, 4))) {
        score += 30;
      }
    }
  }

  return score;
}

function rankActions(
  remainder: string,
  catalog: VoiceCaptureCatalogAction[],
  locale: VoiceCaptureLocale,
): ActionScore[] {
  return catalog
    .map((action) => ({ action, score: scoreActionMatch(remainder, action, locale) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function computeConfidence(jerseyScore: number, actionScore: number, ambiguous: boolean): number {
  let confidence = Math.min(100, Math.round(jerseyScore * 0.4 + actionScore * 0.6));
  if (ambiguous) {
    confidence = Math.min(confidence, 60);
  }
  return confidence;
}

export interface InterpretVoiceCaptureInput {
  text: string;
  locale: VoiceCaptureLocale;
  presentPlayers: VoiceCapturePresentPlayer[];
  catalog: VoiceCaptureCatalogAction[];
}

function mergeActionRankings(a: ActionScore[], b: ActionScore[]): ActionScore[] {
  const map = new Map<number, ActionScore>();
  for (const item of [...a, ...b]) {
    const existing = map.get(item.action.code);
    if (!existing || item.score > existing.score) {
      map.set(item.action.code, item);
    }
  }
  return [...map.values()].sort((x, y) => y.score - x.score);
}

export function interpretVoiceCapture(input: InterpretVoiceCaptureInput): VoiceInterpretResult {
  const normalized = normalizeVoiceText(input.text);
  if (!normalized) {
    return { ok: false, code: 'empty', confidence: 0 };
  }

  const numberTokens = parseNumberTokens(normalized, input.locale);
  const jerseyCandidates = numberTokens.map((t) => t.value);
  const jerseyNumber = pickJerseyNumber(jerseyCandidates);

  if (jerseyNumber == null) {
    const ranked = rankActions(removeFillerWords(normalized, input.locale), input.catalog, input.locale);
    return {
      ok: false,
      code: 'no_jersey',
      confidence: ranked[0]?.score ?? 0,
      action: ranked[0]?.action,
    };
  }

  const presentByJersey = new Map(
    input.presentPlayers.map((p) => [p.jerseyNumber, p] as const),
  );
  const player = presentByJersey.get(jerseyNumber);
  if (!player) {
    return { ok: false, code: 'no_player', confidence: 0, jerseyNumber };
  }

  const remainder = removeFillerWords(
    stripNumberTokens(normalized, numberTokens),
    input.locale,
  );
  const fullWithoutFillers = removeFillerWords(normalized, input.locale);

  const ranked = mergeActionRankings(
    rankActions(remainder, input.catalog, input.locale),
    rankActions(fullWithoutFillers, input.catalog, input.locale),
  );
  if (ranked.length === 0) {
    return { ok: false, code: 'no_action', confidence: 30, jerseyNumber, action: undefined };
  }

  const best = ranked[0];
  const second = ranked[1];
  const ambiguous =
    second != null && second.score >= best.score * 0.85 && second.score >= 40;

  if (ambiguous) {
    return {
      ok: false,
      code: 'ambiguous_action',
      confidence: computeConfidence(80, best.score, true),
      jerseyNumber,
      action: best.action,
      ambiguousCandidates: ranked.slice(0, 3).map((r) => r.action),
    };
  }

  if (best.score < 25) {
    return { ok: false, code: 'no_action', confidence: best.score, jerseyNumber };
  }

  const confidence = computeConfidence(90, best.score, false);

  return {
    ok: true,
    jerseyNumber,
    player,
    action: best.action,
    confidence,
    ambiguous: false,
  };
}

const AFFIRMATIVE_ES = new Set(['si', 'sí', 'sip', 'dale', 'ok', 'okay', 'confirmar', 'confirmo', 'va', 'claro']);
const AFFIRMATIVE_EN = new Set(['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'sure', 'go']);

const NEGATIVE_ES = new Set(['no', 'cancelar', 'cancela', 'nada']);
const NEGATIVE_EN = new Set(['no', 'cancel', 'nope', 'stop']);

export function isVoiceAffirmation(text: string, locale: VoiceCaptureLocale): boolean {
  const normalized = normalizeVoiceText(text);
  if (!normalized) return false;
  const tokens = normalized.split(' ');
  const set = locale === 'en' ? AFFIRMATIVE_EN : AFFIRMATIVE_ES;
  return tokens.some((t) => set.has(t));
}

export function isVoiceCancellation(text: string, locale: VoiceCaptureLocale): boolean {
  const normalized = normalizeVoiceText(text);
  if (!normalized) return false;
  const tokens = normalized.split(' ');
  const set = locale === 'en' ? NEGATIVE_EN : NEGATIVE_ES;
  return tokens.some((t) => set.has(t));
}

/** Ventana para ignorar frases duplicadas tras reinicio del reconocimiento continuo. */
export const VOICE_PHRASE_DEDUPE_WINDOW_MS = 2_500;

export function shouldSkipDuplicateVoicePhrase(
  normalizedPhrase: string,
  lastProcessed: { text: string; at: number } | null,
  nowMs: number,
): boolean {
  if (!lastProcessed || !normalizedPhrase) return false;
  if (nowMs - lastProcessed.at > VOICE_PHRASE_DEDUPE_WINDOW_MS) return false;
  return normalizedPhrase === lastProcessed.text;
}

export interface VoiceUndoCommand {
  kind: 'undo';
  confidence: number;
}

export interface VoiceCorrectJerseyCommand {
  kind: 'correct_jersey';
  jerseyNumber: number;
  confidence: number;
  ambiguous: boolean;
}

export type VoiceCommandParse = VoiceUndoCommand | VoiceCorrectJerseyCommand;

export type VoicePhraseParseResult =
  | { type: 'empty' }
  | { type: 'undo'; command: VoiceUndoCommand }
  | { type: 'correct_jersey'; command: VoiceCorrectJerseyCommand }
  | { type: 'capture'; capture: VoiceInterpretResult };

const UNDO_TRIGGERS: Record<VoiceCaptureLocale, readonly string[]> = {
  es: ['deshacer', 'deshaz', 'deshace', 'cancela ultima', 'quita ultima', 'borra ultima', 'anula ultima'],
  en: ['undo', 'revert', 'cancel last', 'remove last', 'delete last'],
};

const CORRECT_PREFIX_ES =
  /^(?:no\s*(?:era|es|fue)|corregir|corrijo|era)\s+(?:el|la|al|a|numero|dorsal)?\s*/;
const CORRECT_PREFIX_EN =
  /^(?:no\s*(?:it\s+was|was)|correct(?:\s+to)?|correction)\s+(?:number|jersey|player)?\s*/;

function tryParseUndo(normalized: string, locale: VoiceCaptureLocale): VoiceUndoCommand | null {
  const triggers = UNDO_TRIGGERS[locale];
  for (const trigger of triggers) {
    if (normalized === trigger || normalized.startsWith(`${trigger} `)) {
      return { kind: 'undo', confidence: 95 };
    }
  }
  return null;
}

function tryParseCorrectJersey(
  normalized: string,
  locale: VoiceCaptureLocale,
  presentPlayers: VoiceCapturePresentPlayer[],
): VoiceCorrectJerseyCommand | null {
  const prefix = locale === 'en' ? CORRECT_PREFIX_EN : CORRECT_PREFIX_ES;
  if (!prefix.test(normalized)) return null;

  const rest = normalizeVoiceText(normalized.replace(prefix, ''));
  if (!rest) return null;

  const numberTokens = parseNumberTokens(rest, locale);
  if (numberTokens.length === 0) return null;

  const values = numberTokens.map((t) => t.value);
  const jerseyNumber = pickJerseyNumber(values);
  if (jerseyNumber == null) return null;

  const present = presentPlayers.some((p) => p.jerseyNumber === jerseyNumber);
  const ambiguous = numberTokens.length > 1 && !values.every((v) => v === values[0]);

  return {
    kind: 'correct_jersey',
    jerseyNumber,
    confidence: ambiguous ? 55 : present ? 90 : 70,
    ambiguous,
  };
}

export function parseVoiceCorrectionCommand(
  text: string,
  locale: VoiceCaptureLocale,
  presentPlayers: VoiceCapturePresentPlayer[],
): VoiceCommandParse | null {
  const normalized = normalizeVoiceText(text);
  if (!normalized) return null;

  const undo = tryParseUndo(normalized, locale);
  if (undo) return undo;

  return tryParseCorrectJersey(normalized, locale, presentPlayers);
}

export function parseVoicePhrase(input: InterpretVoiceCaptureInput): VoicePhraseParseResult {
  const normalized = normalizeVoiceText(input.text);
  if (!normalized) {
    return { type: 'empty' };
  }

  const command = parseVoiceCorrectionCommand(input.text, input.locale, input.presentPlayers);
  if (command?.kind === 'undo') {
    return { type: 'undo', command };
  }
  if (command?.kind === 'correct_jersey') {
    return { type: 'correct_jersey', command };
  }

  return { type: 'capture', capture: interpretVoiceCapture(input) };
}
