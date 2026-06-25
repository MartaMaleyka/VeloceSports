import PDFDocument from 'pdfkit';
import type { InvoiceDto } from '@velocesport/shared';
import { InvoiceType, formatMonthlyInvoiceBreakdown } from '@velocesport/shared';

export interface InvoicePdfLabels {
  title: string;
  invoiceNumber: string;
  invoiceType: string;
  invoiceTypeMonthly: string;
  invoiceTypeAnnual: string;
  academy: string;
  plan: string;
  period: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  breakdown: string;
  annualFeeLine: string;
  status: string;
  notes: string;
  footer: string;
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function generateInvoicePdf(invoice: InvoiceDto, labels: InvoicePdfLabels): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const brandBlue = '#1E5FA1';
    const typeLabel =
      invoice.invoiceType === InvoiceType.ANNUAL
        ? labels.invoiceTypeAnnual
        : labels.invoiceTypeMonthly;

    doc.rect(0, 0, doc.page.width, 80).fill(brandBlue);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('VeloceSport', 50, 30);
    doc.fontSize(11).font('Helvetica').text(`${labels.title} — ${typeLabel}`, 50, 55);

    doc.fillColor('#111827').fontSize(10).font('Helvetica');
    let y = 110;

    doc.font('Helvetica-Bold').text(labels.invoiceNumber, 50, y);
    doc.font('Helvetica').text(`#${invoice.id}`, 180, y);
    y += 22;

    const rows: [string, string][] = [
      [labels.invoiceType, typeLabel],
      [labels.academy, invoice.academyName ?? '—'],
      [labels.plan, invoice.planName ?? '—'],
      [labels.period, `${invoice.periodStart} — ${invoice.periodEnd}`],
      [labels.issueDate, invoice.issueDate],
      [labels.dueDate, invoice.dueDate],
      [labels.status, invoice.status],
      [labels.amount, formatMoney(invoice.amount, invoice.currency)],
    ];

    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').text(label, 50, y, { width: 120 });
      doc.font('Helvetica').text(value, 180, y, { width: 350 });
      y += 22;
    }

    if (
      invoice.invoiceType === InvoiceType.MONTHLY &&
      invoice.billedPlayerCount != null &&
      invoice.billedPricePerPlayer != null
    ) {
      y += 8;
      doc.font('Helvetica-Bold').text(labels.breakdown, 50, y);
      y += 16;
      const breakdown = formatMonthlyInvoiceBreakdown(
        invoice.billedPlayerCount,
        invoice.billedPricePerPlayer,
        invoice.amount,
        invoice.currency,
      );
      doc.font('Helvetica').text(breakdown, 50, y, { width: 500 });
      y += 28;
    }

    if (invoice.invoiceType === InvoiceType.ANNUAL && invoice.billedAnnualFee != null) {
      y += 8;
      doc.font('Helvetica-Bold').text(labels.breakdown, 50, y);
      y += 16;
      doc.font('Helvetica').text(
        `${labels.annualFeeLine}: ${formatMoney(invoice.billedAnnualFee, invoice.currency)}`,
        50,
        y,
        { width: 500 },
      );
      y += 28;
    }

    if (invoice.notes) {
      y += 8;
      doc.font('Helvetica-Bold').text(labels.notes, 50, y);
      y += 16;
      doc.font('Helvetica').text(invoice.notes, 50, y, { width: 500 });
      y += 40;
    }

    doc.moveTo(50, doc.page.height - 80).lineTo(doc.page.width - 50, doc.page.height - 80).stroke('#E5E7EB');
    doc.fontSize(9).fillColor('#6B7280').text(labels.footer, 50, doc.page.height - 65, {
      align: 'center',
      width: doc.page.width - 100,
    });

    doc.end();
  });
}
