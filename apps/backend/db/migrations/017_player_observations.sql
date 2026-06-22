-- Observaciones del entrenador sobre jugadores (generales o por partido)

CREATE TABLE IF NOT EXISTS player_observations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  match_id BIGINT UNSIGNED NULL,
  coach_user_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_player_observations_tenant_player (tenant_id, player_id),
  KEY idx_player_observations_tenant_match (tenant_id, match_id),
  KEY idx_player_observations_coach (tenant_id, coach_user_id),
  CONSTRAINT fk_player_observations_tenant FOREIGN KEY (tenant_id) REFERENCES academies (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_observations_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
  CONSTRAINT fk_player_observations_match FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE SET NULL,
  CONSTRAINT fk_player_observations_coach FOREIGN KEY (coach_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
