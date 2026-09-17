import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  AcademyAccountType,
  AcademyApprovalStatus,
  AcademyStatus,
  PlanStatus as PlanStatusConst,
  PlayerStatus,
  UserRole,
  type SignupIndependentBody,
  type SignupIndependentResponseDto,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { userRoleRepository } from '../repositories/user-role.repository.js';
import { parentLinkRepository } from '../repositories/parent-link.repository.js';
import { seedBaseActionCatalogForTenant } from './action-catalog-seed.service.js';
import { auditService } from './audit.service.js';
import { slugify } from '../utils/strings.js';
import { ConflictError, NotFoundError } from '../types/index.js';

const BCRYPT_ROUNDS = 12;
const PERSONAL_PLAN_NAME = 'Personal';
const DEFAULT_CATEGORY_NAME = 'Mi equipo';

export class IndependentSignupService {
  /**
   * Alta pública de un padre sin academia: crea una academia personal invisible
   * (una sola categoría, un solo jugador) y le da al padre también el rol coach
   * sobre ella, para reutilizar el motor de partidos/captura existente sin
   * tocar las reglas de autorización de coach↔categoría.
   */
  async signup(input: SignupIndependentBody): Promise<SignupIndependentResponseDto> {
    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    const plan = await planRepository.findByName(PERSONAL_PLAN_NAME);
    if (!plan || plan.status !== PlanStatusConst.ACTIVE) {
      throw new NotFoundError('El plan de cuenta individual no está disponible');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const slugBase = slugify(`${input.childFirstName}-${input.childLastName}`) || 'familia';
    const slug = `${slugBase}-${crypto.randomBytes(3).toString('hex')}`;

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const academyId = await academyRepository.create(
        {
          name: `Familia ${input.parentLastName.trim()}`,
          slug,
          status: AcademyStatus.INACTIVE,
          accountType: AcademyAccountType.PERSONAL,
          approvalStatus: AcademyApprovalStatus.PENDING,
          planId: plan.id,
        },
        conn,
      );

      const categoryId = await categoryRepository.create(
        { tenantId: academyId, name: DEFAULT_CATEGORY_NAME },
        conn,
      );

      await seedBaseActionCatalogForTenant(academyId, conn);

      const userId = await userRepository.create(
        {
          email,
          passwordHash,
          role: UserRole.PARENT,
          tenantId: academyId,
          firstName: input.parentFirstName.trim(),
          lastName: input.parentLastName.trim(),
        },
        conn,
      );
      // Segundo rol: le permite capturar en vivo reutilizando el RBAC coach↔categoría existente.
      await userRoleRepository.assignRole(userId, UserRole.COACH, academyId, conn);

      const playerId = await playerRepository.create(
        {
          tenantId: academyId,
          firstName: input.childFirstName.trim(),
          lastName: input.childLastName.trim(),
          jerseyNumber: input.childJerseyNumber ?? 1,
          categoryId,
          status: PlayerStatus.ACTIVE,
        },
        conn,
      );

      await parentLinkRepository.linkParentToPlayer(academyId, userId, playerId, conn);
      await categoryRepository.setCoach(academyId, categoryId, userId, conn);

      await conn.commit();

      await auditService.log(
        { userId, tenantId: academyId },
        'academy',
        academyId,
        'create',
        null,
        { accountType: AcademyAccountType.PERSONAL, approvalStatus: AcademyApprovalStatus.PENDING, email },
      );

      return { pendingApproval: true, email };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

export const independentSignupService = new IndependentSignupService();
