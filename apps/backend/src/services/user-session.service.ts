import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  AcademyStatus,
  parseJwtDurationToSeconds,
  UserRole,
  UserStatus,
} from '@velocesport/shared';
import { env, getSessionInactivityTimeoutMs } from '../config/env.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { userSessionRepository } from '../repositories/user-session.repository.js';
import { ForbiddenError, UnauthorizedError } from '../types/index.js';
import type { JwtPayload } from '../types/index.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashRefreshToken, verifyRefreshTokenHash } from '../utils/refresh-token-hash.js';
import { getUserRoles } from './user-roles.service.js';
import { assertValidLoginRoleSet } from '../utils/role-check.js';

export interface SessionClientContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface SessionTokensResult {
  accessToken: string;
  refreshToken: string;
}

export const SESSION_INACTIVITY_EXPIRED_CODE = 'SESSION_INACTIVITY_EXPIRED';

function refreshExpiresAt(): Date {
  const seconds = parseJwtDurationToSeconds(env.JWT_REFRESH_EXPIRES_IN);
  return new Date(Date.now() + seconds * 1000);
}

function toSessionTimestamp(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return ms;
}

export class UserSessionService {
  /** Single-flight por sessionId: requests concurrentes con el mismo refresh comparten resultado. */
  private refreshInflight = new Map<number, Promise<SessionTokensResult>>();

  async createSessionWithTokens(
    tokenPayload: JwtPayload,
    client?: SessionClientContext,
  ): Promise<SessionTokensResult> {
    const expiresAt = refreshExpiresAt();
    const placeholderHash = await hashRefreshToken(randomUUID());

    const sessionId = await userSessionRepository.create({
      userId: tokenPayload.userId,
      tenantId: tokenPayload.tenantId ?? null,
      refreshTokenHash: placeholderHash,
      expiresAt,
      userAgent: client?.userAgent,
      ipAddress: client?.ipAddress,
    });

    const refreshToken = signRefreshToken({ ...tokenPayload, sessionId });
    const refreshTokenHash = await hashRefreshToken(refreshToken);
    await userSessionRepository.updateRefreshCredentials(sessionId, refreshTokenHash, expiresAt);

    const accessToken = signAccessToken(tokenPayload);
    return { accessToken, refreshToken };
  }

  async assertUserAndAcademyActive(userId: number): Promise<JwtPayload> {
    const user = await userRepository.findByIdGlobal(userId);
    if (!user) {
      throw new UnauthorizedError('Sesión inválida');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Usuario inactivo. Contacta al administrador.');
    }

    const roles = await getUserRoles(user.id);
    assertValidLoginRoleSet(roles, user.tenant_id);

    if (!roles.includes(UserRole.SUPER_ADMIN)) {
      const academy = await academyRepository.findByIdWithStatus(user.tenant_id!);
      if (!academy) {
        throw new ForbiddenError('Academia no encontrada');
      }

      if (academy.status !== AcademyStatus.ACTIVE) {
        throw new ForbiddenError(
          academy.status === AcademyStatus.SUSPENDED
            ? 'La academia está suspendida. Contacta al soporte.'
            : 'La academia no está activa.',
        );
      }
    }

    const tenantId = roles.includes(UserRole.SUPER_ADMIN)
      ? undefined
      : user.tenant_id ?? undefined;

    return {
      userId: user.id,
      role: user.role,
      roles,
      tenantId,
    };
  }

  async refresh(refreshToken: string): Promise<SessionTokensResult> {
    let sessionId: number;
    try {
      const decoded = verifyRefreshToken(refreshToken);
      sessionId = decoded.sessionId;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expirado');
      }
      throw new UnauthorizedError('Refresh token inválido');
    }

    const inflight = this.refreshInflight.get(sessionId);
    if (inflight) return inflight;

    const promise = this.performRefresh(refreshToken, sessionId).finally(() => {
      this.refreshInflight.delete(sessionId);
    });

