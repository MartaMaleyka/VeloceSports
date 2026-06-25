-- Migration 020: modelo de cobro v2 — anualidad del plan + mensualidad por jugador activo

SET NAMES utf8mb4;

SET @db = DATABASE();

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'annual_fee');
SET @sql = IF(@col = 0, 'ALTER TABLE plans ADD COLUMN annual_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER description', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'price_per_player');
SET @sql = IF(@col = 0, 'ALTER TABLE plans ADD COLUMN price_per_player DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER annual_fee', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Migración desde price/billing_cycle legacy (planes custom sin nombre conocido)
UPDATE plans
SET
  annual_fee = CASE
    WHEN billing_cycle = 'yearly' THEN price
    ELSE ROUND(price * 10, 2)
  END,
  price_per_player = CASE
    WHEN price_per_player > 0 THEN price_per_player
    WHEN max_players <= 50 THEN 4.00
    WHEN max_players <= 150 THEN 3.50
    ELSE 2.75
  END
WHERE annual_fee = 0 OR annual_fee IS NULL;

-- Planes por defecto — valores comerciales editables (USD, Panamá/Latam)
UPDATE plans SET annual_fee = 299.00, price_per_player = 4.00, price = 29.00, billing_cycle = 'monthly'
WHERE name = 'Básico';

UPDATE plans SET annual_fee = 790.00, price_per_player = 3.50, price = 79.00, billing_cycle = 'monthly'
WHERE name = 'Pro';

UPDATE plans SET annual_fee = 1490.00, price_per_player = 2.75, price = 149.00, billing_cycle = 'monthly'
WHERE name = 'Elite';
