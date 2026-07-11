-- Migration 023: fecha de baja administrativa del jugador (distinta de rechazo pending)
SET NAMES utf8mb4;

ALTER TABLE players
  ADD COLUMN deactivated_at DATETIME NULL DEFAULT NULL
    COMMENT 'Baja administrativa; NULL si activo o solo rechazo de inscripción'
    AFTER rejection_reason;
