-- Migration 025: fecha de baja administrativa del jugador (distinta de rechazo pending)
-- Idempotente: no falla si la columna ya existe.
-- Numerada 025 para no chocar con 023_must_change_password (remoto).
SET NAMES utf8mb4;
SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND COLUMN_NAME = 'deactivated_at'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE players ADD COLUMN deactivated_at DATETIME NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
