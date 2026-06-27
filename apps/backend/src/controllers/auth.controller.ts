import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError } from '../types/index.js';

function readClientContext(req: Request): {
  userAgent?: string | null;
  ipAddress?: string | null;
} {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : req.socket.remoteAddress ?? null;

  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: ip,
  };
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const result = await authService.login(email, password, readClientContext(req));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken: string };
      const result = await authService.refresh(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      await authService.logout(refreshToken);
      res.status(200).json({ success: true, data: { loggedOut: true } });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const profile = await authService.getMe(req.user.userId);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const profile = await authService.updateProfile(req.user.userId, req.body);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const result = await authService.changePassword(req.user.userId, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
