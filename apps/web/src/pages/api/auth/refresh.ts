import type { APIRoute } from 'astro';
import { INTERNAL_API_URL } from 'astro:env/server';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();

  const backendRes = await fetch(`${INTERNAL_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const responseBody = await backendRes.text();
  return new Response(responseBody, {
    status: backendRes.status,
    headers: { 'Content-Type': backendRes.headers.get('content-type') ?? 'application/json' },
  });
};
