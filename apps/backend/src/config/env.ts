import { z } from 'zod';
import { parseJwtDurationToSeconds } from '@velocesport/shared';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  /** Tiempo máximo sin actividad antes de cerrar la sesión (ej. 60m, 1h). */
  SESSION_INACTIVITY_TIMEOUT: z.string().default('60m'),

  CORS_ORIGINS: z.string().min(1),

  SESSION_SECRET: z.string().min(16).optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(2_000),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),

  /** Ventana para deshacer inmediato (borrado físico sin traza) */
  GAME_ACTION_IMMEDIATE_UNDO_WINDOW_SECONDS: z.coerce.number().int().positive().default(10),

  /** Días tras finalizar en que se permiten correcciones post-partido */
  MATCH_CORRECTION_WINDOW_DAYS: z.coerce.number().int().positive().default(7),

  /** Object storage (MinIO) — fotos de jugadores */
  MINIO_ENDPOINT: z.string().min(1).default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().int().positive().default(9100),
  MINIO_ACCESS_KEY: z.string().min(1).default('minioadmin'),
  MINIO_SECRET_KEY: z.string().min(1).default('minioadmin_change_me'),
  MINIO_BUCKET: z.string().min(1).default('squadveloce-players'),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .default(false)
    .transform((v) => v === true || v === 'true' || v === '1'),
  /** Host/puerto que ve el navegador en las URLs firmadas (si difiere del endpoint interno). */
  MINIO_PUBLIC_ENDPOINT: z.string().min(1).optional(),
  MINIO_PUBLIC_PORT: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    throw new Error(`Variables de entorno inválidas: ${JSON.stringify(formatted)}`);
  }
  return result.data;
}

export const env = parseEnv();

export function getCorsOrigins(): string[] {
  return env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}

export function getGameActionImmediateUndoWindowMs(): number {
  return env.GAME_ACTION_IMMEDIATE_UNDO_WINDOW_SECONDS * 1000;
}

export function getMatchCorrectionWindowDays(): number {
  return env.MATCH_CORRECTION_WINDOW_DAYS;
}

export function getSessionInactivityTimeoutMs(): number {
  return parseJwtDurationToSeconds(env.SESSION_INACTIVITY_TIMEOUT) * 1000;
}
