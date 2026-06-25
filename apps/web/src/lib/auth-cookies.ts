import type { AstroCookies } from 'astro';
import { parseJwtDurationToSeconds } from '@velocesport/shared';
import { JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } from 'astro:env/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth-config.js';

function cookiePath(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  if (base === '/') return '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function cookieMaxAgeSeconds(duration: string, fallback: string): number {
  try {
    return parseJwtDurationToSeconds(duration);
  } catch {
    return parseJwtDurationToSeconds(fallback);
  }
}

export function setAuthCookies(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken: string,
): void {
  const secure = import.meta.env.PROD;
  const accessMaxAge = cookieMaxAgeSeconds(JWT_ACCESS_EXPIRES_IN, '15m');
  const refreshMaxAge = cookieMaxAgeSeconds(JWT_REFRESH_EXPIRES_IN, '7d');

  cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: cookiePath(),
    maxAge: accessMaxAge,
  });

  cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: cookiePath(),
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(cookies: AstroCookies): void {
  const path = cookiePath();
  cookies.delete(ACCESS_TOKEN_COOKIE, { path });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path });
}
