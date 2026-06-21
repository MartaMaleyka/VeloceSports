import type { APIRoute } from 'astro';
import { PUBLIC_API_URL } from 'astro:env/client';
import { getAccessToken, getSession } from '../../../../../lib/session.js';
import { sessionHasRole } from '../../../../../lib/auth-config.js';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const session = getSession(cookies);
  if (!session || !sessionHasRole(session, 'academy_admin')) {
    return new Response(JSON.stringify({ success: false, message: 'Acceso denegado' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = getAccessToken(cookies);
  if (!token) {
    return new Response(JSON.stringify({ success: false, message: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reportType = params.reportType;
  if (!reportType) {
    return new Response(JSON.stringify({ success: false, message: 'Reporte no especificado' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const target = `${PUBLIC_API_URL}/api/tenant/reports/${reportType}/export${url.search}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) headers['Accept-Language'] = acceptLanguage;

  const backendRes = await fetch(target, { method: 'GET', headers });
  const contentType = backendRes.headers.get('content-type') ?? 'application/octet-stream';
  const disposition = backendRes.headers.get('content-disposition');
  const buffer = await backendRes.arrayBuffer();

  const responseHeaders: Record<string, string> = { 'Content-Type': contentType };
  if (disposition) responseHeaders['Content-Disposition'] = disposition;

  return new Response(buffer, { status: backendRes.status, headers: responseHeaders });
};
