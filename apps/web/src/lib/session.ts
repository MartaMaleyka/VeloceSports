import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from 'astro:env/server';
import type { AstroCookies } from 'astro';
import type { LoginRole } from '@velocesport/shared';
import { ACCESS_TOKEN_COOKIE, type SessionUser } from './auth-config.js';

function getJwtSecret(): string {
  const secret = JWT_ACCESS_SECRET.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET no configurado o demasiado corto');
  }
  return secret;
}

export function getSession(cookies: AstroCookies): SessionUser | null {
  const token = cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[auth] JWT_ACCESS_SECRET inválido o ausente en apps/web/.env:', error);
    }
    return null;
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    return {
      userId: Number(payload.userId),
      role: payload.role as LoginRole,
      tenantId: payload.tenantId !== undefined ? Number(payload.tenantId) : null,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[auth] Verificación JWT fallida (¿secreto distinto al del backend?):', message);
    }
    return null;
  }
}

export function getAccessToken(cookies: AstroCookies): string | null {
  return cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}
