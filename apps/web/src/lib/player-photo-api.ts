import { appPath } from './app-path.js';
import type { PlayerPhotoUploadResponseDto, PlayerPhotoUrlResponseDto } from '@velocesport/shared';

export class PlayerPhotoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'PlayerPhotoApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export async function uploadPlayerPhoto(
  playerId: number,
  file: Blob,
  fileName: string,
): Promise<PlayerPhotoUploadResponseDto> {
  const form = new FormData();
  form.append('photo', file, fileName);

  const response = await fetch(appPath(`/api/players/${playerId}/photo`), {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });

  const body = (await response.json()) as ApiResponse<PlayerPhotoUploadResponseDto>;
  if (!response.ok || !body.success) {
    throw new PlayerPhotoApiError(body.message ?? 'No pudimos subir la foto', response.status, body.code);
  }
  return body.data as PlayerPhotoUploadResponseDto;
}

export async function deletePlayerPhoto(playerId: number): Promise<void> {
  const response = await fetch(appPath(`/api/players/${playerId}/photo`), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  const body = (await response.json()) as ApiResponse<unknown>;
  if (!response.ok || !body.success) {
    throw new PlayerPhotoApiError(body.message ?? 'No pudimos eliminar la foto', response.status, body.code);
  }
}

export async function getPlayerPhotoUrl(playerId: number): Promise<string | null> {
  const response = await fetch(appPath(`/api/players/${playerId}/photo-url`), {
    method: 'GET',
    credentials: 'same-origin',
  });
  const body = (await response.json()) as ApiResponse<PlayerPhotoUrlResponseDto>;
  if (!response.ok || !body.success) {
    throw new PlayerPhotoApiError(body.message ?? 'No pudimos obtener la foto', response.status, body.code);
  }
  return body.data?.photoUrl ?? null;
}
