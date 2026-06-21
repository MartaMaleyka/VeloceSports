import type { APIRoute } from 'astro';
import { PUBLIC_API_URL } from 'astro:env/client';
import { getAccessToken, getSession } from '../../../lib/session.js';
import { sessionHasRole } from '../../../lib/auth-config.js';

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  return handleProxy(request, cookies, params.path, 'DELETE');
};

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
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return json({ success: false, message: 'Acceso denegado' }, 403);
  }

  const token = getAccessToken(cookies);
  if (!token) {
    return json({ success: false, message: 'No autenticado' }, 401);
  }

  const segments = pathParam?.split('/').filter(Boolean) ?? [];
  const path = segments.join('/');
  const url = new URL(request.url);
  const target = `${PUBLIC_API_URL}/api/platform/${path}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await request.text() : undefined;

  let backendRes: Response;
  try {
    backendRes = await fetch(target, { method, headers, body });
  } catch {
    return json({ success: false, message: 'No pudimos conectar con el servidor' }, 502);
  }

  const responseContentType = backendRes.headers.get('content-type') ?? 'application/json';

  if (responseContentType.includes('application/pdf')) {
    const buffer = await backendRes.arrayBuffer();
    return new Response(buffer, {
      status: backendRes.status,
      headers: {
        'Content-Type': responseContentType,
        'Content-Disposition': backendRes.headers.get('content-disposition') ?? 'attachment',
      },
    });
  }

  const text = await backendRes.text();
  return new Response(text, {
    status: backendRes.status,
    headers: { 'Content-Type': responseContentType },
  });
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
