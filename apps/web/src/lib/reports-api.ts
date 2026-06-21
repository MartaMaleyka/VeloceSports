import type { ReportExportFormat, TenantReportType } from '@velocesport/shared';

export class ReportApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ReportApiError';
  }
}

export async function downloadTenantReport(
  reportType: TenantReportType,
  format: ReportExportFormat,
  params: Record<string, string | undefined>,
  locale: string,
): Promise<void> {
  const search = new URLSearchParams({ format, locale: locale === 'en' ? 'en' : 'es' });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }

  const response = await fetch(`/api/tenant/reports/${reportType}/export?${search.toString()}`, {
    credentials: 'same-origin',
    headers: {
      'Accept-Language': locale === 'en' ? 'en-US' : 'es-PA',
    },
  });

  if (!response.ok) {
    let message = 'Export failed';
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      // binary or empty
    }
    throw new ReportApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${reportType}.${format}`;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
