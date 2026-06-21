-- Migration 009: nombres en perfil de usuario
SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL AFTER email,
  ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name;
