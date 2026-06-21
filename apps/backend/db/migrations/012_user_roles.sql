-- Migration 012: roles múltiples por usuario (N:M) — convive con users.role (legacy)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('super_admin', 'academy_admin', 'coach', 'parent', 'player') NOT NULL,
  tenant_id BIGINT UNSIGNED NULL COMMENT 'NULL solo para super_admin',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role),
  KEY idx_user_roles_tenant (tenant_id),
  KEY idx_user_roles_role (role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Copia el rol legacy de cada usuario a user_roles (idempotente)
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT id, role, tenant_id
FROM users
ON DUPLICATE KEY UPDATE
  tenant_id = VALUES(tenant_id),
  updated_at = CURRENT_TIMESTAMP;
