import crypto from 'node:crypto';

const TEMP_PASSWORD_LENGTH = 12;

export function generateTemporaryPassword(): string {
  const raw = crypto.randomBytes(16).toString('base64url');
  return raw.slice(0, TEMP_PASSWORD_LENGTH);
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
