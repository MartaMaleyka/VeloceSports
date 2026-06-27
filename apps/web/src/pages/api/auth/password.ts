import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { REFRESH_TOKEN_COOKIE } from '../../../lib/auth-config.js';
import { proxyWithSessionRefresh } from '../../../lib/bff-proxy.js';

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const raw = await request.text();
  let payload: Record<string, unknown> = {};

  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ success: false, message: 'Solicitud inválida' }, 400);
  }

  if (payload.revokeOtherSessions) {
    const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      payload.refreshToken = refreshToken;
    }
  }

  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: `${INTERNAL_API_URL}/auth/password`,
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
