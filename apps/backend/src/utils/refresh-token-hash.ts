import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * Los refresh tokens son JWT firmados con mucha entropía: no necesitan un hash
 * lento como las contraseñas. SHA-256 cuesta microsegundos frente a ~250 ms de
 * bcrypt(12) por login/refresh, y no trunca la entrada (bcrypt solo mira 72 bytes).
 */
const SHA256_PREFIX = 'sha256:';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function hashRefreshToken(refreshToken: string): Promise<string> {
  return `${SHA256_PREFIX}${sha256Hex(refreshToken)}`;
}

export async function verifyRefreshTokenHash(
  refreshToken: string,
  hash: string,
): Promise<boolean> {
  if (hash.startsWith(SHA256_PREFIX)) {
    const expected = Buffer.from(hash.slice(SHA256_PREFIX.length), 'hex');
    const actual = Buffer.from(sha256Hex(refreshToken), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  // Sesiones creadas antes del cambio (bcrypt): siguen siendo válidas hasta rotar.
  if (hash.startsWith('$2')) {
    return bcrypt.compare(refreshToken, hash);
  }
  return false;
}
