import type { LoginRole } from '@velocesport/shared';
import {
  getDashboardPathForSession,
  sessionHasRole,
  type SessionUser,
} from './auth-config.js';

/** Devuelve ruta de redirect si el usuario no puede acceder; cadena vacía si OK. */
export function redirectUnlessRole(
  session: SessionUser | null,
  requiredRole: LoginRole,
): string {
  if (!session) return '/login';
  if (!sessionHasRole(session, requiredRole)) {
    return getDashboardPathForSession(session);
  }
  return '';
}
