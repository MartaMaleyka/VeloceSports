-- Caché del agente de IA para el análisis por periodo del coach (a diferencia de
-- player_match_insights, aquí no hay un match_id fijo: la clave es el filtro
-- aplicado por el coach, con un hash porque los filtros son variables).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS player_period_insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  filters_hash CHAR(64) NOT NULL,
  facts_json JSON NOT NULL,
  insight_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  generation_source ENUM('ollama', 'fallback') NOT NULL DEFAULT 'ollama',
  status ENUM('ready', 'generating', 'failed') NOT NULL DEFAULT 'ready',
  error_message VARCHAR(500) NULL,
  requested_by_user_id BIGINT UNSIGNED NULL,
  generated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_period_insights (tenant_id, player_id, filters_hash),
  KEY idx_player_period_insights_player (tenant_id, player_id),
  CONSTRAINT fk_ppi_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_ppi_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_ppi_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
