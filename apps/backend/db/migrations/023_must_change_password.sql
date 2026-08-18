-- Reset de contraseña por administrador: flag obligatorio + auditoría
-- Idempotente ante reintentos parciales.

SET @db := DATABASE();

-- must_change_password
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- password_reset_at
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_at'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE users ADD COLUMN password_reset_at DATETIME NULL AFTER must_change_password',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- password_reset_by (UNSIGNED para coincidir con users.id)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_reset_by'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE users ADD COLUMN password_reset_by BIGINT UNSIGNED NULL AFTER password_reset_at',
  'ALTER TABLE users MODIFY COLUMN password_reset_by BIGINT UNSIGNED NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- FK
SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_password_reset_by'
);
SET @sql := IF(
  @fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_password_reset_by FOREIGN KEY (password_reset_by) REFERENCES users (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index
SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_must_change_password'
);
SET @sql := IF(
  @idx = 0,
  'CREATE INDEX idx_users_must_change_password ON users (must_change_password)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
