-- Migration 034: índices para optimizar queries del dashboard
-- Cubre búsquedas de estado, conteos por tenant y joins en match_attendance

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Players: agregamos índice compuesto (tenant_id, status) para:
-- - SELECT COUNT(*) FROM players WHERE tenant_id = ? AND status = "active"
-- - SELECT status, COUNT(*) FROM players WHERE tenant_id = ? GROUP BY status
-- - SELECT * FROM players WHERE tenant_id = ? AND status = "active"
ALTER TABLE players ADD KEY idx_players_tenant_status (tenant_id, status);

-- Matches: agregamos índice compuesto (tenant_id, status) para:
-- - SELECT status, COUNT(*) FROM matches WHERE tenant_id = ? GROUP BY status
-- - SELECT COUNT(*) FROM matches WHERE tenant_id = ?
-- Nota: ya existe idx_matches_tenant_status_datetime pero este es más específico para conteos
ALTER TABLE matches ADD KEY idx_matches_tenant_status (tenant_id, status);

-- Coach Categories: agregamos índice (category_id, coach_user_id) para:
-- - SELECT COUNT(DISTINCT user_id) FROM coach_categories WHERE category_id IN (...)
-- - Búsquedas de entrenadores por categoría
ALTER TABLE coach_categories ADD KEY idx_coach_categories_category (category_id, coach_user_id);

-- Match Attendance: agregamos índice (player_id, attended) para:
-- - LEFT JOIN match_attendance ma ON p.id = ma.player_id en consultas de asistencia
-- - Cálculos de attendance_rate por jugador
ALTER TABLE match_attendance ADD KEY idx_match_attendance_player_attended (player_id, attended);

-- Player Viewers: agregamos índice (tenant_id, relationship) para:
-- - SELECT COUNT(DISTINCT player_id) FROM player_viewers WHERE tenant_id = ? AND relationship = 'PARENT'
-- - Búsquedas de jugadores vinculados a padres
ALTER TABLE player_viewers ADD KEY idx_player_viewers_tenant_relationship (tenant_id, relationship);

-- Categories: agregamos índice (tenant_id, status) para ser consistentes con pattern
-- aunque actualmente no se usa en queries críticas
ALTER TABLE categories ADD KEY idx_categories_tenant_status (tenant_id, status);

SET FOREIGN_KEY_CHECKS = 1;
