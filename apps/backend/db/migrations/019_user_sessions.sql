-- Migration 019: sesiones server-side (refresh token hasheado)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NULL COMMENT 'NULL para super_admin, alineado con users.tenant_id',
  refresh_token_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt del refresh JWT — nunca en claro',
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_user_sessions_user (user_id),
  KEY idx_user_sessions_user_active (user_id, revoked_at, expires_at),
  KEY idx_user_sessions_expires (expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
