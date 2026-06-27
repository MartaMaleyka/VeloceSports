import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';
import { proxyWithSessionRefresh } from '../../../lib/bff-proxy.js';

export const GET: APIRoute = async ({ request, cookies }) => {
  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: `${INTERNAL_API_URL}/auth/me`,
    method: 'GET',
  });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const body = await request.text();
  return proxyWithSessionRefresh({
    cookies,
    request,
    targetUrl: `${INTERNAL_API_URL}/auth/me`,
    method: 'PATCH',
    body,
  });
};
