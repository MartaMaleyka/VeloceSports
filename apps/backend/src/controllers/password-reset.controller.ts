import type { Request, Response, NextFunction } from 'express';
import { passwordResetService } from '../services/password-reset.service.js';
import type { ResetPasswordBody } from '../validators/password-reset.validator.js';

export class PasswordResetController {
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.params.userId);
      const body = req.body as ResetPasswordBody;
      const data = await passwordResetService.resetPassword(req.user!, userId, body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const passwordResetController = new PasswordResetController();
