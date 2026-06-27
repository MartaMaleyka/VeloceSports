-- Cronómetro de partido: estado reconstruible desde timestamps (multi-tenant vía matches.tenant_id)
ALTER TABLE matches
  ADD COLUMN clock_current_period TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER finished_at,
  ADD COLUMN clock_elapsed_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER clock_current_period,
  ADD COLUMN clock_running TINYINT(1) NOT NULL DEFAULT 0 AFTER clock_elapsed_seconds,
  ADD COLUMN clock_period_started_at TIMESTAMP NULL DEFAULT NULL AFTER clock_running,
  ADD COLUMN clock_paused_at TIMESTAMP NULL DEFAULT NULL AFTER clock_period_started_at;
