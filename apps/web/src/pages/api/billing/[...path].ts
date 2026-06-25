import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { getSession } from '../../../lib/session.js';
import { sessionHasRole } from '../../../lib/auth-config.js';
import { proxyWithSessionRefresh } from '../../../lib/bff-proxy.js';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'GET');
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
  const target = `${INTERNAL_API_URL}/api/billing/${path}${url.search}`;

  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: target,
    method,
    assertAccess: () => {
      const session = getSession(cookies);
      if (!session || !sessionHasRole(session, 'academy_admin')) {
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
