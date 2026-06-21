import type { Request, Response, NextFunction } from 'express';
import type { TenantReportType } from '@velocesport/shared';
import { reportExportService } from '../services/report-export.service.js';

export class ReportExportController {
  async export(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId as number;
      const reportType = req.params.reportType as TenantReportType;
      const query = req.query as {
        format: 'csv' | 'pdf';
        locale?: string;
        categoryId?: number;
        status?: string;
        role?: string;
        matchType?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      const acceptLanguage = req.headers['accept-language'];
      const locale =
        query.locale ??
        (typeof acceptLanguage === 'string' && acceptLanguage.toLowerCase().startsWith('en')
          ? 'en'
          : 'es');

      const result = await reportExportService.export(tenantId, reportType, query.format, {
        locale,
        categoryId: query.categoryId,
        status: query.status,
        role: query.role,
        matchType: query.matchType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const reportExportController = new ReportExportController();
