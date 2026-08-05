import { appPath } from './app-path.js';
import type {
  CoachAnalysisFiltersDto,
  CoachPlayerAnalysisDetailDto,
  CoachPlayerAnalysisListDto,
} from '@velocesport/shared';

export class CoachAnalysisApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'CoachAnalysisApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

function toQuery(filters: CoachAnalysisFiltersDto): string {
  const search = new URLSearchParams();
  if (filters.categoryId != null) search.set('categoryId', String(filters.categoryId));
  if (filters.matchId != null) search.set('matchId', String(filters.matchId));
  if (filters.dateFrom) search.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) search.set('dateTo', filters.dateTo);
  if (filters.actionCode != null) search.set('actionCode', String(filters.actionCode));
  if (filters.impact) search.set('impact', filters.impact);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function analysisFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(appPath(`/api/coach/analysis/${path}`), {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new CoachAnalysisApiError(body.message ?? 'Request failed', response.status, body.code);
  }
  return body.data as T;
}

export async function fetchCoachPlayerAnalysis(
  filters: CoachAnalysisFiltersDto = {},
): Promise<CoachPlayerAnalysisListDto> {
  return analysisFetch<CoachPlayerAnalysisListDto>(`players${toQuery(filters)}`);
}

export async function fetchCoachPlayerAnalysisDetail(
  playerId: number,
  filters: CoachAnalysisFiltersDto = {},
): Promise<CoachPlayerAnalysisDetailDto> {
  return analysisFetch<CoachPlayerAnalysisDetailDto>(`players/${playerId}${toQuery(filters)}`);
}

export async function downloadCoachPlayerAnalysisCsv(
  filters: CoachAnalysisFiltersDto = {},
): Promise<void> {
  return downloadCoachPlayerAnalysisExport('csv', filters);
}

export async function downloadCoachPlayerAnalysisPdf(
  filters: CoachAnalysisFiltersDto = {},
): Promise<void> {
  return downloadCoachPlayerAnalysisExport('pdf', filters);
}

async function downloadCoachPlayerAnalysisExport(
  format: 'csv' | 'pdf',
  filters: CoachAnalysisFiltersDto = {},
): Promise<void> {
  const response = await fetch(
    appPath(`/api/coach/analysis/players/export.${format}${toQuery(filters)}`),
    { credentials: 'same-origin' },
  );

  if (!response.ok) {
    let message = format === 'pdf' ? 'No pudimos exportar el PDF' : 'No pudimos exportar el CSV';
    try {
      const body = (await response.json()) as ApiResponse<unknown>;
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new CoachAnalysisApiError(message, response.status);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename =
    match?.[1] ??
    `coach-analysis-players_${new Date().toISOString().slice(0, 10)}.${format}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function filtersToSearchParams(filters: CoachAnalysisFiltersDto): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.categoryId != null) search.set('categoryId', String(filters.categoryId));
  if (filters.matchId != null) search.set('matchId', String(filters.matchId));
  if (filters.dateFrom) search.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) search.set('dateTo', filters.dateTo);
  if (filters.actionCode != null) search.set('actionCode', String(filters.actionCode));
  if (filters.impact) search.set('impact', filters.impact);
  return search;
}

export function filtersFromSearchParams(params: URLSearchParams): CoachAnalysisFiltersDto {
  const categoryId = params.get('categoryId');
  const matchId = params.get('matchId');
  const actionCode = params.get('actionCode');
  const impact = params.get('impact');
  return {
    ...(categoryId ? { categoryId: Number(categoryId) } : {}),
    ...(matchId ? { matchId: Number(matchId) } : {}),
    ...(params.get('dateFrom') ? { dateFrom: params.get('dateFrom')! } : {}),
    ...(params.get('dateTo') ? { dateTo: params.get('dateTo')! } : {}),
    ...(actionCode ? { actionCode: Number(actionCode) } : {}),
    ...(impact === 'positive' || impact === 'negative' || impact === 'neutral'
      ? { impact }
      : {}),
  };
}
