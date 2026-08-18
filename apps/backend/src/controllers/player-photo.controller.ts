import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { playerPhotoService } from '../services/player-photo.service.js';
import { ValidationError } from '../types/index.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const playerPhotoUploadMiddleware = upload.single('photo');

function parsePlayerId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('playerId inválido');
  }
  return id;
}

export class PlayerPhotoController {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }
      const playerId = parsePlayerId(req.params.playerId as string);
      const file = req.file;
      const data = await playerPhotoService.upload(req.user, playerId, file);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }
      const playerId = parsePlayerId(req.params.playerId as string);
      await playerPhotoService.remove(req.user, playerId);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'No autenticado' });
        return;
      }
      const playerId = parsePlayerId(req.params.playerId as string);
      const data = await playerPhotoService.getPhotoUrl(req.user, playerId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const playerPhotoController = new PlayerPhotoController();
