import fileType from 'file-type';
import sharp from 'sharp';
import {
  PlayerStatus,
  UserRole,
  type PlayerPhotoUrlResponseDto,
  type PlayerPhotoUploadResponseDto,
} from '@velocesport/shared';
import { playerRepository } from '../repositories/player.repository.js';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../types/index.js';
import type { AuthUser } from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';
import { auditService } from './audit.service.js';
import { getPhotoStorage } from './photo-storage.service.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OUTPUT_MIME = 'image/webp';
const OUTPUT_SIZE = 512;

export class PlayerPhotoService {
  async upload(
    actor: AuthUser,
    playerId: number,
    file: { buffer: Buffer; originalname: string; size: number } | undefined,
  ): Promise<PlayerPhotoUploadResponseDto> {
    this.assertParentCanMutate(actor);
    if (!file?.buffer?.length) {
      throw new ValidationError('Sube una foto en el campo "photo"');
    }
    if (file.size > MAX_BYTES || file.buffer.length > MAX_BYTES) {
      throw new ValidationError('La foto no puede superar 5 MB');
    }

    const tenantId = actor.tenantId!;
    const player = await this.assertApprovedParentLink(tenantId, actor.userId, playerId);

    const processed = await this.processImage(file.buffer, file.originalname);
    const storage = getPhotoStorage();
    const previousKey = player.photo_object_key;

    const objectKey = await storage.uploadPhoto(tenantId, playerId, processed, OUTPUT_MIME);
    await playerRepository.updatePhoto(tenantId, playerId, {
      photoObjectKey: objectKey,
      uploadedBy: actor.userId,
      uploadedAt: new Date(),
    });

    if (previousKey && previousKey !== objectKey) {
      try {
        await storage.deletePhoto(previousKey);
      } catch {
        // No bloqueamos el éxito si falla el borrado de la anterior
      }
    }

    await auditService.log(
      { userId: actor.userId, tenantId },
      'player',
      playerId,
      'photo_upload',
      previousKey ? { photoObjectKey: previousKey } : null,
      { photoObjectKey: objectKey },
    );

    const photoUrl = await storage.getSignedUrl(objectKey);
    return { photoUrl };
  }

  async remove(actor: AuthUser, playerId: number): Promise<void> {
    this.assertParentCanMutate(actor);
    const tenantId = actor.tenantId!;
    const player = await this.assertApprovedParentLink(tenantId, actor.userId, playerId);
    const previousKey = player.photo_object_key;
    if (!previousKey) {
      return;
    }

    await getPhotoStorage().deletePhoto(previousKey);
    await playerRepository.updatePhoto(tenantId, playerId, {
      photoObjectKey: null,
      uploadedBy: null,
      uploadedAt: null,
    });

    await auditService.log(
      { userId: actor.userId, tenantId },
      'player',
      playerId,
      'photo_delete',
      { photoObjectKey: previousKey },
      null,
    );
  }

  async getPhotoUrl(actor: AuthUser, playerId: number): Promise<PlayerPhotoUrlResponseDto> {
    const player = await this.assertCanView(actor, playerId);
    if (!player.photo_object_key) {
      return { photoUrl: null };
    }
    const photoUrl = await getPhotoStorage().getSignedUrl(player.photo_object_key);
    return { photoUrl };
  }

  async resolveSignedUrl(objectKey: string | null | undefined): Promise<string | null> {
    if (!objectKey) return null;
    try {
      return await getPhotoStorage().getSignedUrl(objectKey);
    } catch {
      return null;
    }
  }

  private assertParentCanMutate(actor: AuthUser): void {
    const isParent = userHasRole(actor, UserRole.PARENT);
    const isPlayer = userHasRole(actor, UserRole.PLAYER);
    if ((!isParent && !isPlayer) || actor.tenantId == null) {
      throw new ForbiddenError('Solo el padre, tutor o el propio jugador pueden gestionar la foto');
    }
  }

  private async assertApprovedParentLink(tenantId: number, parentUserId: number, playerId: number) {
    const linked = await playerRepository.isLinkedToViewer(tenantId, parentUserId, playerId);
    if (!linked) {
      throw new ForbiddenError('No puedes gestionar la foto de este jugador');
    }
    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) {
      throw new NotFoundError('Jugador no encontrado');
    }
    // Inscripción pendiente = vínculo aún no aprobado por la academia
    if (player.status === PlayerStatus.PENDING) {
      throw new ForbiddenError('El vínculo aún no está aprobado');
    }
    return player;
  }

  private async assertCanView(actor: AuthUser, playerId: number) {
    if (userHasRole(actor, UserRole.SUPER_ADMIN)) {
      const player = await playerRepository.findByIdGlobal(playerId);
      if (!player) throw new NotFoundError('Jugador no encontrado');
      return player;
    }

    if (actor.tenantId == null) {
      throw new ForbiddenError('No tienes acceso a este jugador');
    }

    const player = await playerRepository.findById(actor.tenantId, playerId);
    if (!player) {
      throw new NotFoundError('Jugador no encontrado');
    }

    if (userHasRole(actor, UserRole.ACADEMY_ADMIN)) {
      return player;
    }

    if (userHasRole(actor, UserRole.PARENT) || userHasRole(actor, UserRole.PLAYER)) {
      const linked = await playerRepository.isLinkedToViewer(
        actor.tenantId,
        actor.userId,
        playerId,
      );
      if (!linked) throw new ForbiddenError('No tienes acceso a este jugador');
      return player;
    }

    if (userHasRole(actor, UserRole.COACH) && player.category_id != null) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        actor.tenantId,
        actor.userId,
        player.category_id,
      );
      if (assigned) return player;
    }

    throw new ForbiddenError('No tienes acceso a este jugador');
  }

  private async processImage(buffer: Buffer, originalName: string): Promise<Buffer> {
    const detected = await fileType.fromBuffer(buffer);
    if (!detected || !ALLOWED_MIME.has(detected.mime)) {
      throw new ValidationError(
        'Formato no permitido. Usa JPG, PNG o WebP (el contenido real del archivo no coincide)',
      );
    }

    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      throw new ValidationError('Extensión no permitida. Usa .jpg, .jpeg, .png o .webp');
    }

    try {
      let pipeline = sharp(buffer, { failOn: 'error' }).rotate();
      const meta = await pipeline.metadata();
      if ((meta.width ?? 0) > 2000 || (meta.height ?? 0) > 2000) {
        pipeline = sharp(buffer, { failOn: 'error' })
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: 'inside',
            withoutEnlargement: true,
          });
      }

      return await pipeline
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'centre' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError('No pudimos procesar la imagen. Prueba con otro archivo.');
    }
  }
}

export const playerPhotoService = new PlayerPhotoService();
