import type { AstroCookies } from 'astro';
import { getAccessToken, getSession } from './session.js';
import { hasRefreshToken, refreshSessionCookies } from './token-refresh.js';

export interface BffProxyOptions {
  cookies: AstroCookies;
  request: Request;
  targetUrl: string;
  method: string;
  /** Si devuelve Response, se retorna de inmediato (403, etc.). */
  assertAccess?: () => Response | null;
  body?: string;
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthenticatedResponse(): Response {
  return jsonResponse({ success: false, message: 'No autenticado' }, 401);
}

async function resolveAccessToken(cookies: AstroCookies): Promise<string | null> {
  let token = getAccessToken(cookies);
  if (token && getSession(cookies)) return token;

  if (!hasRefreshToken(cookies)) return null;

  const refreshed = await refreshSessionCookies(cookies);
  if (!refreshed.ok) return null;

  return getAccessToken(cookies);
}

/**
 * Proxy BFF con renovación transparente: un solo intento de refresh si el access expiró.
 */
export async function proxyWithSessionRefresh(options: BffProxyOptions): Promise<Response> {
  const token = await resolveAccessToken(options.cookies);
  if (!token) return unauthenticatedResponse();

  const denied = options.assertAccess?.();
  if (denied) return denied;

  let refreshRetried = false;

  const execute = async (accessToken: string): Promise<Response> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    const acceptLanguage = options.request.headers.get('accept-language');
    if (acceptLanguage) headers['Accept-Language'] = acceptLanguage;

    const contentType = options.request.headers.get('content-type');
    if (contentType && options.body !== undefined) {
      headers['Content-Type'] = contentType;
    }

    const init: RequestInit = { method: options.method, headers };
    if (options.body !== undefined) {
      init.body = options.body;
    }

    return fetch(options.targetUrl, init);
  };

  let backendRes = await execute(token);

  if (backendRes.status === 401 && !refreshRetried && hasRefreshToken(options.cookies)) {
    refreshRetried = true;
    const refreshed = await refreshSessionCookies(options.cookies);
    if (refreshed.ok) {
      const retryToken = getAccessToken(options.cookies);
      if (retryToken) {
        backendRes = await execute(retryToken);
      }
    } else {
      return unauthenticatedResponse();
    }
  }

  return formatBackendResponse(backendRes);
}

async function formatBackendResponse(backendRes: Response): Promise<Response> {
  const contentType = backendRes.headers.get('content-type') ?? 'application/json';

  if (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('text/csv')
  ) {
    const buffer = await backendRes.arrayBuffer();
    const headers: Record<string, string> = { 'Content-Type': contentType };
    const disposition = backendRes.headers.get('content-disposition');
    if (disposition) headers['Content-Disposition'] = disposition;
    return new Response(buffer, { status: backendRes.status, headers });
  }

  const text = await backendRes.text();
  return new Response(text, {
    status: backendRes.status,
    headers: { 'Content-Type': contentType },
  });
}
