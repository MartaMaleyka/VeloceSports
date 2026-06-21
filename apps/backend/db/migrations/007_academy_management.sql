-- Migration 007: gestión interna academy_admin (categorías, jugadores, coaches)
SET NAMES utf8mb4;

ALTER TABLE categories
  ADD COLUMN age_min TINYINT UNSIGNED NULL AFTER name,
  ADD COLUMN age_max TINYINT UNSIGNED NULL AFTER age_min;

ALTER TABLE players
  ADD COLUMN date_of_birth DATE NULL AFTER last_name,
  ADD COLUMN position VARCHAR(50) NULL AFTER jersey_number,
  ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER position,
  MODIFY status ENUM('active', 'inactive', 'pending', 'injured', 'retired') NOT NULL DEFAULT 'active';

ALTER TABLE players
  ADD KEY idx_players_category (category_id),
  ADD CONSTRAINT fk_players_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL;

ALTER TABLE coach_categories
  ADD CONSTRAINT fk_coach_categories_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE;

ALTER TABLE parent_players
  ADD CONSTRAINT fk_parent_players_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE;

ALTER TABLE coach_categories
  ADD UNIQUE KEY uq_coach_categories_category_tenant (category_id, tenant_id);
