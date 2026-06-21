import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtPayload } from '../types/index.js';

const accessExpiresIn = env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];
const refreshExpiresIn = env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

export function signAccessToken(payload: JwtPayload): string {
  const tokenPayload: Record<string, unknown> = {
    userId: payload.userId,
    role: payload.role,
  };

  if (payload.tenantId !== undefined && payload.tenantId !== null) {
    tokenPayload.tenantId = payload.tenantId;
  }

  return jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: accessExpiresIn,
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  const tokenPayload: Record<string, unknown> = {
    userId: payload.userId,
    role: payload.role,
  };

  if (payload.tenantId !== undefined && payload.tenantId !== null) {
    tokenPayload.tenantId = payload.tenantId;
  }

  return jwt.sign(tokenPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: refreshExpiresIn,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  return {
    userId: Number(decoded.userId),
    role: decoded.role as JwtPayload['role'],
    tenantId: decoded.tenantId !== undefined ? Number(decoded.tenantId) : undefined,
  };
}

export function decodeAccessToken(token: string): JwtPayload | null {
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
