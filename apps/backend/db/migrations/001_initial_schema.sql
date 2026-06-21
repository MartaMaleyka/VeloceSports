-- Migration 001: esquema base — tenants, usuarios, planes y tablas puente
-- Ejecutar una sola vez en entorno limpio.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  max_players INT UNSIGNED NOT NULL DEFAULT 100,
  max_categories INT UNSIGNED NOT NULL DEFAULT 10,
  max_users INT UNSIGNED NOT NULL DEFAULT 50,
  max_matches_per_month INT UNSIGNED NOT NULL DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  status ENUM('active', 'suspended', 'inactive') NOT NULL DEFAULT 'active',
  plan_id BIGINT UNSIGNED NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Panama',
  locale VARCHAR(10) NOT NULL DEFAULT 'es-PA',
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  logo_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academies_slug (slug),
  KEY idx_academies_status (status),
  CONSTRAINT fk_academies_plan FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'academy_admin', 'coach', 'parent', 'player') NOT NULL,
  tenant_id BIGINT UNSIGNED NULL COMMENT 'NULL solo para super_admin',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_tenant (tenant_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla puente: entrenador ↔ categorías (category_id se referenciará en fase 2)
CREATE TABLE IF NOT EXISTS coach_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  coach_user_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coach_category (coach_user_id, category_id, tenant_id),
  KEY idx_coach_categories_tenant (tenant_id),
  CONSTRAINT fk_coach_categories_user FOREIGN KEY (coach_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_coach_categories_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla puente: padre ↔ jugadores (player_id se referenciará en fase 2)
CREATE TABLE IF NOT EXISTS parent_players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parent_player (parent_user_id, player_id, tenant_id),
  KEY idx_parent_players_tenant (tenant_id),
  CONSTRAINT fk_parent_players_user FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_players_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
