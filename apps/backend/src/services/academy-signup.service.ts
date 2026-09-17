import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {
  AcademyApprovalStatus,
  AcademyStatus,
  PlanStatus as PlanStatusConst,
  UserRole,
  type SignupAcademyBody,
  type SignupIndependentResponseDto,
} from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { planRepository } from '../repositories/plan.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { seedBaseActionCatalogForTenant } from './action-catalog-seed.service.js';
import { auditService } from './audit.service.js';
import { slugify } from '../utils/strings.js';
import { ConflictError, NotFoundError } from '../types/index.js';

const BCRYPT_ROUNDS = 12;
/** Plan asignado por defecto a una academia autorregistrada; el super_admin puede
 * cambiarlo al aprobarla o después, desde la edición de la academia. */
const DEFAULT_SIGNUP_PLAN_NAME = 'Básico';

export class AcademySignupService {
  /**
   * Alta pública de una academia real (con su primer academy_admin). Igual que
   * el alta independiente: la cuenta queda pendiente de aprobación de
   * super_admin y no se emiten tokens hasta entonces.
   */
  async signup(input: SignupAcademyBody): Promise<SignupIndependentResponseDto> {
    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    const plan = await planRepository.findByName(DEFAULT_SIGNUP_PLAN_NAME);
    if (!plan || plan.status !== PlanStatusConst.ACTIVE) {
      throw new NotFoundError('No hay un plan disponible para el alta automática');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const slugBase = slugify(input.academyName) || 'academia';
    let slug = slugBase;
    if (await academyRepository.findBySlug(slug)) {
      slug = `${slugBase}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const pool = getPool();
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const academyId = await academyRepository.create(
        {
          name: input.academyName.trim(),
          slug,
          status: AcademyStatus.INACTIVE,
          approvalStatus: AcademyApprovalStatus.PENDING,
          planId: plan.id,
        },
        conn,
      );

      await seedBaseActionCatalogForTenant(academyId, conn);

      const userId = await userRepository.create(
        {
          email,
          passwordHash,
          role: UserRole.ACADEMY_ADMIN,
          tenantId: academyId,
          firstName: input.adminFirstName.trim(),
          lastName: input.adminLastName.trim(),
        },
        conn,
      );

      await conn.commit();

      await auditService.log(
        { userId, tenantId: academyId },
        'academy',
        academyId,
        'create',
        null,
        { approvalStatus: AcademyApprovalStatus.PENDING, email, selfSignup: true },
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

export const academySignupService = new AcademySignupService();
