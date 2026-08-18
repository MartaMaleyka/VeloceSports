import { defineMiddleware } from 'astro:middleware';
import { resolveLocale } from '@velocesport/i18n';
import {
  getDashboardPathForSession,
  getRequiredRoleForPath,
  isProtectedPath,
  PUBLIC_PATHS,
  sessionHasRole,
} from './lib/auth-config.js';
import { ensureSession } from './lib/session.js';

export const onRequest = defineMiddleware(async (context, next) => {
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
