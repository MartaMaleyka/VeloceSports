import {
  BASE_ACTION_CATALOG,
  interpretVoiceCapture,
  isVoiceAffirmation,
  isVoiceCancellation,
  parseVoiceCorrectionCommand,
  parseVoicePhrase,
  shouldSkipDuplicateVoicePhrase,
  VOICE_CAPTURE_AUTO_REGISTER_MIN_CONFIDENCE,
  VOICE_PHRASE_DEDUPE_WINDOW_MS,
  type VoiceCapturePresentPlayer,
} from '@velocesport/shared';

function catalogEs() {
  return BASE_ACTION_CATALOG.map((a) => ({
    code: a.code,
    name: a.name,
    description: a.description,
  }));
}

function catalogEn() {
  return BASE_ACTION_CATALOG.map((a) => ({
    code: a.code,
    name:
      a.code === 1
        ? 'Goal'
        : a.code === 13
          ? 'Ball recovery'
          : a.name,
    description: a.description,
  }));
}

const presentPlayers: VoiceCapturePresentPlayer[] = [
  { playerId: 1, firstName: 'Ana', lastName: 'Rodríguez', jerseyNumber: 7 },
  { playerId: 2, firstName: 'Luis', lastName: 'Pérez', jerseyNumber: 10 },
  { playerId: 3, firstName: 'Carlos', lastName: 'Mora', jerseyNumber: 12 },
  { playerId: 4, firstName: 'Diego', lastName: 'Vega', jerseyNumber: 14 },
];

