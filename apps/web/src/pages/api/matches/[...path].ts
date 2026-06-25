import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { getSession } from '../../../lib/session.js';
import { sessionHasAnyRole } from '../../../lib/auth-config.js';
import { proxyWithSessionRefresh } from '../../../lib/bff-proxy.js';
import type { LoginRole } from '@velocesport/shared';

const ALLOWED_ROLES: LoginRole[] = ['academy_admin', 'coach'];

export const GET: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'GET');
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'POST');
};

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'PATCH');
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'PUT');
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
  const target = `${INTERNAL_API_URL}/api/tenant/matches/${path}${url.search}`;

  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;

  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: target,
    method,
    body,
    assertAccess: () => {
      const session = getSession(cookies);
      if (!session || !sessionHasAnyRole(session, ALLOWED_ROLES)) {
        return json({ success: false, message: 'Acceso denegado' }, 403);
      }
      return null;
    },
  });
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
