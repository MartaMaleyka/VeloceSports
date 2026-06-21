-- Migration 003: planes extendidos, audit_log, seed de planes por defecto (idempotente)

SET NAMES utf8mb4;

SET @db = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'price');
SET @sql = IF(@col = 0, 'ALTER TABLE plans ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER description', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'billing_cycle');
SET @sql = IF(@col = 0, "ALTER TABLE plans ADD COLUMN billing_cycle ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly' AFTER price", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'status');
SET @sql = IF(@col = 0, "ALTER TABLE plans ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER max_matches_per_month", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND INDEX_NAME = 'idx_plans_status');
SET @sql = IF(@idx = 0, 'ALTER TABLE plans ADD KEY idx_plans_status (status)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NULL COMMENT 'NULL para acciones de plataforma',
  user_id BIGINT UNSIGNED NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  `before` JSON NULL,
  `after` JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_tenant (tenant_id),
  KEY idx_audit_entity (entity, entity_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO plans (name, description, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
SELECT 'Básico', 'Para academias pequeñas que inician su operación digital.', 29.00, 'monthly', 50, 3, 5, 20, 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Básico');

INSERT INTO plans (name, description, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
SELECT 'Pro', 'Para academias en crecimiento con más categorías y usuarios.', 79.00, 'monthly', 150, 8, 20, 60, 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Pro');

INSERT INTO plans (name, description, price, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
SELECT 'Elite', 'Operación avanzada con límites amplios para academias consolidadas.', 149.00, 'monthly', 500, 15, 75, 200, 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Elite');
