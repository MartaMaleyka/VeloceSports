import { appPath } from './app-path.js';

export async function downloadPdf(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error('PDF download failed');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function downloadPlatformInvoicePdf(invoiceId: number): Promise<void> {
  return downloadPdf(appPath(`/api/platform/invoices/${invoiceId}/pdf`), `invoice-${invoiceId}.pdf`);
}

export function downloadBillingInvoicePdf(invoiceId: number): Promise<void> {
  return downloadPdf(appPath(`/api/billing/invoices/${invoiceId}/pdf`), `invoice-${invoiceId}.pdf`);
}
