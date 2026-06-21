-- Migration 011: datos de contacto de academia (config academy_admin)
SET NAMES utf8mb4;

ALTER TABLE academies
  ADD COLUMN contact_email VARCHAR(255) NULL COMMENT 'Email de contacto público de la academia',
  ADD COLUMN contact_phone VARCHAR(30) NULL COMMENT 'Teléfono de contacto',
  ADD COLUMN address VARCHAR(500) NULL COMMENT 'Dirección física o sede';
