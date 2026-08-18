import crypto from 'node:crypto';
import { generateReadableTemporaryPassword } from '@velocesport/shared';

const TEMP_PASSWORD_LENGTH = 12;

export function generateTemporaryPassword(): string {
  return generateReadableTemporaryPassword(TEMP_PASSWORD_LENGTH, (n) => crypto.randomBytes(n));
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
