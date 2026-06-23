import type { AcademySettingsDto, UpdateAcademySettingsBody } from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { auditService } from './audit.service.js';
import { invoiceService } from './invoice.service.js';
import { planLimitService } from './plan-limit.service.js';
import { NotFoundError } from '../types/index.js';

export class AcademySettingsService {
  async getSettings(tenantId: number): Promise<AcademySettingsDto> {
    const academy = await academyRepository.findByTenantId(tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');

    const [limits, billingSummary] = await Promise.all([
      planLimitService.getLimits(tenantId),
      invoiceService.getBillingSummary(tenantId),
    ]);

    return {
      name: academy.name,
      logoUrl: academy.logo_url,
      contactEmail: academy.contact_email,
      contactPhone: academy.contact_phone,
      address: academy.address,
      timezone: academy.timezone,
      locale: academy.locale,
      currency: academy.currency,
      defaultPeriodsCount: academy.default_periods_count,
      defaultPeriodDurationMinutes: academy.default_period_duration_minutes,
      notificationsEnabled: Boolean(academy.notifications_enabled ?? true),
      readOnly: {
        slug: academy.slug,
        status: academy.status,
        billingAnchorDay: academy.billing_anchor_day,
        planName: limits.plan.name,
        planUsage: {
          maxPlayers: limits.plan.max_players,
          maxCategories: limits.plan.max_categories,
          maxUsers: limits.plan.max_users,
          maxMatchesPerMonth: limits.plan.max_matches_per_month,
          activePlayers: limits.activePlayerCount,
          categories: limits.categoryCount,
          users: limits.userCount,
        },
        academyBillingStatus: billingSummary.academyBillingStatus,
        nextPeriodEnd: billingSummary.nextPeriod.periodEnd,
        nextDueDate: billingSummary.upcomingInvoice?.dueDate ?? billingSummary.currentPeriod.dueDate,
        hasOverdueInvoice: billingSummary.overdueInvoice != null,
        hasPendingInvoice:
          billingSummary.academyBillingStatus === 'pending' ||
          billingSummary.upcomingInvoice?.status === 'pending',
      },
    };
  }

  async updateSettings(
    actorUserId: number,
    tenantId: number,
    input: UpdateAcademySettingsBody,
  ): Promise<AcademySettingsDto> {
    const before = await academyRepository.findByTenantId(tenantId);
    if (!before) throw new NotFoundError('Academia no encontrada');

    await academyRepository.updateTenantSettings(tenantId, {
      name: input.name,
      logoUrl: input.logoUrl,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      address: input.address,
      timezone: input.timezone,
      locale: input.locale,
      currency: input.currency,
      defaultPeriodsCount: input.defaultPeriodsCount,
      defaultPeriodDurationMinutes: input.defaultPeriodDurationMinutes,
      notificationsEnabled: input.notificationsEnabled,
    });

    await auditService.log(
      { userId: actorUserId, tenantId },
      'academy',
      tenantId,
      'settings_update',
      {
        name: before.name,
        timezone: before.timezone,
        locale: before.locale,
        currency: before.currency,
        defaultPeriodsCount: before.default_periods_count,
      },
      {
        name: input.name ?? before.name,
        timezone: input.timezone ?? before.timezone,
        locale: input.locale ?? before.locale,
        currency: input.currency ?? before.currency,
        defaultPeriodsCount: input.defaultPeriodsCount ?? before.default_periods_count,
      },
    );

    return this.getSettings(tenantId);
  }
}

export const academySettingsService = new AcademySettingsService();
