import { appPath } from './app-path.js';

export class PlayerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PlayerApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export async function playerFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(appPath(`/api/player/${path}`), {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new PlayerApiError(body.message ?? 'Request failed', response.status, body.code);
  }
  return body.data as T;
}
