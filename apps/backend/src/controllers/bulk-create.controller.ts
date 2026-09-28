import type { NextFunction, Request, Response } from 'express';
import type { BulkCreateResult } from '@velocesport/shared';
import { bulkCreateService } from '../services/bulk-create.service.js';
import type { AuthUser } from '../types/index.js';

type BulkHandler = (
  actor: { user: AuthUser; tenantId: number },
  items: unknown[],
  dryRun: boolean,
) => Promise<BulkCreateResult<unknown>>;

/**
 * 200 siempre que el sobre sea válido: el resultado detalla filas creadas y errores por
 * fila. Solo un lote enteramente creado responde 201.
 */
function bulkEndpoint(handler: BulkHandler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as { items: unknown[]; dryRun?: boolean };
      const result = await handler(
        { user: req.user as AuthUser, tenantId: req.tenantId as number },
        body.items,
        body.dryRun ?? false,
      );
      const allCreated = !result.dryRun && result.summary.created === result.summary.total;
      res.status(allCreated ? 201 : 200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export const bulkCreateController = {
  players: bulkEndpoint((actor, items, dryRun) =>
    bulkCreateService.createPlayers(actor, items, dryRun),
  ),
  users: bulkEndpoint((actor, items, dryRun) => bulkCreateService.createUsers(actor, items, dryRun)),
  categories: bulkEndpoint((actor, items, dryRun) =>
    bulkCreateService.createCategories(actor, items, dryRun),
  ),
  matches: bulkEndpoint((actor, items, dryRun) =>
    bulkCreateService.createMatches(actor, items, dryRun),
  ),
};
