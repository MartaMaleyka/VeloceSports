-- Caché del agente de interpretación de estadísticas (IA local vía Ollama):
-- guarda la última generación vigente por jugador+partido para no tener que
-- volver a llamar al modelo en cada vista de la ficha.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS player_match_insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  match_id BIGINT UNSIGNED NOT NULL,
  facts_json JSON NOT NULL,
  facts_hash CHAR(64) NOT NULL,
  player_text TEXT NOT NULL,
  parent_text TEXT NOT NULL,
  coach_text TEXT NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  generation_source ENUM('ollama', 'fallback') NOT NULL DEFAULT 'ollama',
  status ENUM('ready', 'generating', 'failed') NOT NULL DEFAULT 'ready',
  error_message VARCHAR(500) NULL,
  requested_by_user_id BIGINT UNSIGNED NULL,
  generated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_match_insights (tenant_id, player_id, match_id),
  KEY idx_player_match_insights_match (tenant_id, match_id),
  CONSTRAINT fk_pmi_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_pmi_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_pmi_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
  CONSTRAINT fk_pmi_requested_by FOREIGN KEY (requested_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
