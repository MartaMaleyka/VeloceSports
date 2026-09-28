import type { Request, Response, NextFunction } from 'express';
import type { SignupAcademyBody, SignupIndependentBody } from '@velocesport/shared';
import { authService } from '../services/auth.service.js';
import { independentSignupService } from '../services/independent-signup.service.js';
import { academySignupService } from '../services/academy-signup.service.js';
import { passwordRecoveryService } from '../services/password-recovery.service.js';
import { UnauthorizedError } from '../types/index.js';

function readClientContext(req: Request): {
  userAgent?: string | null;
  ipAddress?: string | null;
} {
  // req.ip ya resuelve X-Forwarded-For solo desde proxies de confianza (TRUST_PROXY).
  return {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
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

  async signupIndependent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SignupIndependentBody;
      const result = await independentSignupService.signup(body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async signupAcademy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SignupAcademyBody;
      const result = await academySignupService.signup(body);
      res.status(201).json({ success: true, data: result });
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

  /** Siempre 202 y sin esperar al envío: ni el contenido ni el tiempo revelan si la cuenta existe. */
  async requestPasswordRecovery(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email: string };
    const locale = req.headers['accept-language']?.toLowerCase().startsWith('en') ? 'en' : 'es';
    void passwordRecoveryService
      .request(email, { ipAddress: readClientContext(req).ipAddress, locale })
      .catch((error) => console.error('[password-recovery] Error al procesar la solicitud:', error));
    res.status(202).json({
      success: true,
      data: { message: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.' },
    });
  }

  async confirmPasswordRecovery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };
      await passwordRecoveryService.confirm(token, newPassword);
      res.status(200).json({ success: true, data: { passwordReset: true } });
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
