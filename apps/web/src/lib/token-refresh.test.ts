import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AstroCookies } from 'astro';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './auth-config.js';
import {
  accessNeedsRefresh,
  isAccessTokenExpired,
  isRefreshInFlight,
  refreshSessionCookies,
  resetRefreshInflightForTests,
} from './token-refresh.js';
import { JWT_ACCESS_SECRET } from 'astro:env/server';

class MockCookies implements AstroCookies {
  private store = new Map<string, string>();

  get(key: string) {
    const value = this.store.get(key);
    if (!value) return undefined;
    return { value, name: key } as ReturnType<AstroCookies['get']>;
  }

  has(key: string) {
    return this.store.has(key);
  }

  set(key: string, value: string) {
    this.store.set(key, value);
  }

  delete(key: string) {
    this.store.delete(key);
  }

  headers() {
    return new Headers();
  }

  merge(cookies: string) {
    void cookies;
  }

  setValue(key: string, value: string) {
    this.store.set(key, value);
  }

  getValue(key: string) {
    return this.store.get(key);
  }
}

function signAccess(expiresIn: number | string): string {
  return jwt.sign(
    { userId: 1, role: 'academy_admin', roles: ['academy_admin'], tenantId: 10 },
    JWT_ACCESS_SECRET,
    { expiresIn },
  );
}

describe('token-refresh — Fase 3', () => {
  let cookies: MockCookies;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cookies = new MockCookies();
    resetRefreshInflightForTests();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRefreshInflightForTests();
  });

  it('detecta access expirado', () => {
    const expired = signAccess(-60);
    expect(isAccessTokenExpired(expired)).toBe(true);
    expect(isAccessTokenExpired(signAccess('15m'))).toBe(false);
  });

  it('accessNeedsRefresh es true cuando el access expiró y hay refresh', () => {
    cookies.setValue(ACCESS_TOKEN_COOKIE, signAccess(-60));
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'refresh-token');
    expect(accessNeedsRefresh(cookies, 0)).toBe(true);
  });

  it('refreshSessionCookies re-setea cookies con tokens nuevos', async () => {
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'old-refresh');
    const newAccess = signAccess('15m');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { accessToken: newAccess, refreshToken: 'new-refresh' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await refreshSessionCookies(cookies);
    expect(result.ok).toBe(true);
    expect(cookies.getValue(ACCESS_TOKEN_COOKIE)).toBe(newAccess);
    expect(cookies.getValue(REFRESH_TOKEN_COOKIE)).toBe('new-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refresh inválido limpia cookies (sesión terminada)', async () => {
    cookies.setValue(ACCESS_TOKEN_COOKIE, signAccess(-60));
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'revoked-refresh');
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, message: 'Sesión revocada' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await refreshSessionCookies(cookies);
    expect(result.ok).toBe(false);
    expect(cookies.getValue(ACCESS_TOKEN_COOKIE)).toBeUndefined();
    expect(cookies.getValue(REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  it('refresh concurrente comparte un solo fetch (single-flight)', async () => {
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'shared-refresh');
    const newAccess = signAccess('15m');

    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValueOnce(pending);

    const p1 = refreshSessionCookies(cookies);
    const p2 = refreshSessionCookies(cookies);

    expect(isRefreshInFlight('shared-refresh')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(
      new Response(
        JSON.stringify({
          success: true,
          data: { accessToken: newAccess, refreshToken: 'rotated-refresh' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propaga código SESSION_INACTIVITY_EXPIRED del backend', async () => {
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'idle-refresh');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          code: 'SESSION_INACTIVITY_EXPIRED',
          message: 'Tu sesión expiró por inactividad.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await refreshSessionCookies(cookies);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SESSION_INACTIVITY_EXPIRED');
    expect(cookies.getValue(REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });

  it('cada invocación de refresh dispara un solo fetch (sin bucle interno)', async () => {
    cookies.setValue(REFRESH_TOKEN_COOKIE, 'bad-refresh');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await refreshSessionCookies(cookies);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
