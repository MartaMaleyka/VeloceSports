import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendFetch, resolveClientIp, runWithClientIp } from './client-ip.js';

describe('resolveClientIp', () => {
  it('toma la entrada añadida por el proxy de confianza (la más a la derecha)', () => {
    expect(resolveClientIp('198.51.100.1', '127.0.0.1', 1)).toBe('198.51.100.1');
    // El navegador inyecta "1.1.1.1"; nginx añade la IP real al final.
    expect(resolveClientIp('1.1.1.1, 198.51.100.1', '127.0.0.1', 1)).toBe('198.51.100.1');
    expect(resolveClientIp('1.1.1.1, 198.51.100.1, 10.0.0.2', '127.0.0.1', 2)).toBe(
      '198.51.100.1',
    );
  });

  it('sin proxies de confianza ignora X-Forwarded-For', () => {
    expect(resolveClientIp('1.1.1.1', '203.0.113.9', 0)).toBe('203.0.113.9');
  });

  it('usa la dirección del socket si no hay cabecera o es inválida', () => {
    expect(resolveClientIp(null, '203.0.113.9', 1)).toBe('203.0.113.9');
    expect(resolveClientIp('no-es-ip', '203.0.113.9', 1)).toBe('203.0.113.9');
    expect(resolveClientIp(null, '::ffff:203.0.113.9', 1)).toBe('203.0.113.9');
    expect(resolveClientIp(null, undefined, 1)).toBeNull();
  });
});

describe('backendFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reenvía la IP del request en curso al backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await runWithClientIp('198.51.100.1', () =>
      backendFetch('http://backend/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('x-forwarded-for')).toBe('198.51.100.1');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('no añade cabecera si no hay IP conocida', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await backendFetch('http://backend/health');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).has('x-forwarded-for')).toBe(false);
  });
});
