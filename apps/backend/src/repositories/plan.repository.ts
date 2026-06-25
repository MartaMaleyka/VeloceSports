import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { BillingCycle, PlanStatus } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import type { DbConnection } from '../config/db.js';

export interface PlanRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  annual_fee: string;
  price_per_player: string;
  price: string;
  billing_cycle: BillingCycle;
  max_players: number;
  max_categories: number;
  max_users: number;
  max_matches_per_month: number;
  status: PlanStatus;
  created_at: Date;
  updated_at: Date;
}

const PLAN_COLUMNS =
  'id, name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status, created_at, updated_at';

export interface CreatePlanInput {
  name: string;
  description?: string | null;
  annualFee: number;
  pricePerPlayer: number;
  maxPlayers: number;
  maxCategories: number;
  maxUsers: number;
  maxMatchesPerMonth: number;
  status?: PlanStatus;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string | null;
  annualFee?: number;
  pricePerPlayer?: number;
  maxPlayers?: number;
  maxCategories?: number;
  maxUsers?: number;
  maxMatchesPerMonth?: number;
  status?: PlanStatus;
}

export class PlanRepository {
  async findAll(filters?: { status?: PlanStatus; search?: string }): Promise<PlanRow[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.search) {
      conditions.push('(name LIKE ? OR description LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute<PlanRow[]>(
      `SELECT ${PLAN_COLUMNS} FROM plans ${where} ORDER BY name ASC`,
      params,
    );
    return rows;
  }

  async findById(planId: number): Promise<PlanRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<PlanRow[]>(
      `SELECT ${PLAN_COLUMNS} FROM plans WHERE id = ? LIMIT 1`,
      [planId],
    );
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<PlanRow | null> {
    const pool = getPool();
    const [rows] = await pool.execute<PlanRow[]>(
      `SELECT ${PLAN_COLUMNS} FROM plans WHERE name = ? LIMIT 1`,
      [name],
    );
    return rows[0] ?? null;
  }

  async create(input: CreatePlanInput, conn?: DbConnection): Promise<number> {
    const executor = conn ?? getPool();
    const legacyPrice = Math.round((input.annualFee / 12) * 100) / 100;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO plans (name, description, annual_fee, price_per_player, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.description ?? null,
        input.annualFee,
        input.pricePerPlayer,
        legacyPrice,
        'monthly',
        input.maxPlayers,
        input.maxCategories,
        input.maxUsers,
        input.maxMatchesPerMonth,
        input.status ?? 'active',
      ],
    );
    return result.insertId;
  }

  async update(planId: number, input: UpdatePlanInput): Promise<void> {
    const pool = getPool();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description);
    }
    if (input.annualFee !== undefined) {
      fields.push('annual_fee = ?');
      params.push(input.annualFee);
      fields.push('price = ?');
      params.push(Math.round((input.annualFee / 12) * 100) / 100);
    }
    if (input.pricePerPlayer !== undefined) {
      fields.push('price_per_player = ?');
      params.push(input.pricePerPlayer);
    }
    if (input.maxPlayers !== undefined) {
      fields.push('max_players = ?');
      params.push(input.maxPlayers);
    }
    if (input.maxCategories !== undefined) {
      fields.push('max_categories = ?');
      params.push(input.maxCategories);
    }
    if (input.maxUsers !== undefined) {
      fields.push('max_users = ?');
      params.push(input.maxUsers);
    }
    if (input.maxMatchesPerMonth !== undefined) {
      fields.push('max_matches_per_month = ?');
      params.push(input.maxMatchesPerMonth);
    }
    if (input.status !== undefined) {
      fields.push('status = ?');
      params.push(input.status);
    }

    if (fields.length === 0) return;

    params.push(planId);
    await pool.execute(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  async updateStatus(planId: number, status: PlanStatus): Promise<void> {
    const pool = getPool();
    await pool.execute('UPDATE plans SET status = ? WHERE id = ?', [status, planId]);
  }
}

export const planRepository = new PlanRepository();
