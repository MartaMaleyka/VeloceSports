/**
 * Cabeceras de seguridad para las páginas y endpoints de Astro.
 * (Helmet solo cubre el backend Express; el navegador habla con este servidor.)
 */

/**
 * CSP de producción. 'unsafe-inline' en scripts es necesario para los islands de
 * Astro y el script inline de preferencias (tema/idioma); aun así bloquea scripts
 * de otros orígenes, iframes, <object> y envío de formularios a terceros.
 * Imágenes: las fotos de jugadores son URLs firmadas de MinIO (host configurable).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Micrófono: captura por voz en partidos. El resto de APIs sensibles, deshabilitadas.
  'Permissions-Policy': 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function securityHeaders(options: { production: boolean }): Record<string, string> {
  return options.production
    ? { ...BASE_HEADERS, 'Content-Security-Policy': CONTENT_SECURITY_POLICY }
    : { ...BASE_HEADERS };
}

/** Aplica las cabeceras; si la Response es inmutable (p. ej. Response.redirect) la clona. */
export function applySecurityHeaders(
  response: Response,
  options: { production: boolean },
): Response {
  const headers = securityHeaders(options);
  try {
    for (const [name, value] of Object.entries(headers)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  } catch {
    const copy = new Response(response.body, response);
    for (const [name, value] of Object.entries(headers)) {
      if (!copy.headers.has(name)) copy.headers.set(name, value);
    }
    return copy;
  }
}
