import { defineMiddleware } from 'astro:middleware';
import { resolveLocale } from '@velocesport/i18n';
import {
  getDashboardPathForRole,
  getRequiredRoleForPath,
  isProtectedPath,
  PUBLIC_PATHS,
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
    return context.redirect(session ? getDashboardPathForRole(session.role) : '/login');
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (session && pathname === '/login') {
      return context.redirect(getDashboardPathForRole(session.role));
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
    if (requiredRole && session.role !== requiredRole) {
      return context.redirect(getDashboardPathForRole(session.role));
    }
  }

  return next();
});
