import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isDevelopment, isTest } from '../config/env.js';

function clientIpKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/**
 * Login: clave IP + email. Así un atacante no bloquea el acceso de toda la
 * plataforma (todas las peticiones llegan vía el mismo BFF) y la fuerza bruta
 * contra una cuenta sigue limitada por origen.
 */
export function loginRateLimitKey(req: Request): string {
  const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  return `${clientIpKey(req)}|${email}`;
}

/** Insights: por usuario autenticado (el costo es generar con el modelo, no la IP). */
export function userRateLimitKey(req: Request): string {
  return req.user ? `user:${req.user.userId}` : `ip:${clientIpKey(req)}`;
}

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  /** Dev/test: captura en vivo y pruebas superan 100 req/15 min fácilmente. */
  skip: () => isDevelopment() || isTest(),
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  },
});

export const authLoginRateLimiter = rateLimit({
  windowMs: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginRateLimitKey,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
  },
});

export const authSignupRateLimiter = rateLimit({
  windowMs: env.AUTH_SIGNUP_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_SIGNUP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKey,
  message: {
    success: false,
    message: 'Demasiados registros desde esta conexión. Intenta de nuevo más tarde.',
  },
});

export const playerInsightRateLimiter = rateLimit({
  windowMs: env.PLAYER_INSIGHT_RATE_LIMIT_WINDOW_MS,
  max: env.PLAYER_INSIGHT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userRateLimitKey,
  message: {
    success: false,
    message: 'Demasiadas solicitudes de análisis. Intenta de nuevo más tarde.',
  },
});
