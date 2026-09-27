import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, CONTENT_SECURITY_POLICY } from './security-headers.js';

describe('applySecurityHeaders', () => {
  it('añade CSP solo en producción', () => {
    const prod = applySecurityHeaders(new Response('ok'), { production: true });
    expect(prod.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(prod.headers.get('x-frame-options')).toBe('DENY');

    const dev = applySecurityHeaders(new Response('ok'), { production: false });
    expect(dev.headers.has('content-security-policy')).toBe(false);
    expect(dev.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('funciona con respuestas de headers inmutables (redirect)', () => {
    const res = applySecurityHeaders(Response.redirect('http://localhost/login', 302), {
      production: true,
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost/login');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('no sobrescribe cabeceras que ya fijó el endpoint', () => {
    const res = applySecurityHeaders(
      new Response('ok', { headers: { 'X-Frame-Options': 'SAMEORIGIN' } }),
      { production: true },
    );
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('la CSP bloquea iframes y scripts de terceros', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });
});
