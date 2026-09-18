import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { PlayerMatchInsightSource } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export type PlayerPeriodInsightStatus = 'ready' | 'generating' | 'failed';

export interface PlayerPeriodInsightRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  player_id: number;
  filters_hash: string;
  /** mysql2 deserializa las columnas JSON a objetos JS automáticamente. */
  facts_json: unknown;
  insight_text: string;
  model_name: string;
  generation_source: PlayerMatchInsightSource;
  status: PlayerPeriodInsightStatus;
  error_message: string | null;
  requested_by_user_id: number | null;
  generated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertReadyPeriodInsightInput {
  tenantId: number;
  playerId: number;
  filtersHash: string;
  factsJson: string;
  insightText: string;
  modelName: string;
  generationSource: PlayerMatchInsightSource;
  requestedByUserId: number;
}

const GENERATING_LOCK_WINDOW_SQL = "(status <> 'generating' OR updated_at < (NOW() - INTERVAL 60 SECOND))";

export class PlayerPeriodInsightRepository extends TenantScopedRepository {
  async findByPlayerAndFilters(
    tenantId: number,
    playerId: number,
    filtersHash: string,
  ): Promise<PlayerPeriodInsightRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerPeriodInsightRow[]>(
      `SELECT * FROM player_period_insights
       WHERE tenant_id = ? AND player_id = ? AND filters_hash = ?
       LIMIT 1`,
      [tenantId, playerId, filtersHash],
    );
    return rows[0] ?? null;
  }

  /** Lock optimista: true si este llamador puede proceder a generar. */
  async tryMarkGenerating(
    tenantId: number,
    playerId: number,
    filtersHash: string,
    requestedByUserId: number,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO player_period_insights
         (tenant_id, player_id, filters_hash, facts_json, insight_text, model_name,
          generation_source, status, requested_by_user_id)
       VALUES (?, ?, ?, JSON_OBJECT(), '', '', 'ollama', 'generating', ?)
       ON DUPLICATE KEY UPDATE
         status = IF(${GENERATING_LOCK_WINDOW_SQL}, 'generating', status),
         requested_by_user_id = IF(${GENERATING_LOCK_WINDOW_SQL}, VALUES(requested_by_user_id), requested_by_user_id)`,
      [tenantId, playerId, filtersHash, requestedByUserId],
    );
    return result.affectedRows > 0;
  }

  async upsertReady(input: UpsertReadyPeriodInsightInput): Promise<void> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    await pool.execute(
      `INSERT INTO player_period_insights
         (tenant_id, player_id, filters_hash, facts_json, insight_text, model_name,
          generation_source, status, error_message, requested_by_user_id, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE
         facts_json = VALUES(facts_json),
         insight_text = VALUES(insight_text),
         model_name = VALUES(model_name),
         generation_source = VALUES(generation_source),
         status = 'ready',
         error_message = NULL,
         requested_by_user_id = VALUES(requested_by_user_id),
         generated_at = NOW()`,
      [
        input.tenantId,
        input.playerId,
        input.filtersHash,
        input.factsJson,
        input.insightText,
        input.modelName,
        input.generationSource,
        input.requestedByUserId,
      ],
    );
  }

  async markFailed(
    tenantId: number,
    playerId: number,
    filtersHash: string,
    errorMessage: string,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      `UPDATE player_period_insights
       SET status = 'failed', error_message = ?
       WHERE tenant_id = ? AND player_id = ? AND filters_hash = ?`,
      [errorMessage.slice(0, 500), tenantId, playerId, filtersHash],
    );
  }
}

export const playerPeriodInsightRepository = new PlayerPeriodInsightRepository();
