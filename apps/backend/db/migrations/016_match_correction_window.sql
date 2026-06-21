-- Migration 016: ventana de corrección post-partido + flag added_post_match
SET NAMES utf8mb4;

ALTER TABLE matches
  ADD COLUMN finished_at TIMESTAMP NULL COMMENT 'Momento UTC en que pasó a finished' AFTER status;

UPDATE matches
SET finished_at = updated_at
WHERE status = 'finished' AND finished_at IS NULL;

ALTER TABLE game_actions
  ADD COLUMN added_post_match TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = agregada en corrección post-partido, no captura en vivo'
    AFTER client_action_id;
