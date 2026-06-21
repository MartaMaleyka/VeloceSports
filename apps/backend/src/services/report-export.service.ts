import type { PlayerStatus, TenantReportType } from '@velocesport/shared';
import {
  TENANT_MANAGEABLE_ROLES,
  type MatchStatus,
  type MatchType,
  type ReportExportFormat,
  type UserStatus,
} from '@velocesport/shared';
import type { RowDataPacket } from 'mysql2/promise';
import { academyRepository } from '../repositories/academy.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';
import { matchRepository } from '../repositories/match.repository.js';
import { playerRepository } from '../repositories/player.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { getPool } from '../config/db.js';
import { getReportLabels, resolveReportLocale, type ReportLocale } from '../i18n/report-labels.js';
import { buildCsv, buildExportFilename, formatDateOnly, formatDateTime } from './report-csv.service.js';
import { generateReportPdf } from './report-pdf.service.js';
import { NotFoundError, ValidationError } from '../types/index.js';

export interface ReportExportFilters {
  locale?: string;
  categoryId?: number;
  status?: string;
  role?: string;
  matchType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportExportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

export class ReportExportService {
  async export(
    tenantId: number,
    reportType: TenantReportType,
    format: ReportExportFormat,
    filters: ReportExportFilters,
  ): Promise<ReportExportResult> {
    const academy = await academyRepository.findByTenantId(tenantId);
    if (!academy) throw new NotFoundError('Academia no encontrada');

    const locale = resolveReportLocale(filters.locale);
    const table = await this.buildTable(tenantId, reportType, locale, filters);

    const filename = buildExportFilename(reportType, academy.slug, format);

    if (format === 'csv') {
      return {
        buffer: buildCsv(table.headers, table.rows),
        contentType: 'text/csv; charset=utf-8',
        filename,
      };
    }

    const pdf = await generateReportPdf(
      {
        academyName: academy.name,
        logoUrl: academy.logo_url,
        reportType,
        locale,
        generatedAt: new Date(),
      },
      table,
    );

    return {
      buffer: pdf,
      contentType: 'application/pdf',
      filename,
    };
  }

  private async buildTable(
    tenantId: number,
    reportType: TenantReportType,
    locale: ReportLocale,
    filters: ReportExportFilters,
  ): Promise<{ headers: string[]; rows: string[][] }> {
    switch (reportType) {
      case 'players':
        return this.buildPlayersTable(tenantId, locale, filters);
      case 'users':
        return this.buildUsersTable(tenantId, locale, filters);
      case 'categories':
        return this.buildCategoriesTable(tenantId, locale, filters);
      case 'matches':
        return this.buildMatchesTable(tenantId, locale, filters);
      default:
        throw new ValidationError('Tipo de reporte no válido');
    }
  }

  private labelStatus(locale: ReportLocale, status: string): string {
    const L = getReportLabels(locale);
    return (L.status as Record<string, string>)[status] ?? status;
  }

  private async buildPlayersTable(
    tenantId: number,
    locale: ReportLocale,
    filters: ReportExportFilters,
  ): Promise<{ headers: string[]; rows: string[][] }> {
    const L = getReportLabels(locale);
    const rows = await playerRepository.findByTenantId(tenantId, {
      status: filters.status as PlayerStatus | undefined,
      categoryId: filters.categoryId,
    });
    const parentsMap = await playerRepository.findParentsForPlayers(
      tenantId,
      rows.map((r) => r.id),
    );

    return {
      headers: [
        L.players.name,
        L.players.dateOfBirth,
        L.players.category,
        L.players.status,
        L.players.jersey,
        L.players.position,
        L.players.parents,
      ],
      rows: rows.map((p) => {
        const parents = parentsMap.get(p.id) ?? [];
        return [
          `${p.first_name} ${p.last_name}`,
          formatDateOnly(p.date_of_birth, locale),
          p.category_name ?? L.common.none,
          this.labelStatus(locale, p.status),
          String(p.jersey_number),
          p.position ?? L.common.none,
          parents.length > 0 ? parents.map((x) => x.email).join(', ') : L.common.none,
        ];
      }),
    };
  }

  private async buildUsersTable(
    tenantId: number,
    locale: ReportLocale,
    filters: ReportExportFilters,
  ): Promise<{ headers: string[]; rows: string[][] }> {
    const L = getReportLabels(locale);
    const users = await userRepository.findByTenantId(tenantId, {
      role: filters.role as (typeof TENANT_MANAGEABLE_ROLES)[number] | undefined,
      status: filters.status as UserStatus | undefined,
    });

    const manageable = users.filter((u) =>
      (TENANT_MANAGEABLE_ROLES as readonly string[]).includes(u.role),
    );

    return {
      headers: [L.users.name, L.users.email, L.users.role, L.users.status, L.users.lastLogin],
      rows: manageable.map((u) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || L.common.none;
        return [
          name,
          u.email,
          (L.roles as Record<string, string>)[u.role] ?? u.role,
          this.labelStatus(locale, u.status),
          u.last_login_at ? formatDateTime(u.last_login_at, locale) : L.common.never,
        ];
      }),
    };
  }

  private async buildCategoriesTable(
    tenantId: number,
    locale: ReportLocale,
    filters: ReportExportFilters,
  ): Promise<{ headers: string[]; rows: string[][] }> {
    const L = getReportLabels(locale);
    const categories = await categoryRepository.findByTenantId(tenantId, {
      status: filters.status as 'active' | 'inactive' | undefined,
    });
    const playerCounts = await this.countPlayersByCategory(tenantId);

    return {
      headers: [
        L.categories.name,
        L.categories.ageRange,
        L.categories.coach,
        L.categories.playerCount,
        L.categories.status,
      ],
      rows: categories.map((c) => {
        const ageRange =
          c.age_min != null || c.age_max != null
            ? `${c.age_min ?? '?'}–${c.age_max ?? '?'}`
            : L.common.none;
        return [
          c.name,
          ageRange,
          c.coach_email ?? L.common.none,
          String(playerCounts.get(c.id) ?? 0),
          this.labelStatus(locale, c.status),
        ];
      }),
    };
  }

  private async buildMatchesTable(
    tenantId: number,
    locale: ReportLocale,
    filters: ReportExportFilters,
  ): Promise<{ headers: string[]; rows: string[][] }> {
    const L = getReportLabels(locale);
    const matches = await matchRepository.findByTenantId(tenantId, {
      categoryId: filters.categoryId,
      status: filters.status as MatchStatus | undefined,
      matchType: filters.matchType as MatchType | undefined,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    return {
      headers: [
        L.matches.opponent,
        L.matches.category,
        L.matches.datetime,
        L.matches.type,
        L.matches.status,
      ],
      rows: matches.map((m) => [
        m.opponent,
        m.category_name,
        formatDateTime(m.match_datetime, locale),
        (L.matchType as Record<string, string>)[m.match_type] ?? m.match_type,
        this.labelStatus(locale, m.status),
      ]),
    };
  }

  private async countPlayersByCategory(tenantId: number): Promise<Map<number, number>> {
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT category_id, COUNT(*) AS cnt
       FROM players
       WHERE tenant_id = ? AND category_id IS NOT NULL
       GROUP BY category_id`,
      [tenantId],
    );
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(Number(row.category_id), Number(row.cnt));
    }
    return map;
  }
}

export const reportExportService = new ReportExportService();
