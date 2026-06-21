import { defineMiddleware } from 'astro:middleware';
import { resolveLocale } from '@velocesport/i18n';
import {
  getDashboardPathForSession,
  getRequiredRoleForPath,
  isProtectedPath,
  PUBLIC_PATHS,
  sessionHasRole,
} from './lib/auth-config.js';
import { getSession } from './lib/session.js';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const session = getSession(context.cookies);
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
      return context.redirect(getDashboardPathForSession(session));
    }
    return next();
  }

  if (pathname.startsWith('/api/')) {
    return next();
  }

  if (isProtectedPath(pathname)) {
    if (!session) {
      const redirectTo = encodeURIComponent(pathname);
      return context.redirect(`/login?redirect=${redirectTo}`);
    }

    const requiredRole = getRequiredRoleForPath(pathname);
    if (requiredRole && !sessionHasRole(session, requiredRole)) {
      return context.redirect(getDashboardPathForSession(session));
    }
  }

  return next();
});
