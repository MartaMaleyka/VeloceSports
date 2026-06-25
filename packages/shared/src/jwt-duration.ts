const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

/**
 * Convierte duraciones estilo jsonwebtoken (15m, 7d, 1h) a segundos.
 * Fuente única para alinear cookies SSR y TTL de sesión con el backend.
 */
export function parseJwtDurationToSeconds(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  const match = /^(\d+)([smhd])$/i.exec(trimmed);
  if (!match) {
    throw new Error(`Duración JWT inválida: ${value}`);
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  const multiplier = UNIT_SECONDS[unit];
  if (!multiplier || amount <= 0) {
    throw new Error(`Duración JWT inválida: ${value}`);
  }

  return amount * multiplier;
}

export function jwtDurationToMs(value: string): number {
  return parseJwtDurationToSeconds(value) * 1000;
}
