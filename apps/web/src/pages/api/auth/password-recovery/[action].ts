import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { backendFetch } from '../../../../lib/client-ip.js';

const ACTIONS = new Set(['request', 'confirm']);

/** Proxy público (sin sesión) de la recuperación de contraseña. */
export const POST: APIRoute = async ({ params, request }) => {
  const action = params.action ?? '';
  if (!ACTIONS.has(action)) {
    return new Response(JSON.stringify({ success: false, message: 'No encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) headers['Accept-Language'] = acceptLanguage;

  const backendRes = await backendFetch(`${INTERNAL_API_URL}/auth/password-recovery/${action}`, {
    method: 'POST',
    headers,
    body: await request.text(),
  });

  return new Response(await backendRes.text(), {
    status: backendRes.status,
    headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
  });
};
