import type { APIRoute } from 'astro';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../../lib/auth-config.js';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
  return redirect('/login');
};