describe('interpretVoiceCapture', () => {
  it('parses "siete gol" as jersey 7 + Gol', () => {
    const result = interpretVoiceCapture({
      text: 'siete gol',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jerseyNumber).toBe(7);
      expect(result.action.code).toBe(1);
      expect(result.action.name).toBe('Gol');
      expect(result.confidence).toBeGreaterThanOrEqual(VOICE_CAPTURE_AUTO_REGISTER_MIN_CONFIDENCE);
    }
  });

  it('ignores filler in "como 14 recuperación"', () => {
    const result = interpretVoiceCapture({
      text: 'como 14 recuperación',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jerseyNumber).toBe(14);
      expect(result.action.code).toBe(13);
    }
  });

  it('handles duplicate numbers "12 12 gol" as jersey 12 + Gol', () => {
    const result = interpretVoiceCapture({
      text: '12 12 gol',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jerseyNumber).toBe(12);
      expect(result.action.code).toBe(1);
    }
  });

  it('returns no_player when jersey is not on the pitch', () => {
    const result = interpretVoiceCapture({
      text: 'veintitrés gol',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_player');
      expect(result.jerseyNumber).toBe(23);
    }
  });

  it('returns no_action when action is not recognized', () => {
    const result = interpretVoiceCapture({
      text: 'siete xyzabc',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_action');
      expect(result.jerseyNumber).toBe(7);
    }
  });

  it('works in English: "seven goal" → #7 + Goal', () => {
    const result = interpretVoiceCapture({
      text: 'seven goal',
      locale: 'en',
      presentPlayers,
      catalog: catalogEn(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jerseyNumber).toBe(7);
      expect(result.action.code).toBe(1);
      expect(result.action.name).toBe('Goal');
    }
  });

  it('matches tenant custom catalog names via semantic keywords', () => {
    const customCatalog = [
      {
        code: 99,
        name: 'Anotación especial',
        description: 'Cuando el jugador convierte',
      },
    ];
    const result = interpretVoiceCapture({
      text: 'diez gol',
      locale: 'es',
      presentPlayers,
      catalog: customCatalog,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_action');
    }

    const customWithKeyword = [
      {
        code: 99,
        name: 'Anotación especial',
        description: 'Gol convertido en jugada',
      },
    ];
    const ok = interpretVoiceCapture({
      text: 'diez anotacion',
      locale: 'es',
      presentPlayers,
      catalog: customWithKeyword,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.action.code).toBe(99);
    }
  });

  it('detects partial parse for action-only phrases like "en gol"', () => {
    const result = interpretVoiceCapture({
      text: 'en gol',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_jersey');
      expect(result.action?.code).toBe(1);
    }
  });

  it('detects partial parse for jersey-only phrases like "como 14"', () => {
    const result = interpretVoiceCapture({
      text: 'como 14',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('no_action');
      expect(result.jerseyNumber).toBe(14);
    }
  });

  it('parses natural ES variants with inverted order and verbs', () => {
    const cases = [
      { text: 'gol del siete', jersey: 7, code: 1 },
      { text: 'el siete marcó', jersey: 7, code: 1 },
      { text: 'siete anotó', jersey: 7, code: 1 },
      { text: 'recuperó el diez', jersey: 10, code: 13 },
    ];
    for (const c of cases) {
      const result = interpretVoiceCapture({
        text: c.text,
        locale: 'es',
        presentPlayers,
        catalog: catalogEs(),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.jerseyNumber).toBe(c.jersey);
        expect(result.action.code).toBe(c.code);
      }
    }
  });

  it('parses natural EN variants', () => {
    for (const text of ['goal by seven', 'seven scored']) {
      const result = interpretVoiceCapture({
        text,
        locale: 'en',
        presentPlayers,
        catalog: catalogEn(),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.jerseyNumber).toBe(7);
        expect(result.action.code).toBe(1);
      }
    }
  });
});

describe('parseVoiceCorrectionCommand', () => {
  it('detects undo commands in ES and EN', () => {
    expect(parseVoiceCorrectionCommand('deshacer', 'es', presentPlayers)?.kind).toBe('undo');
    expect(parseVoiceCorrectionCommand('undo', 'en', presentPlayers)?.kind).toBe('undo');
  });

  it('detects jersey correction commands', () => {
    const es = parseVoiceCorrectionCommand('no era el ocho', 'es', presentPlayers);
    expect(es?.kind).toBe('correct_jersey');
    if (es?.kind === 'correct_jersey') {
      expect(es.jerseyNumber).toBe(8);
    }

    const en = parseVoiceCorrectionCommand('no it was eight', 'en', presentPlayers);
    expect(en?.kind).toBe('correct_jersey');
    if (en?.kind === 'correct_jersey') {
      expect(en.jerseyNumber).toBe(8);
    }
  });

  it('does not treat normal capture as correction', () => {
    expect(parseVoiceCorrectionCommand('siete gol', 'es', presentPlayers)).toBeNull();
  });
});

describe('parseVoicePhrase routing', () => {
  it('routes undo before capture interpretation', () => {
    const parsed = parseVoicePhrase({
      text: 'deshacer',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(parsed.type).toBe('undo');
  });

  it('routes capture phrases to interpreter', () => {
    const parsed = parseVoicePhrase({
      text: 'siete gol',
      locale: 'es',
      presentPlayers,
      catalog: catalogEs(),
    });
    expect(parsed.type).toBe('capture');
    if (parsed.type === 'capture') {
      expect(parsed.capture.ok).toBe(true);
    }
  });
});

describe('voice phrase deduplication', () => {
  it('skips duplicate phrases within window', () => {
    const now = 10_000;
    const last = { text: 'siete gol', at: now - 500 };
    expect(shouldSkipDuplicateVoicePhrase('siete gol', last, now)).toBe(true);
    expect(shouldSkipDuplicateVoicePhrase('siete gol', last, now + VOICE_PHRASE_DEDUPE_WINDOW_MS + 1)).toBe(false);
  });
});

describe('voice confirmation phrases', () => {
  it('recognizes affirmations and cancellations bilingually', () => {
    expect(isVoiceAffirmation('sí', 'es')).toBe(true);
    expect(isVoiceAffirmation('yes please', 'en')).toBe(true);
    expect(isVoiceCancellation('no', 'es')).toBe(true);
    expect(isVoiceCancellation('cancel', 'en')).toBe(true);
  });
});
