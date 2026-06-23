-- Migration 018: notificaciones in-app para padres (RN-09 / RN-18)
SET NAMES utf8mb4;

ALTER TABLE academies
  ADD COLUMN notifications_enabled TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Toggle global: la academia permite notificaciones a padres';

CREATE TABLE IF NOT EXISTS parent_notification_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Canal in-app activo',
  email_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Canal email (preparado, no MVP)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parent_notif_pref (tenant_id, parent_user_id),
  KEY idx_parent_notif_pref_parent (parent_user_id),
  CONSTRAINT fk_parent_notif_pref_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_notif_pref_parent FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parent_player_notification_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parent_player_notif_pref (tenant_id, parent_user_id, player_id),
  KEY idx_parent_player_notif_player (player_id),
  CONSTRAINT fk_parent_player_notif_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_player_notif_parent FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_parent_player_notif_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  recipient_user_id BIGINT UNSIGNED NOT NULL COMMENT 'Padre destinatario',
  player_id BIGINT UNSIGNED NOT NULL,
  match_id BIGINT UNSIGNED NOT NULL,
  game_action_id BIGINT UNSIGNED NULL COMMENT 'NULL si la acción fue eliminada (deshacer inmediato)',
  type ENUM('game_action') NOT NULL DEFAULT 'game_action',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  payload JSON NULL COMMENT 'Claves i18n + params para render en UI',
  read_at TIMESTAMP NULL,
  voided_at TIMESTAMP NULL COMMENT 'Acción anulada/corregida — queda como histórico matizado',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_action_recipient (tenant_id, game_action_id, recipient_user_id),
  KEY idx_notifications_recipient_unread (tenant_id, recipient_user_id, read_at, created_at),
  KEY idx_notifications_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_notifications_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_game_action FOREIGN KEY (game_action_id) REFERENCES game_actions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
