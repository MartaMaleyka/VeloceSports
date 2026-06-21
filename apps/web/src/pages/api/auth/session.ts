import type { APIRoute } from 'astro';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../../lib/auth-config.js';

const FIFTEEN_MINUTES = 60 * 15;
const SEVEN_DAYS = 60 * 60 * 24 * 7;

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

    const secure = import.meta.env.PROD;

    cookies.set(ACCESS_TOKEN_COOKIE, body.accessToken, {
      httpOnly: true,
      secure, // false en dev (http://localhost) — true solo en producción
      sameSite: 'lax',
      path: '/',
      maxAge: FIFTEEN_MINUTES,
    });

    cookies.set(REFRESH_TOKEN_COOKIE, body.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SEVEN_DAYS,
    });

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
