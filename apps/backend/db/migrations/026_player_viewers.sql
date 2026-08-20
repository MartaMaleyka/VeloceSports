-- Migration 026: player_viewers + requires_guardian + players.user_id (ADITIVA)
-- No drops. Idempotente donde aplica.
-- Collation alineada con el resto del esquema (Paso A): utf8mb4_unicode_ci
SET NAMES utf8mb4;
SET @db := DATABASE();

-- 1) Tabla player_viewers (fuente de verdad de vínculos viewer↔jugador)
CREATE TABLE IF NOT EXISTS player_viewers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  viewer_id BIGINT UNSIGNED NOT NULL,
  relationship ENUM('PARENT', 'SELF', 'GUARDIAN', 'MANAGER') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_viewers_link (tenant_id, player_id, viewer_id, relationship),
  KEY idx_player_viewers_viewer (tenant_id, viewer_id),
  KEY idx_player_viewers_player (tenant_id, player_id),
  CONSTRAINT fk_player_viewers_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_viewers_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_viewers_viewer FOREIGN KEY (viewer_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) categories.requires_guardian (NULL = derivar de age_max)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'requires_guardian'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE categories ADD COLUMN requires_guardian TINYINT(1) NULL DEFAULT NULL AFTER age_max',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) players.user_id (login del jugador adulto; SET NULL al borrar user)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE players ADD COLUMN user_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER tenant_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND INDEX_NAME = 'idx_players_user'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE players ADD KEY idx_players_user (user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND CONSTRAINT_NAME = 'fk_players_user'
);
SET @sql := IF(
  @fk = 0,
  'ALTER TABLE players ADD CONSTRAINT fk_players_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
