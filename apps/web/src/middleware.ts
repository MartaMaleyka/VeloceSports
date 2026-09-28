import { defineMiddleware, sequence } from 'astro:middleware';
import { resolveLocale } from '@velocesport/i18n';
import {
  getDashboardPathForSession,
  getRequiredRoleForPath,
  isProtectedPath,
  PUBLIC_PATHS,
  sessionHasRole,
} from './lib/auth-config.js';
import { ensureSession } from './lib/session.js';
import { resolveRequestClientIp, runWithClientIp } from './lib/client-ip.js';
import { applySecurityHeaders } from './lib/security-headers.js';

/**
 * La app no usa astro:assets, pero en modo servidor Astro expone igualmente el endpoint
 * de optimización de imágenes (/_image). Se cierra para no ofrecer superficie de ataque
 * sin uso (hubo un RCE en ese endpoint, GHSA de Astro < 7.2.8).
 */
const blockImageEndpointMiddleware = defineMiddleware((context, next) => {
  if (/\/_image\/?$/.test(context.url.pathname)) {
    return new Response(null, { status: 404 });
  }
  return next();
});

/** Fija la IP real del cliente para todo el request (la reenvía el BFF al backend). */
const clientIpMiddleware = defineMiddleware((context, next) => {
  let clientAddress: string | undefined;
  try {
    clientAddress = context.clientAddress;
  } catch {
    // Sin dirección de socket (prerender): se omite el reenvío de IP.
  }
  const clientIp = resolveRequestClientIp(context.request, clientAddress);
  return runWithClientIp(clientIp, () => next());
});

const securityHeadersMiddleware = defineMiddleware(async (_context, next) => {
  const response = await next();
  return applySecurityHeaders(response, { production: import.meta.env.PROD });
});

const authMiddleware = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const { session, endReason } = await ensureSession(context.cookies);
  const locale = resolveLocale(
    context.cookies,
    context.request.headers.get('accept-language'),
  );

  context.locals.locale = locale;
  context.locals.session = session;

  if (pathname === '/') {
    return context.redirect(session ? getDashboardPathForSession(session) : '/login');
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (session && pathname === '/login') {
      if (session.mustChangePassword) {
        return context.redirect('/dashboard/change-password-required');
      }
      return context.redirect(getDashboardPathForSession(session));
    }
    if (pathname === '/dashboard/change-password-required') {
      if (!session) {
        return context.redirect('/login');
      }
      return next();
    }
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return next();
  }

  if (isProtectedPath(pathname)) {
    if (!session) {
      const params = new URLSearchParams({ redirect: pathname });
      if (endReason === 'inactivity') {
        params.set('reason', 'inactivity');
      }
      return context.redirect(`/login?${params.toString()}`);
    }

    if (
      session.mustChangePassword &&
      pathname !== '/dashboard/change-password-required'
    ) {
      return context.redirect('/dashboard/change-password-required');
    }

    const requiredRole = getRequiredRoleForPath(pathname);
    if (requiredRole && !sessionHasRole(session, requiredRole)) {
      return context.redirect(getDashboardPathForSession(session));
    }
  }

  if (
    pathname === '/dashboard/change-password-required' &&
    session &&
    !session.mustChangePassword
  ) {
    return context.redirect(getDashboardPathForSession(session));
  }

  return next();
});

export const onRequest = sequence(
  blockImageEndpointMiddleware,
  clientIpMiddleware,
  securityHeadersMiddleware,
  authMiddleware,
);
