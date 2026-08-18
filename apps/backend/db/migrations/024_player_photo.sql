-- Foto de perfil del jugador (object key en MinIO + auditoría)

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND COLUMN_NAME = 'photo_object_key'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE players ADD COLUMN photo_object_key VARCHAR(500) NULL AFTER rejection_reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND COLUMN_NAME = 'photo_uploaded_at'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE players ADD COLUMN photo_uploaded_at DATETIME NULL AFTER photo_object_key',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND COLUMN_NAME = 'photo_uploaded_by'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE players ADD COLUMN photo_uploaded_by BIGINT UNSIGNED NULL AFTER photo_uploaded_at',
  'ALTER TABLE players MODIFY COLUMN photo_uploaded_by BIGINT UNSIGNED NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'players' AND CONSTRAINT_NAME = 'fk_players_photo_uploaded_by'
);
SET @sql := IF(
  @fk = 0,
  'ALTER TABLE players ADD CONSTRAINT fk_players_photo_uploaded_by FOREIGN KEY (photo_uploaded_by) REFERENCES users (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
