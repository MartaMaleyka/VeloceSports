import bcrypt from 'bcryptjs';

const REFRESH_HASH_ROUNDS = 12;

export async function hashRefreshToken(refreshToken: string): Promise<string> {
  return bcrypt.hash(refreshToken, REFRESH_HASH_ROUNDS);
}

export async function verifyRefreshTokenHash(
  refreshToken: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(refreshToken, hash);
}
