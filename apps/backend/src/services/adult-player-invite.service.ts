import bcrypt from 'bcryptjs';
import {
  UserRole,
  UserStatus,
  ViewerRelationship,
  resolveRequiresGuardian,
  type InviteAdultPlayerBody,
  type InviteAdultPlayerResponseDto,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { coachCategoryRepository } from '../repositories/coach-category.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { playerViewerRepository } from '../repositories/player-viewer.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/index.js';
import type { AuthUser } from '../types/index.js';
import { userHasRole } from '../utils/role-check.js';
import { generateTemporaryPassword } from '../utils/strings.js';
import { auditService } from './audit.service.js';

const BCRYPT_ROUNDS = 10;

export class AdultPlayerInviteService {
  async invite(
    actor: AuthUser,
    tenantId: number,
    playerId: number,
    input: InviteAdultPlayerBody,
  ): Promise<InviteAdultPlayerResponseDto> {
    const player = await playerRepository.findById(tenantId, playerId);
    if (!player) throw new NotFoundError('Jugador no encontrado');

    if (player.user_id != null) {
      throw new ConflictError('Este jugador ya tiene cuenta de acceso');
    }

    if (player.category_id == null) {
      throw new ValidationError('El jugador debe tener categoría asignada');
    }

    const category = await categoryRepository.findById(tenantId, player.category_id);
    if (!category) throw new ValidationError('Categoría no encontrada');

    const requiresGuardian = resolveRequiresGuardian({
      requiresGuardian: category.requires_guardian,
      ageMax: category.age_max,
    });
    if (requiresGuardian) {
      throw new ValidationError(
        'No se puede invitar como jugador adulto: la categoría requiere tutor/guardián',
        'CATEGORY_REQUIRES_GUARDIAN',
      );
    }

    // OPERAR: coach solo en categorías asignadas
    if (userHasRole(actor, UserRole.COACH) && !userHasRole(actor, UserRole.ACADEMY_ADMIN)) {
      const assigned = await coachCategoryRepository.isCoachAssignedToCategory(
        tenantId,
        actor.userId,
        player.category_id,
      );
      if (!assigned) {
        throw new ForbiddenError('No estás asignado a la categoría de este jugador');
      }
    }

    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ConflictError('El correo ya está registrado');

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const firstName = input.firstName?.trim() || player.first_name;
    const lastName = input.lastName?.trim() || player.last_name;

    const conn = await getPool().getConnection();
    let userId: number;
    try {
      await conn.beginTransaction();

      userId = await userRepository.create(
        {
          email,
          passwordHash,
          role: UserRole.PLAYER,
          tenantId,
          firstName,
          lastName,
          status: UserStatus.ACTIVE,
        },
        conn,
      );

      await conn.execute(
        'UPDATE users SET must_change_password = TRUE WHERE id = ?',
        [userId],
      );

      await playerRepository.setUserId(tenantId, playerId, userId, conn);

      // SELF solo en player_viewers (sin equivalente en parent_players).
      await playerViewerRepository.link(
        tenantId,
        playerId,
        userId,
        ViewerRelationship.SELF,
        conn,
      );

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    await auditService.log(
      { userId: actor.userId, tenantId },
      'player',
      playerId,
      'invite_adult',
      null,
      { userId, email, relationship: ViewerRelationship.SELF },
    );

    return {
      userId,
      playerId,
      email,
      temporaryPassword,
      mustChangePassword: true,
    };
  }
}

export const adultPlayerInviteService = new AdultPlayerInviteService();
