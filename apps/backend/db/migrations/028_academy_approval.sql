-- Aprobación de cuentas autorregistradas: un padre independiente o una academia
-- que se registran solos no pueden entrar hasta que un super_admin apruebe la
-- solicitud. Las academias creadas por un super_admin nacen ya aprobadas
-- (default 'approved'), así que no cambia su comportamiento.

SET NAMES utf8mb4;
SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'academies' AND COLUMN_NAME = 'approval_status'
);
SET @sql := IF(
  @col = 0,
  "ALTER TABLE academies ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved' AFTER account_type",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'academies' AND COLUMN_NAME = 'approval_reason'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE academies ADD COLUMN approval_reason VARCHAR(500) NULL AFTER approval_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'academies' AND INDEX_NAME = 'idx_academies_approval_status'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE academies ADD KEY idx_academies_approval_status (approval_status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
