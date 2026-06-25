import jwt from 'jsonwebtoken';
import { JWT_ACCESS_SECRET } from 'astro:env/server';
import type { AstroCookies } from 'astro';
import type { LoginRole } from '@velocesport/shared';
import { ACCESS_TOKEN_COOKIE, type SessionUser } from './auth-config.js';
import {
  accessNeedsRefresh,
  hasRefreshToken,
  refreshSessionCookies,
  SESSION_INACTIVITY_EXPIRED_CODE,
} from './token-refresh.js';
import { clearAuthCookies } from './auth-cookies.js';

export type SessionEndReason = 'inactivity' | 'terminated';

export interface EnsureSessionResult {
  session: SessionUser | null;
  endReason?: SessionEndReason;
}

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
    const role = payload.role as LoginRole;
    const roles =
      Array.isArray(payload.roles) && payload.roles.length > 0
        ? (payload.roles as LoginRole[])
        : role
          ? [role]
          : [];
    if (roles.length === 0) {
      return null;
    }
    return {
      userId: Number(payload.userId),
      role: roles.includes(role) ? role : roles[0]!,
      roles,
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

/**
 * Obtiene sesión válida, renovando access con refresh si expiró o está por expirar.
 * Si el refresh falla, limpia cookies y retorna endReason para UX en login.
 */
export async function ensureSession(cookies: AstroCookies): Promise<EnsureSessionResult> {
  let session = getSession(cookies);

  if (session && !accessNeedsRefresh(cookies)) {
    return { session };
  }

  if (!hasRefreshToken(cookies)) {
    return { session: session ?? null };
  }

  const result = await refreshSessionCookies(cookies);
  if (!result.ok) {
    clearAuthCookies(cookies);
    return {
      session: null,
      endReason:
        result.code === SESSION_INACTIVITY_EXPIRED_CODE ? 'inactivity' : 'terminated',
    };
  }

  session = getSession(cookies);
  return { session: session ?? null };
}
