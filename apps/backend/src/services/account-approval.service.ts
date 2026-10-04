import type { AcademyDetailDto } from '@velocesport/shared';
import { AcademyApprovalStatus } from '@velocesport/shared';
import { emailLocaleFrom } from '../lib/email-template.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { emailRecipientRepository } from '../repositories/email-recipient.repository.js';
import { auditService } from './audit.service.js';
import { emailNotificationService } from './email-notification.service.js';
import { userSessionService } from './user-session.service.js';
import { ValidationError } from '../types/index.js';

export class AccountApprovalService {
  async approveAccount(
    actorUserId: number,
    academyId: number,
    getAcademyDetail: (id: number) => Promise<AcademyDetailDto>,
  ): Promise<AcademyDetailDto> {
    const before = await getAcademyDetail(academyId);

    if (before.approvalStatus !== AcademyApprovalStatus.PENDING) {
      throw new ValidationError('Esta solicitud ya fue procesada');
    }

    await academyRepository.approve(academyId);
    const after = await getAcademyDetail(academyId);

    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'academy',
      academyId,
      'approve',
      { approvalStatus: before.approvalStatus, status: before.status },
      { approvalStatus: after.approvalStatus, status: after.status },
    );

    await this.notifyAccountDecision(academyId, true, null);
    return after;
  }

  async rejectAccount(
    actorUserId: number,
    academyId: number,
    reason: string | null,
    getAcademyDetail: (id: number) => Promise<AcademyDetailDto>,
  ): Promise<AcademyDetailDto> {
    const before = await getAcademyDetail(academyId);

    if (before.approvalStatus !== AcademyApprovalStatus.PENDING) {
      throw new ValidationError('Esta solicitud ya fue procesada');
    }

    await academyRepository.reject(academyId, reason);
    await userSessionService.revokeAllSessionsForTenant(academyId);
    const after = await getAcademyDetail(academyId);

    await auditService.log(
      { userId: actorUserId, tenantId: academyId },
      'academy',
      academyId,
      'reject',
      { approvalStatus: before.approvalStatus },
      { approvalStatus: after.approvalStatus, approvalReason: after.approvalReason },
    );

    await this.notifyAccountDecision(academyId, false, reason);
    return after;
  }

  private async notifyAccountDecision(
    academyId: number,
    approved: boolean,
    reason: string | null,
  ): Promise<void> {
    const academy = await academyRepository.findById(academyId);
    if (!academy) return;
    const to = await emailRecipientRepository.findAccountOwnerEmails(academyId);
    if (to.length === 0) return;
    await emailNotificationService.sendAccountDecisionEmail({
      to,
      locale: emailLocaleFrom(academy.locale),
      accountName: academy.name,
      approved,
      reason,
    });
  }
}

export const accountApprovalService = new AccountApprovalService();
