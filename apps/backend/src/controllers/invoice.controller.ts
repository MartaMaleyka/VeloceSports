import type { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import type { AuthUser } from '../types/index.js';
import type { InvoicePdfLabels } from '../services/invoice-pdf.service.js';

function getActor(req: Request): AuthUser {
  return req.user as AuthUser;
}

function pdfLabelsFromRequest(req: Request): InvoicePdfLabels {
  const locale = (req.headers['accept-language'] ?? 'es').toString().startsWith('en')
    ? 'en'
    : 'es';

  if (locale === 'en') {
    return {
      title: 'Invoice',
      invoiceNumber: 'Invoice #',
      academy: 'Academy',
      plan: 'Plan',
      period: 'Billing period',
      issueDate: 'Issue date',
      dueDate: 'Due date',
      amount: 'Amount',
      status: 'Status',
      notes: 'Notes',
      footer: 'VeloceSport — Youth football academies platform',
    };
  }

  return {
    title: 'Factura',
    invoiceNumber: 'Factura N.º',
    academy: 'Academia',
    plan: 'Plan',
    period: 'Periodo de facturación',
    issueDate: 'Fecha de emisión',
    dueDate: 'Fecha de vencimiento',
    amount: 'Monto',
    status: 'Estado',
    notes: 'Notas',
    footer: 'VeloceSport — Plataforma para academias de fútbol formativo',
  };
}

export class InvoiceController {
  async listPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await invoiceService.listPlatform(req.query as never);
      res.status(200).json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  }

  async getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kpis = await invoiceService.getMonthlyKpis(req.query.month as string);
      res.status(200).json({ success: true, data: kpis });
    } catch (error) {
      next(error);
    }
  }

  async getPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getByIdPlatform(Number(req.params.invoiceId));
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.createManual(getActor(req).userId, req.body);
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async updatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.updatePayment(
        getActor(req).userId,
        Number(req.params.invoiceId),
        req.body,
      );
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.cancel(getActor(req).userId, Number(req.params.invoiceId));
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async processOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await invoiceService.processOverdueInvoices(new Date(), getActor(req).userId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async downloadPdfPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getByIdPlatform(Number(req.params.invoiceId));
      const labels = pdfLabelsFromRequest(req);
      const statusLabel = invoice.status;
      const buffer = await invoiceService.generatePdfBuffer(invoice, {
        ...labels,
        status: statusLabel,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async listTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoices = await invoiceService.listForTenant(req.tenantId!, req.query as never);
      res.status(200).json({ success: true, data: invoices });
    } catch (error) {
      next(error);
    }
  }

  async getTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getByIdForTenant(
        Number(req.params.invoiceId),
        req.tenantId!,
      );
      res.status(200).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await invoiceService.getBillingSummary(req.tenantId!);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async downloadPdfTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const invoice = await invoiceService.getByIdForTenant(
        Number(req.params.invoiceId),
        req.tenantId!,
      );
      const labels = pdfLabelsFromRequest(req);
      const buffer = await invoiceService.generatePdfBuffer(invoice, {
        ...labels,
        status: invoice.status,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}.pdf"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
