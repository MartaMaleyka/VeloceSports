import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import type { LoginResponseDto } from '@velocesport/shared';
import { setAuthCookies } from '../../../lib/auth-cookies.js';
import { backendFetch } from '../../../lib/client-ip.js';

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Login del BFF: los tokens quedan solo en cookies httpOnly puestas aquí.
 * Nunca se devuelven al navegador (un XSS no podría leer el refresh token).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const body = await request.text();
  const contentType = request.headers.get('content-type');

  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;

  let backendRes: Response;
  try {
    // backendFetch reenvía la IP real: el límite de login es por IP + email.
    backendRes = await backendFetch(`${INTERNAL_API_URL}/auth/login`, {
      method: 'POST',
      headers,
      body: body || undefined,
    });
  } catch {
    return json({ success: false, message: 'Servicio no disponible' }, 502);
  }

  const raw = await backendRes.text();
  if (!backendRes.ok) {
    return new Response(raw, {
      status: backendRes.status,
      headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
    });
  }

  let parsed: { success?: boolean; data?: LoginResponseDto };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return json({ success: false, message: 'Respuesta inválida del servidor' }, 502);
  }

  const data = parsed.data;
  if (!parsed.success || !data?.accessToken || !data.refreshToken) {
    return json({ success: false, message: 'Respuesta inválida del servidor' }, 502);
  }

  setAuthCookies(cookies, data.accessToken, data.refreshToken);

  return json(
    {
      success: true,
      data: { user: data.user, mustChangePassword: data.mustChangePassword },
    },
    200,
  );
};
