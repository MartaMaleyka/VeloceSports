import jwt from 'jsonwebtoken';
import { logger } from '../services/logger.service.js';

interface BlacklistedToken {
  jti: string;
  expiresAt: Date;
  revokedAt: Date;
  reason: string;
}

export class TokenBlacklist {
  private blacklist = new Map<string, BlacklistedToken>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  /**
   * Add a token to the blacklist.
   */
  add(token: string, reason: string = 'logout'): void {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (!decoded || !decoded.exp || !decoded.jti) return;

      const jti = decoded.jti as string;
      const expiresAt = new Date(decoded.exp * 1000);

      this.blacklist.set(jti, {
        jti,
        expiresAt,
        revokedAt: new Date(),
        reason,
      });

      logger.debug(`Token blacklisted: ${jti} (${reason})`);
    } catch (error) {
      logger.warn(`Failed to blacklist token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a token is blacklisted.
   */
  isBlacklisted(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (!decoded || !decoded.jti) return false;

      const jti = decoded.jti as string;
      return this.blacklist.has(jti);
    } catch {
      return false;
    }
  }

  /**
   * Revoke all access tokens for a user (all sessions).
   */
  revokeUserTokens(userId: number): void {
    const before = this.blacklist.size;
    for (const jti of this.blacklist.keys()) {
      try {
        const decoded = jwt.decode(Buffer.from(jti, 'base64').toString('utf-8')) as jwt.JwtPayload | null;
        if (decoded?.userId === userId) {
          this.blacklist.delete(jti);
        }
      } catch {
        // Skip tokens that can't be decoded
      }
    }
    const after = this.blacklist.size;
    logger.info(`Revoked tokens for user ${userId}: ${before - after} entries cleared`);
  }

  /**
   * Clear expired tokens from the blacklist (runs periodically).
   */
  private cleanupExpiredTokens(): void {
    const before = this.blacklist.size;
    const now = Date.now();

    for (const [jti, entry] of this.blacklist.entries()) {
      if (entry.expiresAt.getTime() < now) {
        this.blacklist.delete(jti);
      }
    }

    const after = this.blacklist.size;
    if (before !== after) {
      logger.debug(`Cleaned up expired tokens: ${before - after} entries removed`);
    }
  }

  /**
   * Start periodic cleanup of expired tokens (every 5 minutes).
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 5 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the cleanup interval.
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current blacklist size (for monitoring).
   */
  size(): number {
    return this.blacklist.size;
  }
}

export const tokenBlacklist = new TokenBlacklist();
