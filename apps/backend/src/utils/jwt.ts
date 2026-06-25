import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '@velocesport/shared';
import { env } from '../config/env.js';
import type { JwtPayload } from '../types/index.js';

const accessExpiresIn = env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];
const refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

export interface RefreshJwtPayload extends JwtPayload {
  sessionId: number;
}

function buildTokenPayload(payload: JwtPayload): Record<string, unknown> {
  const tokenPayload: Record<string, unknown> = {
    userId: payload.userId,
    role: payload.role,
    roles: payload.roles,
  };

  if (payload.tenantId !== undefined && payload.tenantId !== null) {
    tokenPayload.tenantId = payload.tenantId;
  }

  return tokenPayload;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(buildTokenPayload(payload), env.JWT_ACCESS_SECRET, {
    expiresIn: accessExpiresIn,
  });
}

export function signRefreshToken(payload: RefreshJwtPayload): string {
  return jwt.sign(
    { ...buildTokenPayload(payload), sessionId: payload.sessionId, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: refreshExpiresIn },
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  const role = decoded.role as JwtPayload['role'];
  const roles = Array.isArray(decoded.roles)
    ? (decoded.roles as UserRole[])
    : [role];

  return {
    userId: Number(decoded.userId),
    role,
    roles,
    tenantId: decoded.tenantId !== undefined ? Number(decoded.tenantId) : undefined,
  };
}

export function verifyRefreshToken(token: string): RefreshJwtPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  const role = decoded.role as JwtPayload['role'];
  const roles = Array.isArray(decoded.roles)
    ? (decoded.roles as UserRole[])
    : [role];

  const sessionId = Number(decoded.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new jwt.JsonWebTokenError('Refresh token sin sessionId válido');
  }

  return {
    userId: Number(decoded.userId),
    role,
    roles,
    tenantId: decoded.tenantId !== undefined ? Number(decoded.tenantId) : undefined,
    sessionId,
  };
}

export function decodeAccessToken(token: string): JwtPayload | null {
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
