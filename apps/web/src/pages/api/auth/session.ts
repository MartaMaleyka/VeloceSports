import type { APIRoute } from 'astro';
import { setAuthCookies } from '../../../lib/auth-cookies.js';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = (await request.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (!body.accessToken || !body.refreshToken) {
      return new Response(
        JSON.stringify({ success: false, message: 'Tokens requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    setAuthCookies(cookies, body.accessToken, body.refreshToken);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ success: false, message: 'Solicitud inválida' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
