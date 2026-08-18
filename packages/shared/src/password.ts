/** Longitud mínima alineada con registro/login. */
export const PASSWORD_MIN_LENGTH = 8;

/** Longitud de contraseñas temporales generadas por el sistema. */
export const TEMPORARY_PASSWORD_LENGTH = 12;

/** Al menos 8 caracteres, una letra y un dígito. */
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_STRENGTH_REGEX.test(password);
}

/** Caracteres ambiguos evitados: 0/O, 1/l/I. */
const SAFE_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const SAFE_UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const SAFE_DIGITS = '23456789';
const SAFE_SYMBOLS = '!@#$%&*?';

function pick(alphabet: string, randomByte: number): string {
  return alphabet[randomByte % alphabet.length]!;
}

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
    return bytes;
  }
  throw new Error('No hay generador de números aleatorios seguro disponible');
}

/**
 * Contraseña temporal legible: 12 caracteres, mezcla mayúsculas/minúsculas,
 * dígito y símbolo, sin caracteres confusos (0/O, 1/l/I).
 */
export function generateReadableTemporaryPassword(
  length: number = TEMPORARY_PASSWORD_LENGTH,
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): string {
  if (length < 8) {
    throw new Error('La contraseña temporal debe tener al menos 8 caracteres');
  }

  const bytes = randomBytes(length);
  const required = [
    pick(SAFE_LOWER, bytes[0]!),
    pick(SAFE_UPPER, bytes[1]!),
    pick(SAFE_DIGITS, bytes[2]!),
    pick(SAFE_SYMBOLS, bytes[3]!),
  ];

  const all = SAFE_LOWER + SAFE_UPPER + SAFE_DIGITS + SAFE_SYMBOLS;
  const chars = [...required];
  for (let i = required.length; i < length; i += 1) {
    chars.push(pick(all, bytes[i]!));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i % bytes.length]! % (i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join('');
}

export function isValidTemporaryPasswordShape(password: string): boolean {
  if (password.length !== TEMPORARY_PASSWORD_LENGTH) return false;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password) || !/[!@#$%&*?]/.test(password)) return false;
  if (/[0OIl1]/.test(password)) return false;
  return true;
}
