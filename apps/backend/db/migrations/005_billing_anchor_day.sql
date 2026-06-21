-- Migration 005: día de corte de facturación por academia (ciclo anclado, no mes calendario)

ALTER TABLE academies
  ADD COLUMN billing_anchor_day TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT 'Día del mes (1-31) que ancla el ciclo de facturación mensual'
    AFTER currency;

-- Academias existentes: usar el día de su fecha de alta (clamp 1–31)
UPDATE academies
SET billing_anchor_day = LEAST(GREATEST(DAY(created_at), 1), 31);
