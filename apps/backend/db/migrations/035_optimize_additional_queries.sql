-- Migration 035: índices adicionales para queries críticas de autenticación, búsqueda y autorización

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Users: mejoramos búsquedas por email y role
-- - SELECT * FROM users WHERE email = ?
-- - SELECT * FROM users WHERE tenant_id = ? AND role IN (...)
ALTER TABLE users ADD KEY idx_users_email_status (email, status);
ALTER TABLE users ADD KEY idx_users_tenant_role (tenant_id, role);

-- Player Viewers: índice para queries de parental control y visualización
-- - SELECT * FROM player_viewers WHERE viewer_id = ? AND tenant_id = ?
-- - SELECT * FROM player_viewers WHERE player_id = ? AND tenant_id = ?
ALTER TABLE player_viewers ADD KEY idx_player_viewers_viewer_tenant (viewer_id, tenant_id);

-- Match Attendance: mejoramos búsquedas por match
-- - SELECT * FROM match_attendance WHERE match_id = ? AND tenant_id = ?
-- - Optimize for game action capture queries
ALTER TABLE match_attendance ADD KEY idx_match_attendance_match_tenant (match_id, tenant_id);

-- Game Actions: índice para queries de captura de acciones
-- - SELECT * FROM game_actions WHERE match_id = ? ORDER BY period, time_in_period
-- - SELECT * FROM game_actions WHERE tenant_id = ? AND match_id = ?
ALTER TABLE game_actions ADD KEY idx_game_actions_match_tenant (match_id, tenant_id);
ALTER TABLE game_actions ADD KEY idx_game_actions_player (player_id, match_id);

-- Action Catalog: índice para búsquedas por código
-- - SELECT * FROM action_catalog WHERE tenant_id = ? AND code = ?
ALTER TABLE action_catalog ADD KEY idx_action_catalog_code (code, tenant_id);

-- Parent Notification Preferences: índice para queries de preferencias
-- - SELECT * FROM parent_notification_preferences WHERE user_id = ? AND tenant_id = ?
ALTER TABLE parent_notification_preferences ADD KEY idx_pnp_user_tenant (user_id, tenant_id);

-- Notifications: índices para queries de notificaciones
-- - SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC
-- - SELECT * FROM notifications WHERE user_id = ? AND read = 0
ALTER TABLE notifications ADD KEY idx_notifications_user_created (user_id, created_at DESC);
ALTER TABLE notifications ADD KEY idx_notifications_user_read (user_id, read, created_at DESC);

SET FOREIGN_KEY_CHECKS = 1;
