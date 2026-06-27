import type {
  ChangePasswordRequestDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from '@velocesport/shared';
import { appPath } from './app-path.js';

export class ProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ProfileApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

async function profileFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(appPath(`/api/auth/${path}`), {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    throw new ProfileApiError(body.message ?? 'Request failed', response.status, body.code);
  }
  return body.data as T;
}

export function fetchMyProfile(): Promise<UserProfileDto> {
  return profileFetch<UserProfileDto>('me', { method: 'GET' });
}

export function updateMyProfile(input: UpdateProfileRequestDto): Promise<UserProfileDto> {
  return profileFetch<UserProfileDto>('me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function changeMyPassword(
  input: Omit<ChangePasswordRequestDto, 'refreshToken'>,
): Promise<{ passwordChanged: true; otherSessionsRevoked: number }> {
  return profileFetch('password', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
