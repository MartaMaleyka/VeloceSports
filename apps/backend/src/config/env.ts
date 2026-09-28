import { z } from 'zod';
import { parseJwtDurationToSeconds } from '@velocesport/shared';

const envSchema = z.object({
  /**
   * Obligatorio: sin él el backend no debe asumir "development" (Swagger abierto,
   * rate limit global desactivado, rutas de herramientas dev habilitadas).
   */
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    required_error: 'NODE_ENV es obligatorio (development | test | production)',
  }),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string().min(1),
  /** Conexiones máximas del pool de MySQL. */
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  /** Tiempo máximo sin actividad antes de cerrar la sesión (ej. 60m, 1h). */
  SESSION_INACTIVITY_TIMEOUT: z.string().default('60m'),

  /** Días que se conservan sesiones expiradas/revocadas antes de borrarlas. */
  SESSION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z.string().min(1),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(2_000),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  /** Registro público (academias y cuentas personales), por IP. */
  AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  AUTH_SIGNUP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  /**
   * Proxies de confianza para leer la IP real desde X-Forwarded-For (valor de
   * `trust proxy` de Express). Por defecto solo redes locales/privadas: el BFF de
   * Astro en la red de Docker. Usa "false" si el backend queda expuesto directamente.
   */
  TRUST_PROXY: z.string().min(1).default('loopback, linklocal, uniquelocal'),

  /** Ventana para deshacer inmediato (borrado físico sin traza) */
  GAME_ACTION_IMMEDIATE_UNDO_WINDOW_SECONDS: z.coerce.number().int().positive().default(10),

  /** Días tras finalizar en que se permiten correcciones post-partido */
  MATCH_CORRECTION_WINDOW_DAYS: z.coerce.number().int().positive().default(7),

  /**
   * Job diario de facturas vencidas: marca `overdue` y SUSPENDE las academias
   * afectadas. Desactivado por defecto: activarlo es una decisión de negocio.
   */
  BILLING_OVERDUE_JOB_ENABLED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .default(false)
    .transform((v) => v === true || v === 'true' || v === '1'),
  BILLING_OVERDUE_JOB_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(6),

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

  /** Agente de interpretación de estadísticas — modelo local vía Ollama (sin datos a terceros). */
  OLLAMA_ENABLED: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .default(true)
    .transform((v) => v === true || v === 'true' || v === '1'),
  OLLAMA_BASE_URL: z.string().min(1).default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('llama3.2:3b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  /**
   * El endpoint de insight se consulta por polling (cada pocos segundos) mientras
   * se genera en segundo plano, no una sola vez por análisis — una sola generación
   * ya implica varias peticiones. El límite debe cubrir eso, no solo "N generaciones".
   */
  PLAYER_INSIGHT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  PLAYER_INSIGHT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
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

/** Convierte TRUST_PROXY al formato que acepta `app.set('trust proxy', ...)`. */
export function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
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
