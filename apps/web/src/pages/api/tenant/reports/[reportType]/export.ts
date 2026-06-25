import type { APIRoute } from 'astro';
import { PUBLIC_API_URL } from 'astro:env/client';
import { getSession } from '../../../../../lib/session.js';
import { sessionHasRole } from '../../../../../lib/auth-config.js';
import { proxyWithSessionRefresh } from '../../../../../lib/bff-proxy.js';

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const reportType = params.reportType;
  if (!reportType) {
    return new Response(JSON.stringify({ success: false, message: 'Reporte no especificado' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const target = `${PUBLIC_API_URL}/api/tenant/reports/${reportType}/export${url.search}`;

  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: target,
    method: 'GET',
    assertAccess: () => {
      const session = getSession(cookies);
      if (!session || !sessionHasRole(session, 'academy_admin')) {
        return new Response(JSON.stringify({ success: false, message: 'Acceso denegado' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    },
  });
};
