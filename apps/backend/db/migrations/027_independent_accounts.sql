-- Cuentas independientes: padre sin academia que solo captura acciones de su hijo.
-- Agrega academies.account_type y siembra el plan gratuito "Personal" (idempotente).

SET NAMES utf8mb4;
SET @db := DATABASE();

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'academies' AND COLUMN_NAME = 'account_type'
);
SET @sql := IF(
  @col = 0,
  "ALTER TABLE academies ADD COLUMN account_type ENUM('academy', 'personal') NOT NULL DEFAULT 'academy' AFTER status",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'academies' AND INDEX_NAME = 'idx_academies_account_type'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE academies ADD KEY idx_academies_account_type (account_type)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Plan gratuito exclusivo para cuentas personales (no facturable, no seleccionable
-- desde el alta manual de academias reales).
INSERT INTO plans (name, description, price, annual_fee, price_per_player, billing_cycle, max_players, max_categories, max_users, max_matches_per_month, status)
SELECT 'Personal', 'Cuenta individual de un padre sin academia — un solo jugador, gratuita.', 0.00, 0.00, 0.00, 'monthly', 1, 1, 2, 30, 'active'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Personal');