    this.refreshInflight.set(sessionId, promise);
    return promise;
  }

  private async performRefresh(
    refreshToken: string,
    sessionId: number,
  ): Promise<SessionTokensResult> {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expirado');
      }
      throw new UnauthorizedError('Refresh token inválido');
    }

    if (decoded.sessionId !== sessionId) {
      throw new UnauthorizedError('Refresh token inválido');
    }

    const session = await userSessionRepository.findById(sessionId);
    if (!session) {
      throw new UnauthorizedError('Sesión no encontrada');
    }

    if (session.revoked_at) {
      throw new UnauthorizedError('Sesión revocada');
    }

    if (toSessionTimestamp(session.expires_at) <= Date.now()) {
      await userSessionRepository.revoke(session.id);
      throw new UnauthorizedError('Sesión expirada');
    }

    if (session.user_id !== decoded.userId) {
      await userSessionRepository.revoke(session.id);
      throw new UnauthorizedError('Sesión inválida');
    }

    const hashValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
    if (!hashValid) {
      await userSessionRepository.revoke(session.id);
      throw new UnauthorizedError('Refresh token inválido');
    }

    const inactivityLimitMs = getSessionInactivityTimeoutMs();
    const idleMs = Date.now() - toSessionTimestamp(session.last_activity_at);
    if (idleMs > inactivityLimitMs) {
      await userSessionRepository.revoke(session.id);
      throw new UnauthorizedError(
        'Tu sesión expiró por inactividad. Vuelve a iniciar sesión.',
        SESSION_INACTIVITY_EXPIRED_CODE,
      );
    }

    let tokenPayload: JwtPayload;
    try {
      tokenPayload = await this.assertUserAndAcademyActive(session.user_id);
    } catch (error) {
      await userSessionRepository.revoke(session.id);
      throw error;
    }

    await userSessionRepository.revoke(session.id);

    return this.createSessionWithTokens(tokenPayload, {
      userAgent: session.user_agent,
      ipAddress: session.ip_address,
    });
  }

  /**
   * Cierra sesión server-side. Idempotente: tokens inválidos/expirados no lanzan error.
   */
  async logout(refreshToken?: string | null): Promise<void> {
    if (!refreshToken?.trim()) return;

    let sessionId: number | null = null;

    try {
      const decoded = verifyRefreshToken(refreshToken);
      sessionId = decoded.sessionId;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        const decoded = jwt.decode(refreshToken) as jwt.JwtPayload | null;
        const raw = decoded?.sessionId;
        if (raw != null) sessionId = Number(raw);
      } else {
        return;
      }
    }

    if (!sessionId || !Number.isInteger(sessionId) || sessionId <= 0) return;

    const session = await userSessionRepository.findById(sessionId);
    if (!session || session.revoked_at) return;

    const hashValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
    if (!hashValid) return;

    await userSessionRepository.revoke(sessionId);
  }

  /** Cierra todas las sesiones activas de un usuario (todos los dispositivos). */
  async revokeAllSessionsForUser(userId: number): Promise<number> {
    return userSessionRepository.revokeAllForUser(userId);
  }

  /** Revoca todas las sesiones del usuario excepto la indicada. */
  async revokeAllSessionsForUserExcept(userId: number, exceptSessionId: number): Promise<number> {
    return userSessionRepository.revokeAllForUserExcept(userId, exceptSessionId);
  }

  /**
   * Resuelve la sesión actual a partir del refresh token (validado para el userId dado).
   */
  async resolveCurrentSessionId(
    userId: number,
    refreshToken?: string | null,
  ): Promise<number | null> {
    if (!refreshToken?.trim()) return null;

    try {
      const decoded = verifyRefreshToken(refreshToken);
      if (decoded.userId !== userId) return null;

      const session = await userSessionRepository.findById(decoded.sessionId);
      if (!session || session.revoked_at || session.user_id !== userId) return null;

      const hashValid = await verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
      if (!hashValid) return null;

      return decoded.sessionId;
    } catch {
      return null;
    }
  }

  /** Revoca sesiones de todos los usuarios de una academia (por tenant_id en sesión). */
  async revokeAllSessionsForTenant(tenantId: number): Promise<number> {
    return userSessionRepository.revokeAllForTenant(tenantId);
  }
}

export const userSessionService = new UserSessionService();
