import { appPath } from './app-path.js';

export class MatchesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'MatchesApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export async function matchesFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(appPath(`/api/matches/${path}`), {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new MatchesApiError(body.message ?? 'Request failed', response.status, body.code);
  }
  return body.data as T;
}

export async function matchesFetchList<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return matchesFetch<T[]>(qs ? `${path}?${qs}` : path);
}
