-- Migration 033: copia a player_viewers los vínculos padre↔jugador que solo existen en
-- parent_players (datos anteriores a la 026 si no se ejecutó el backfill manual).
-- Notificaciones y calendario de familias leen ya de player_viewers. Idempotente.
INSERT INTO player_viewers (tenant_id, player_id, viewer_id, relationship)
SELECT pp.tenant_id, pp.player_id, pp.parent_user_id, 'PARENT'
FROM parent_players pp
ON DUPLICATE KEY UPDATE relationship = relationship;
