import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { clearAuthCookies } from '../../../lib/auth-cookies.js';
import { REFRESH_TOKEN_COOKIE } from '../../../lib/auth-config.js';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${INTERNAL_API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Idempotente: siempre limpiamos cookies locales aunque falle el backend.
    }
  }

  clearAuthCookies(cookies);
  return redirect('/login');
};
