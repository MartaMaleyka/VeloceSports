import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { getSession } from '../../../lib/session.js';
import { proxyWithSessionRefresh } from '../../../lib/bff-proxy.js';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'GET');
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'POST');
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'DELETE');
};

async function handleProxy(
  request: Request,
  cookies: Parameters<typeof getSession>[0],
  pathParam: string | undefined,
  method: string,
): Promise<Response> {
  const segments = pathParam?.split('/').filter(Boolean) ?? [];
  const path = segments.join('/');
  const url = new URL(request.url);
  const target = `${INTERNAL_API_URL}/api/players/${path}${url.search}`;

  const hasBody = method !== 'GET' && method !== 'HEAD' && method !== 'DELETE';
  const contentType = request.headers.get('content-type') ?? '';
  const isMultipart = contentType.includes('multipart/form-data');
  const body = hasBody
    ? isMultipart
      ? await request.arrayBuffer()
      : await request.text()
    : undefined;

  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: target,
    method,
    body,
    assertAccess: () => {
      const session = getSession(cookies);
      if (!session) {
        return new Response(JSON.stringify({ success: false, message: 'No autenticado' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    },
  });
}
