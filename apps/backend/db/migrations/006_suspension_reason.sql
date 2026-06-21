-- Migration 006: motivo de suspensión de academia (facturación vs manual)

ALTER TABLE academies
  ADD COLUMN suspension_reason ENUM('billing', 'manual') NULL
    COMMENT 'Motivo de suspensión; NULL si la academia no está suspended'
    AFTER status;

UPDATE academies
SET suspension_reason = 'manual'
WHERE status = 'suspended' AND suspension_reason IS NULL;
