import { randomUUID } from 'node:crypto';
import * as Minio from 'minio';
import { env } from '../config/env.js';
import { AppError } from '../types/index.js';

export class StorageUnavailableError extends AppError {
  constructor(message = 'El almacenamiento de fotos no está disponible') {
    super(503, message, 'STORAGE_UNAVAILABLE');
  }
}

export class PhotoStorageService {
  private client: Minio.Client | null = null;
  private signingClient: Minio.Client | null = null;

  private getClient(): Minio.Client {
    if (!this.client) {
      this.client = new Minio.Client({
        endPoint: env.MINIO_ENDPOINT,
        port: env.MINIO_PORT,
        useSSL: env.MINIO_USE_SSL,
        accessKey: env.MINIO_ACCESS_KEY,
        secretKey: env.MINIO_SECRET_KEY,
        region: 'us-east-1',
      });
    }
    return this.client;
  }

  /**
   * Cliente para firmar URLs con el host que ve el navegador.
   * Con `region` fijo, el SDK no necesita conectar al firmar (evita ECONNREFUSED
   * cuando el public endpoint es 127.0.0.1 visto desde un contenedor).
   */
  private getSigningClient(): Minio.Client {
    const publicHost = env.MINIO_PUBLIC_ENDPOINT;
    if (!publicHost) {
      return this.getClient();
    }
    if (!this.signingClient) {
      this.signingClient = new Minio.Client({
        endPoint: publicHost,
        port: env.MINIO_PUBLIC_PORT ?? env.MINIO_PORT,
        useSSL: env.MINIO_USE_SSL,
        accessKey: env.MINIO_ACCESS_KEY,
        secretKey: env.MINIO_SECRET_KEY,
        region: 'us-east-1',
      });
    }
    return this.signingClient;
  }

  private bucket(): string {
    return env.MINIO_BUCKET;
  }

  buildObjectKey(tenantId: number, playerId: number): string {
    return `players/${tenantId}/${playerId}/${randomUUID()}.webp`;
  }

  async uploadPhoto(
    tenantId: number,
    playerId: number,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const objectKey = this.buildObjectKey(tenantId, playerId);
    try {
      const client = this.getClient();
      await client.putObject(this.bucket(), objectKey, buffer, buffer.length, {
        'Content-Type': mimeType,
      });
      return objectKey;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StorageUnavailableError(`No pudimos guardar la foto: ${message}`);
    }
  }

  async getSignedUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    try {
      return await this.getSigningClient().presignedGetObject(
        this.bucket(),
        objectKey,
        expirySeconds,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StorageUnavailableError(`No pudimos generar el enlace de la foto: ${message}`);
    }
  }

  async deletePhoto(objectKey: string): Promise<void> {
    try {
      await this.getClient().removeObject(this.bucket(), objectKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new StorageUnavailableError(`No pudimos eliminar la foto: ${message}`);
    }
  }
}

export const photoStorageService = new PhotoStorageService();

/** Inyectable en tests */
let storageOverride: PhotoStorageService | null = null;

export function getPhotoStorage(): PhotoStorageService {
  return storageOverride ?? photoStorageService;
}

export function setPhotoStorageForTests(storage: PhotoStorageService | null): void {
  storageOverride = storage;
}
