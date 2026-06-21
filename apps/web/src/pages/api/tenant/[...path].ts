import type { APIRoute } from 'astro';
import { PUBLIC_API_URL } from 'astro:env/client';
import { getAccessToken, getSession } from '../../../lib/session.js';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'GET');
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'POST');
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'PATCH');
};

async function handleProxy(
  request: Request,
  cookies: Parameters<typeof getSession>[0],
  pathParam: string | undefined,
  method: string,
): Promise<Response> {
  const session = getSession(cookies);
  if (!session || session.role !== 'academy_admin') {
    return json({ success: false, message: 'Acceso denegado' }, 403);
  }

  const token = getAccessToken(cookies);
  if (!token) return json({ success: false, message: 'No autenticado' }, 401);

  const segments = pathParam?.split('/').filter(Boolean) ?? [];
  const path = segments.join('/');
  const url = new URL(request.url);
  const target = `${PUBLIC_API_URL}/api/tenant/${path}${url.search}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) headers['Accept-Language'] = acceptLanguage;

  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.text();
    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
  }

  const backendRes = await fetch(target, init);
  const contentType = backendRes.headers.get('content-type') ?? 'application/json';
  const text = await backendRes.text();
  return new Response(text, { status: backendRes.status, headers: { 'Content-Type': contentType } });
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
