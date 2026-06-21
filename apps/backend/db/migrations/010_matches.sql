-- Migration 010: partidos operativos + config de periodos en academia
SET NAMES utf8mb4;

ALTER TABLE academies
  ADD COLUMN default_periods_count TINYINT UNSIGNED NOT NULL DEFAULT 2
    COMMENT 'Periodos de juego por defecto (futura captura en vivo)',
  ADD COLUMN default_period_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 45
    COMMENT 'Duración en minutos de cada periodo por defecto';

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  opponent VARCHAR(150) NOT NULL,
  match_datetime DATETIME NOT NULL,
  location VARCHAR(255) NULL,
  match_type ENUM('league', 'friendly', 'tournament') NOT NULL DEFAULT 'friendly',
  status ENUM('scheduled', 'in_progress', 'finished', 'cancelled') NOT NULL DEFAULT 'scheduled',
  notes TEXT NULL,
  periods_count TINYINT UNSIGNED NULL COMMENT 'NULL = hereda default_periods_count de la academia',
  period_duration_minutes SMALLINT UNSIGNED NULL COMMENT 'NULL = hereda default de la academia',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_matches_tenant (tenant_id),
  KEY idx_matches_category (category_id),
  KEY idx_matches_status (status),
  KEY idx_matches_datetime (match_datetime),
  KEY idx_matches_tenant_status_datetime (tenant_id, status, match_datetime),
  CONSTRAINT fk_matches_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_matches_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
