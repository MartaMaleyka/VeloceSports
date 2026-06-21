-- Migration 015: captura en vivo — idempotencia, dorsal, estado voided, trazabilidad
SET NAMES utf8mb4;

ALTER TABLE game_actions
  ADD COLUMN match_jersey_number SMALLINT UNSIGNED NULL COMMENT 'Dorsal al momento de captura N-M' AFTER player_id,
  ADD COLUMN status ENUM('active', 'voided') NOT NULL DEFAULT 'active' AFTER period,
  ADD COLUMN client_action_id CHAR(36) NULL COMMENT 'UUID cliente para idempotencia optimista' AFTER created_by,
  ADD COLUMN voided_by BIGINT UNSIGNED NULL AFTER created_at,
  ADD COLUMN voided_at TIMESTAMP NULL AFTER voided_by,
  ADD COLUMN void_reason VARCHAR(500) NULL AFTER voided_at;

ALTER TABLE game_actions
  ADD UNIQUE KEY uq_game_actions_client_action (tenant_id, client_action_id),
  ADD KEY idx_game_actions_match_status (tenant_id, match_id, status),
  ADD CONSTRAINT fk_game_actions_voided_by FOREIGN KEY (voided_by) REFERENCES users (id) ON DELETE RESTRICT;
