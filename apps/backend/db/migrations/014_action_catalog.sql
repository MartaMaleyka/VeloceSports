-- Migration 014: catálogo de acciones por tenant + game_actions (trazabilidad captura)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS action_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code SMALLINT UNSIGNED NOT NULL COMMENT 'Código usado en captura N-M (ej. 13)',
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  impact ENUM('positive', 'negative', 'neutral') NOT NULL,
  notifiable TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_action_catalog_tenant_code (tenant_id, code),
  KEY idx_action_catalog_tenant (tenant_id),
  KEY idx_action_catalog_tenant_status (tenant_id, status),
  CONSTRAINT fk_action_catalog_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  match_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  action_catalog_id BIGINT UNSIGNED NOT NULL,
  action_code SMALLINT UNSIGNED NOT NULL COMMENT 'Denormalizado para captura N-M',
  minute SMALLINT UNSIGNED NOT NULL,
  period TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_game_actions_tenant (tenant_id),
  KEY idx_game_actions_match (match_id),
  KEY idx_game_actions_catalog (action_catalog_id),
  KEY idx_game_actions_tenant_catalog (tenant_id, action_catalog_id),
  CONSTRAINT fk_game_actions_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_game_actions_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
  CONSTRAINT fk_game_actions_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_game_actions_catalog FOREIGN KEY (action_catalog_id) REFERENCES action_catalog (id) ON DELETE RESTRICT,
  CONSTRAINT fk_game_actions_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
