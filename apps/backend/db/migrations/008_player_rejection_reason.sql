-- Migration 008: motivo de rechazo en inscripciones de jugadores
SET NAMES utf8mb4;

ALTER TABLE players
  ADD COLUMN rejection_reason VARCHAR(500) NULL AFTER status;
