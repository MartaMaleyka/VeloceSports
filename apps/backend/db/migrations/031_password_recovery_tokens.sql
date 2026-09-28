-- Migration 031: recuperación de contraseña por email (autoservicio)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS password_recovery_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex del token enviado por email — nunca en claro',
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  requested_ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_recovery_token_hash (token_hash),
  KEY idx_password_recovery_user (user_id, used_at),
  KEY idx_password_recovery_expires (expires_at),
  CONSTRAINT fk_password_recovery_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
