import type { AcademyDashboardDto } from '@velocesport/shared';
import { academyRepository } from '../repositories/academy.repository.js';
import { academyDashboardRepository } from '../repositories/academy-dashboard.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { invoiceService } from './invoice.service.js';
import { planLimitService } from './plan-limit.service.js';
import { NotFoundError } from '../types/index.js';

export class AcademyDashboardService {
  async getDashboard(tenantId: number): Promise<AcademyDashboardDto> {
    const academy = await academyRepository.findByIdWithDetails(tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');

    const [
      limits,
      playerStatusCounts,
      byCategoryRows,
      categoryTotal,
      coachCounts,
      usersByRole,
      upcomingCount,
      inProgressCount,
      upcomingSoonRows,
      billingSummary,
    ] = await Promise.all([
      planLimitService.getLimits(tenantId),
      academyDashboardRepository.countPlayersByStatus(tenantId),
      playerRepository.countByCategory(tenantId),
      categoryRepository.countByTenant(tenantId),
      categoryRepository.countWithCoach(tenantId),
      userRepository.countByRoleInTenant(tenantId),
      matchRepository.countUpcoming(tenantId),
      matchRepository.countInProgress(tenantId),
      academyDashboardRepository.findUpcomingMatches(tenantId),
      invoiceService.getBillingSummary(tenantId),
    ]);

    const totalCount = Object.values(playerStatusCounts).reduce((sum, n) => sum + n, 0);

    return {
      academyName: academy.name,
      players: {
        activeCount: playerStatusCounts.active,
        pendingCount: playerStatusCounts.pending,
        inactiveCount: playerStatusCounts.inactive,
        injuredCount: playerStatusCounts.injured,
        retiredCount: playerStatusCounts.retired,
        totalCount,
        planLimit: limits.plan.max_players,
        byCategory: byCategoryRows.map((r) => ({
          categoryId: r.category_id,
          categoryName: r.category_name,
          count: r.count,
        })),
      },
      categories: {
        totalCount: categoryTotal,
        withoutCoachCount: coachCounts.withoutCoach,
      },
      usersByRole: {
        academyAdmin: usersByRole.academy_admin,
        coach: usersByRole.coach,
        parent: usersByRole.parent,
      },
      matches: {
        upcomingCount,
        inProgressCount,
        upcomingSoon: upcomingSoonRows.map((r) => ({
          id: r.id,
          opponent: r.opponent,
          categoryName: r.category_name,
          matchDatetime: r.match_datetime.toISOString(),
        })),
      },
      billing: {
        planName: billingSummary.planName,
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
}

export const academyDashboardService = new AcademyDashboardService();
