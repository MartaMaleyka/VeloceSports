import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import { TRUSTED_PROXY_HOPS } from 'astro:env/server';

/**
 * IP real del navegador para reenviarla al backend (rate limiting y auditoría).
 *
 * El backend solo ve la IP del contenedor web; sin este reenvío, todos los usuarios
 * comparten el mismo contador de rate limit. Se guarda por request en un
 * AsyncLocalStorage (fijado en el middleware) para no tener que pasarla a mano a
 * cada llamada del BFF.
 */
const clientIpStorage = new AsyncLocalStorage<string | null>();

function normalizeIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw.trim();
  // IPv4 mapeada en IPv6 (::ffff:1.2.3.4) → 1.2.3.4
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) {
    value = value.slice(7);
  }
  return isIP(value) ? value : null;
}

/**
 * Resuelve la IP del cliente sin confiar en valores que el navegador pueda falsear.
 *
 * Con `trustedHops` proxies delante (p. ej. nginx), cada proxy AÑADE la IP que ve al
 * final de X-Forwarded-For; por eso se toma la entrada `trustedHops` desde la derecha.
 * Las entradas de la izquierda las controla el cliente y se ignoran.
 */
export function resolveClientIp(
  forwardedFor: string | null,
  socketAddress: string | undefined,
  trustedHops: number,
): string | null {
  if (trustedHops > 0 && forwardedFor) {
    const entries = forwardedFor
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const candidate = entries[entries.length - trustedHops];
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  return normalizeIp(socketAddress);
}

export function resolveRequestClientIp(request: Request, clientAddress: string | undefined): string | null {
  return resolveClientIp(request.headers.get('x-forwarded-for'), clientAddress, TRUSTED_PROXY_HOPS);
}

export function runWithClientIp<T>(clientIp: string | null, fn: () => T): T {
  return clientIpStorage.run(clientIp, fn);
}

export function getCurrentClientIp(): string | null {
  return clientIpStorage.getStore() ?? null;
}

/** Cabeceras a añadir en toda llamada del BFF al backend. */
export function clientIpHeaders(): Record<string, string> {
  const ip = getCurrentClientIp();
  return ip ? { 'X-Forwarded-For': ip } : {};
}

/** fetch hacia el backend interno que reenvía la IP real del cliente. */
export function backendFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(clientIpHeaders())) {
    headers.set(name, value);
  }
  return fetch(url, { ...init, headers });
}
