import PDFDocument from 'pdfkit';
import type { ReportLocale } from '../i18n/report-labels.js';
import { getReportLabels, reportTitle } from '../i18n/report-labels.js';

export interface ReportPdfMeta {
  academyName: string;
  logoUrl: string | null;
  reportType: string;
  locale: ReportLocale;
  generatedAt: Date;
}

export interface ReportPdfTable {
  headers: string[];
  rows: string[][];
}

const BRAND_GREEN = '#0D7A5F';
const HEADER_BG = '#E6F5EF';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

async function fetchLogoBuffer(url: string | null): Promise<Buffer | null> {
  if (!url?.trim()) return null;
  try {
    const res = await fetch(url.trim(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

function drawPageFooter(doc: InstanceType<typeof PDFDocument>, pageNumber: number, totalPages: number, locale: ReportLocale): void {
  const L = getReportLabels(locale);
  const y = doc.page.height - 40;
  doc.save();
  doc.strokeColor(BORDER).moveTo(50, y - 8).lineTo(doc.page.width - 50, y - 8).stroke();
  doc.fontSize(8).fillColor(MUTED);
  doc.text(L.reports.footer, 50, y, { width: doc.page.width - 100, align: 'center' });
  doc.text(`${L.reports.page} ${pageNumber} ${L.reports.of} ${totalPages}`, 50, y + 12, {
    width: doc.page.width - 100,
    align: 'right',
  });
  doc.restore();
}

export async function generateReportPdf(meta: ReportPdfMeta, table: ReportPdfTable): Promise<Buffer> {
  const logoBuffer = await fetchLogoBuffer(meta.logoUrl);
  const L = getReportLabels(meta.locale);
  const title = reportTitle(meta.locale, meta.reportType);
  const generatedLabel = `${L.reports.generatedAt}: ${meta.generatedAt.toLocaleString(
    meta.locale === 'es' ? 'es-PA' : 'en-US',
    { dateStyle: 'long', timeStyle: 'short' },
  )}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);

    const headerBottom = 118;
    doc.rect(0, 0, doc.page.width, headerBottom).fill(HEADER_BG);

    let textX = 50;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 28, { fit: [56, 56] });
        textX = 118;
      } catch {
        // imagen inválida — continuar solo con texto
      }
    }

    doc.fillColor(BRAND_GREEN).fontSize(16).font('Helvetica-Bold').text(meta.academyName, textX, 32, {
      width: doc.page.width - textX - 50,
    });
    doc.fillColor(TEXT).fontSize(13).font('Helvetica-Bold').text(title, textX, 54, {
      width: doc.page.width - textX - 50,
    });
    doc.fontSize(9).font('Helvetica').fillColor(MUTED).text(generatedLabel, textX, 74, {
      width: doc.page.width - textX - 50,
    });

    let y = headerBottom + 24;
    const colCount = table.headers.length;
    const usableWidth = doc.page.width - 100;
    const colWidth = usableWidth / colCount;
    const rowHeight = 22;
    const bottomLimit = doc.page.height - 70;

    const drawTableHeader = () => {
      doc.rect(50, y, usableWidth, rowHeight).fill(BRAND_GREEN);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      table.headers.forEach((header, i) => {
        doc.text(header, 54 + i * colWidth, y + 6, { width: colWidth - 8, lineBreak: false });
      });
      y += rowHeight;
    };

    drawTableHeader();
    doc.font('Helvetica').fontSize(8).fillColor(TEXT);

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        y = 50;
        drawTableHeader();
        doc.font('Helvetica').fontSize(8).fillColor(TEXT);
      }

      if (rowIndex % 2 === 0) {
        doc.rect(50, y, usableWidth, rowHeight).fill('#F9FAFB');
      }

      const row = table.rows[rowIndex] ?? [];
      row.forEach((cell, i) => {
        doc.fillColor(TEXT).text(cell ?? '—', 54 + i * colWidth, y + 6, {
          width: colWidth - 8,
          height: rowHeight - 4,
          ellipsis: true,
          lineBreak: false,
        });
      });
      y += rowHeight;
    }

    if (table.rows.length === 0) {
      doc.fillColor(MUTED).fontSize(10).text('—', 50, y + 8);
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawPageFooter(doc, i - range.start + 1, range.count, meta.locale);
    }

    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}
