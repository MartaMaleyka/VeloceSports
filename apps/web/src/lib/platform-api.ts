import { appPath } from './app-path.js';

export class PlatformApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

export async function platformFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(appPath(`/api/platform/${path}`), {
      ...options,
      credentials: 'same-origin',
      headers,
    });
  } catch {
    throw new PlatformApiError('Network error', 0);
  }

  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new PlatformApiError('Invalid response', response.status);
  }

  if (!response.ok || !body.success) {
    throw new PlatformApiError(body.message ?? 'Request failed', response.status, body.code, body.details);
  }

  return body.data as T;
}

export async function platformFetchList<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }
  }
  const qs = search.toString();
  return platformFetch<T[]>(qs ? `${path}?${qs}` : path);
}
