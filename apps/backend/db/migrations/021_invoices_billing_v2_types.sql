-- Migration 021: facturas separadas mensual/anual (modelo v2)

SET NAMES utf8mb4;

SET @db = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'invoice_type');
SET @sql = IF(@col = 0, "ALTER TABLE invoices ADD COLUMN invoice_type ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly' AFTER plan_id", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'billed_player_count');
SET @sql = IF(@col = 0, 'ALTER TABLE invoices ADD COLUMN billed_player_count INT UNSIGNED NULL AFTER amount', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'billed_price_per_player');
SET @sql = IF(@col = 0, 'ALTER TABLE invoices ADD COLUMN billed_price_per_player DECIMAL(10, 2) NULL AFTER billed_player_count', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'billed_annual_fee');
SET @sql = IF(@col = 0, 'ALTER TABLE invoices ADD COLUMN billed_annual_fee DECIMAL(10, 2) NULL AFTER billed_price_per_player', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Reemplazar unique key: ahora incluye invoice_type (permite mensual + anual mismo periodo)
SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'uk_invoices_tenant_period');
SET @sql = IF(@idx > 0, 'ALTER TABLE invoices DROP INDEX uk_invoices_tenant_period', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'uk_invoices_tenant_period_type');
SET @sql = IF(@idx = 0, 'ALTER TABLE invoices ADD UNIQUE KEY uk_invoices_tenant_period_type (tenant_id, period_start, period_end, invoice_type)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
