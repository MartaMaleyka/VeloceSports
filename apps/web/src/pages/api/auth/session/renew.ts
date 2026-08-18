import type { APIRoute } from 'astro';
import { refreshSessionCookies } from '../../../../lib/token-refresh.js';

/** Renueva access/refresh desde la cookie httpOnly (post cambio de contraseña forzado). */
export const POST: APIRoute = async ({ cookies }) => {
  const result = await refreshSessionCookies(cookies);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ success: false, message: 'No pudimos renovar la sesión', code: result.code }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ success: true, data: { renewed: true } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
