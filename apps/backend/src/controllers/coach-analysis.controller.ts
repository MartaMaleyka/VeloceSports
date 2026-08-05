import type { Request, Response, NextFunction } from 'express';
import { coachAnalysisService } from '../services/coach-analysis.service.js';
import type { CoachAnalysisQuery } from '../validators/coach-analysis.validator.js';

export class CoachAnalysisController {
  async listPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const query = req.query as unknown as CoachAnalysisQuery;
      const data = await coachAnalysisService.listPlayers(
        { user: req.user!, tenantId },
        query,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getPlayerDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const playerId = Number(req.params.playerId);
      const query = req.query as unknown as CoachAnalysisQuery;
      const data = await coachAnalysisService.getPlayerDetail(
        { user: req.user!, tenantId },
        playerId,
        query,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const query = req.query as unknown as CoachAnalysisQuery;
      const result = await coachAnalysisService.exportCsv(
        { user: req.user!, tenantId },
        query,
      );
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const query = req.query as unknown as CoachAnalysisQuery;
      const result = await coachAnalysisService.exportPdf(
        { user: req.user!, tenantId },
        query,
      );
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const coachAnalysisController = new CoachAnalysisController();
