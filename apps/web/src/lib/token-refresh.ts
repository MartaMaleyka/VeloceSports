import type { AstroCookies } from 'astro';
import jwt from 'jsonwebtoken';
import { INTERNAL_API_URL } from 'astro:env/server';
import { REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from './auth-config.js';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';

/** Ventana proactiva antes de expirar el access (middleware SSR). */
export const ACCESS_REFRESH_BUFFER_SECONDS = 60;

export const SESSION_INACTIVITY_EXPIRED_CODE = 'SESSION_INACTIVITY_EXPIRED';

export type RefreshSessionResult =
  | { ok: true }
  | { ok: false; code?: string };

const refreshInflight = new Map<string, Promise<RefreshSessionResult>>();

export function isAccessTokenExpired(token: string, bufferSeconds = 0): boolean {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  if (!decoded?.exp) return true;
  return decoded.exp * 1000 <= Date.now() + bufferSeconds * 1000;
}

export function accessNeedsRefresh(
  cookies: AstroCookies,
  bufferSeconds = ACCESS_REFRESH_BUFFER_SECONDS,
): boolean {
  const access = cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!access) return Boolean(cookies.get(REFRESH_TOKEN_COOKIE)?.value);
  return isAccessTokenExpired(access, bufferSeconds);
}

export function hasRefreshToken(cookies: AstroCookies): boolean {
  return Boolean(cookies.get(REFRESH_TOKEN_COOKIE)?.value);
}

/**
 * Renueva cookies vía POST /auth/refresh. Single-flight por refresh token en este proceso.
 * Retorna ok:false si la sesión terminó (401/403) — cookies limpiadas.
 */
export async function refreshSessionCookies(cookies: AstroCookies): Promise<RefreshSessionResult> {
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) return { ok: false };

  const inflight = refreshInflight.get(refreshToken);
  if (inflight) return inflight;

  const promise = performRefresh(cookies, refreshToken).finally(() => {
    refreshInflight.delete(refreshToken);
  });

  refreshInflight.set(refreshToken, promise);
  return promise;
}

async function performRefresh(
  cookies: AstroCookies,
  refreshToken: string,
): Promise<RefreshSessionResult> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (res.ok) {
      const body = (await res.json()) as {
        success?: boolean;
        data?: { accessToken?: string; refreshToken?: string };
      };
      if (body.success && body.data?.accessToken && body.data?.refreshToken) {
        setAuthCookies(cookies, body.data.accessToken, body.data.refreshToken);
        return { ok: true };
      }
      return { ok: false };
    }

    if (res.status === 401 || res.status === 403) {
      let code: string | undefined;
      try {
        const body = (await res.json()) as { code?: string };
        code = body.code;
      } catch {
        /* respuesta no JSON */
      }
      clearAuthCookies(cookies);
      return { ok: false, code };
    }

    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Expuesto para tests — indica si hay un refresh en curso para el token dado. */
export function isRefreshInFlight(refreshToken: string): boolean {
  return refreshInflight.has(refreshToken);
}

/** Solo para tests — limpia el mapa de single-flight. */
export function resetRefreshInflightForTests(): void {
  refreshInflight.clear();
}
