import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  playerPhotoController,
  playerPhotoUploadMiddleware,
} from '../controllers/player-photo.controller.js';
import { MulterError } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/index.js';

const router = Router();

function handleMulterError(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new ValidationError('La foto no puede superar 5 MB'));
      return;
    }
    next(new ValidationError('No pudimos leer el archivo subido'));
    return;
  }
  next(err);
}

router.post(
  '/:playerId/photo',
  authenticate,
  (req, res, next) => {
    playerPhotoUploadMiddleware(req, res, (err) => {
      if (err) {
        handleMulterError(err, req, res, next);
        return;
      }
      next();
    });
  },
  (req, res, next) => playerPhotoController.upload(req, res, next),
);

router.delete(
  '/:playerId/photo',
  authenticate,
  (req, res, next) => playerPhotoController.remove(req, res, next),
);

router.get(
  '/:playerId/photo-url',
  authenticate,
  (req, res, next) => playerPhotoController.getUrl(req, res, next),
);

export default router;
