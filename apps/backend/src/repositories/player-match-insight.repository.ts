import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { PlayerMatchInsightSource } from '@velocesport/shared';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

export type PlayerMatchInsightStatus = 'ready' | 'generating' | 'failed';

export interface PlayerMatchInsightRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  player_id: number;
  match_id: number;
  facts_json: string;
  facts_hash: string;
  player_text: string;
  parent_text: string;
  coach_text: string;
  model_name: string;
  generation_source: PlayerMatchInsightSource;
  status: PlayerMatchInsightStatus;
  error_message: string | null;
  requested_by_user_id: number | null;
  generated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertReadyInsightInput {
  tenantId: number;
  playerId: number;
  matchId: number;
  factsJson: string;
  factsHash: string;
  playerText: string;
  parentText: string;
  coachText: string;
  modelName: string;
  generationSource: PlayerMatchInsightSource;
  requestedByUserId: number;
}

const GENERATING_LOCK_WINDOW_SQL = "(status <> 'generating' OR updated_at < (NOW() - INTERVAL 60 SECOND))";

export class PlayerMatchInsightRepository extends TenantScopedRepository {
  async findByPlayerAndMatch(
    tenantId: number,
    playerId: number,
    matchId: number,
  ): Promise<PlayerMatchInsightRow | null> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<PlayerMatchInsightRow[]>(
      `SELECT * FROM player_match_insights
       WHERE tenant_id = ? AND player_id = ? AND match_id = ?
       LIMIT 1`,
      [tenantId, playerId, matchId],
    );
    return rows[0] ?? null;
  }

  /** Lock optimista: true si este llamador puede proceder a generar. */
  async tryMarkGenerating(
    tenantId: number,
    playerId: number,
    matchId: number,
    requestedByUserId: number,
  ): Promise<boolean> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO player_match_insights
         (tenant_id, player_id, match_id, facts_json, facts_hash,
          player_text, parent_text, coach_text, model_name,
          generation_source, status, requested_by_user_id)
       VALUES (?, ?, ?, JSON_OBJECT(), '', '', '', '', '', 'ollama', 'generating', ?)
       ON DUPLICATE KEY UPDATE
         status = IF(${GENERATING_LOCK_WINDOW_SQL}, 'generating', status),
         requested_by_user_id = IF(${GENERATING_LOCK_WINDOW_SQL}, VALUES(requested_by_user_id), requested_by_user_id)`,
      [tenantId, playerId, matchId, requestedByUserId],
    );
    return result.affectedRows > 0;
  }

  async upsertReady(input: UpsertReadyInsightInput): Promise<void> {
    this.assertTenantId(input.tenantId);
    const pool = getPool();
    await pool.execute(
      `INSERT INTO player_match_insights
         (tenant_id, player_id, match_id, facts_json, facts_hash,
          player_text, parent_text, coach_text, model_name,
          generation_source, status, error_message, requested_by_user_id, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', NULL, ?, NOW())
       ON DUPLICATE KEY UPDATE
         facts_json = VALUES(facts_json),
         facts_hash = VALUES(facts_hash),
         player_text = VALUES(player_text),
         parent_text = VALUES(parent_text),
         coach_text = VALUES(coach_text),
         model_name = VALUES(model_name),
         generation_source = VALUES(generation_source),
         status = 'ready',
         error_message = NULL,
         requested_by_user_id = VALUES(requested_by_user_id),
         generated_at = NOW()`,
      [
        input.tenantId,
        input.playerId,
        input.matchId,
        input.factsJson,
        input.factsHash,
        input.playerText,
        input.parentText,
        input.coachText,
        input.modelName,
        input.generationSource,
        input.requestedByUserId,
      ],
    );
  }

  async markFailed(
    tenantId: number,
    playerId: number,
    matchId: number,
    errorMessage: string,
  ): Promise<void> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    await pool.execute(
      `UPDATE player_match_insights
       SET status = 'failed', error_message = ?
       WHERE tenant_id = ? AND player_id = ? AND match_id = ?`,
      [errorMessage.slice(0, 500), tenantId, playerId, matchId],
    );
  }
}

export const playerMatchInsightRepository = new PlayerMatchInsightRepository();
