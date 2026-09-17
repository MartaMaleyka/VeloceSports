import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const contentType = request.headers.get('content-type');

  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = contentType;

  const backendRes = await fetch(`${INTERNAL_API_URL}/auth/signup-academy`, {
    method: 'POST',
    headers,
    body: body || undefined,
  });

  const responseBody = await backendRes.text();
  return new Response(responseBody, {
    status: backendRes.status,
    headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
  });
};
