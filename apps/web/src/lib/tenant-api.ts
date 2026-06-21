export class TenantApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'TenantApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export async function tenantFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/tenant/${path}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new TenantApiError(body.message ?? 'Request failed', response.status, body.code);
  }
  return body.data as T;
}

export async function tenantFetchList<T>(
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
  return tenantFetch<T[]>(qs ? `${path}?${qs}` : path);
}
