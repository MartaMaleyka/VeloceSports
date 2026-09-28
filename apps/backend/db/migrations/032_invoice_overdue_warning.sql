-- Migration 032: aviso previo y periodo de gracia antes de suspender por impago
SET NAMES utf8mb4;

SET @db = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'overdue_warning_sent_at');
SET @sql = IF(@col = 0,
  'ALTER TABLE invoices ADD COLUMN overdue_warning_sent_at DATETIME NULL COMMENT ''Aviso de impago enviado a la academia'' AFTER paid_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'suspension_scheduled_for');
SET @sql = IF(@col = 0,
  'ALTER TABLE invoices ADD COLUMN suspension_scheduled_for DATETIME NULL COMMENT ''Fecha a partir de la cual se suspende la academia si sigue impaga'' AFTER overdue_warning_sent_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'idx_invoices_suspension_due');
SET @sql = IF(@idx = 0,
  'ALTER TABLE invoices ADD KEY idx_invoices_suspension_due (status, suspension_scheduled_for)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
