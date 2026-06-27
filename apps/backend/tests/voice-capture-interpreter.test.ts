import {
  BASE_ACTION_CATALOG,
  interpretVoiceCapture,
  isVoiceAffirmation,
  isVoiceCancellation,
  VOICE_CAPTURE_AUTO_REGISTER_MIN_CONFIDENCE,
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
});

describe('voice confirmation phrases', () => {
  it('recognizes affirmations and cancellations bilingually', () => {
    expect(isVoiceAffirmation('sí', 'es')).toBe(true);
    expect(isVoiceAffirmation('yes please', 'en')).toBe(true);
    expect(isVoiceCancellation('no', 'es')).toBe(true);
    expect(isVoiceCancellation('cancel', 'en')).toBe(true);
  });
});
