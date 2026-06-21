-- Migration 013: asistencia por partido (RN-07 — solo asistentes reciben acciones)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS match_attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  match_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  attended TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = presente, 0 = ausente',
  lineup ENUM('starter', 'substitute') NULL COMMENT 'Titular o suplente; NULL si ausente o sin rol en cancha',
  match_jersey_number SMALLINT UNSIGNED NULL COMMENT 'Dorsal usado en ESTE partido (no modifica ficha del jugador)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_attendance_match_player (match_id, player_id),
  KEY idx_match_attendance_tenant (tenant_id),
  KEY idx_match_attendance_match (match_id),
  KEY idx_match_attendance_player (player_id),
  CONSTRAINT fk_match_attendance_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_match_attendance_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
  CONSTRAINT fk_match_attendance_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
