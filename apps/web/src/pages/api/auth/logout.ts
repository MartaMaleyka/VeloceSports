import type { APIRoute } from 'astro';
import { PUBLIC_API_URL } from 'astro:env/client';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../../lib/auth-config.js';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${PUBLIC_API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Idempotente: siempre limpiamos cookies locales aunque falle el backend.
    }
  }

  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
  return redirect('/login');
};
