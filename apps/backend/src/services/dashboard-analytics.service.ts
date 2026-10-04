import { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { logger } from './logger.service.js';

export interface DashboardMetrics {
  totalActivePlayers: number;
  totalCategories: number;
  totalMatches: number;
  totalCoaches: number;
  recentMatches: Array<{
    id: number;
    date: string;
    categoryName: string;
    matchType: string;
    status: string;
  }>;
  playerStats: {
    active: number;
    pending: number;
    inactive: number;
  };
  matchStats: {
    completed: number;
    scheduled: number;
    cancelled: number;
  };
}

interface PlayerStatRow extends RowDataPacket {
  status: string;
  count: number;
}

interface TotalPlayersRow extends RowDataPacket {
  totalPlayers: number;
}

interface TotalCategoriesRow extends RowDataPacket {
  totalCategories: number;
}

interface TotalMatchesRow extends RowDataPacket {
  totalMatches: number;
}

interface TotalCoachesRow extends RowDataPacket {
  totalCoaches: number;
}

interface RecentMatchRow extends RowDataPacket {
  id: number;
  date: string;
  category_name: string;
  match_type: string;
  status: string;
}

interface PlayerPerfRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
  matches_played: number;
  matches_attended: number;
  attendance_rate: number;
}

export class DashboardAnalyticsService {
  async getAcademyDashboard(tenantId: number): Promise<DashboardMetrics> {
    const pool = getPool();

    try {
      const [playerStats] = await pool.query<PlayerStatRow[]>(
        'SELECT status, COUNT(*) as count FROM players WHERE tenant_id = ? GROUP BY status',
        [tenantId]
      );

      const [matchStats] = await pool.query<PlayerStatRow[]>(
        'SELECT status, COUNT(*) as count FROM matches WHERE tenant_id = ? GROUP BY status',
        [tenantId]
      );

      const [[totalPlayersRow]] = await pool.query<TotalPlayersRow[]>(
        'SELECT COUNT(*) as totalPlayers FROM players WHERE tenant_id = ? AND status = "active"',
        [tenantId]
      );
      const totalPlayers = totalPlayersRow.totalPlayers;

      const [[totalCategoriesRow]] = await pool.query<TotalCategoriesRow[]>(
        'SELECT COUNT(*) as totalCategories FROM categories WHERE tenant_id = ?',
        [tenantId]
      );
      const totalCategories = totalCategoriesRow.totalCategories;

      const [[totalMatchesRow]] = await pool.query<TotalMatchesRow[]>(
        'SELECT COUNT(*) as totalMatches FROM matches WHERE tenant_id = ?',
        [tenantId]
      );
      const totalMatches = totalMatchesRow.totalMatches;

      const [[totalCoachesRow]] = await pool.query<TotalCoachesRow[]>(
        'SELECT COUNT(DISTINCT user_id) as totalCoaches FROM coach_categories WHERE category_id IN (SELECT id FROM categories WHERE tenant_id = ?)',
        [tenantId]
      );
      const totalCoaches = totalCoachesRow.totalCoaches;

      const [recentMatches] = await pool.query<RecentMatchRow[]>(
        'SELECT m.id, DATE_FORMAT(m.date, "%Y-%m-%d %H:%i") as date, c.name as category_name, m.match_type, m.status FROM matches m JOIN categories c ON m.category_id = c.id WHERE m.tenant_id = ? ORDER BY m.date DESC LIMIT 10',
        [tenantId]
      );

      const playerBreakdown = { active: 0, pending: 0, inactive: 0 };
      playerStats.forEach(stat => {
        if (stat.status === 'active') playerBreakdown.active = stat.count;
        if (stat.status === 'pending') playerBreakdown.pending = stat.count;
        if (stat.status === 'inactive') playerBreakdown.inactive = stat.count;
      });

      const matchBreakdown = { completed: 0, scheduled: 0, cancelled: 0 };
      matchStats.forEach(stat => {
        if (stat.status === 'completed') matchBreakdown.completed = stat.count;
        if (stat.status === 'scheduled') matchBreakdown.scheduled = stat.count;
        if (stat.status === 'cancelled') matchBreakdown.cancelled = stat.count;
      });

      const metrics: DashboardMetrics = {
        totalActivePlayers: totalPlayers,
        totalCategories,
        totalMatches,
        totalCoaches,
        recentMatches: recentMatches.map(m => ({
          id: m.id,
          date: m.date,
          categoryName: m.category_name,
          matchType: m.match_type,
          status: m.status
        })),
        playerStats: playerBreakdown,
        matchStats: matchBreakdown
      };

      logger.info('Dashboard metrics fetched', {
        tenantId,
        metrics: { players: totalPlayers, categories: totalCategories, matches: totalMatches, coaches: totalCoaches }
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to fetch dashboard metrics', error instanceof Error ? error : new Error(String(error)), { tenantId });
      throw error;
    }
  }

  async getPlayerPerformanceStats(tenantId: number, categoryId?: number) {
    const pool = getPool();

    let query = 'SELECT p.id, p.first_name, p.last_name, COUNT(DISTINCT ma.match_id) as matches_played, SUM(CASE WHEN ma.status = "present" THEN 1 ELSE 0 END) as matches_attended, ROUND(COUNT(DISTINCT CASE WHEN ma.status = "present" THEN ma.match_id END) * 100.0 / NULLIF(COUNT(DISTINCT ma.match_id), 0), 2) as attendance_rate FROM players p LEFT JOIN match_attendance ma ON p.id = ma.player_id WHERE p.tenant_id = ? AND p.status = "active"';
    const params: any[] = [tenantId];

    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    query += ' GROUP BY p.id, p.first_name, p.last_name ORDER BY matches_played DESC, attendance_rate DESC LIMIT 50';

    const [stats] = await pool.query<PlayerPerfRow[]>(query, params);

    return stats;
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();
