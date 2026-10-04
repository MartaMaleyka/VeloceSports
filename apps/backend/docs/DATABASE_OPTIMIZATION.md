# Database Optimization Strategy

## Overview
This document outlines the database optimization approach for VeloceSports, focusing on index creation to improve query performance for common access patterns.

## Indexing Philosophy

### Multi-Tenant Pattern
All tables include `tenant_id` as the first column for tenant isolation. Most indexes include `tenant_id` as the leading column to ensure queries are filtered by tenant first.

### Query Optimization Priorities
1. **Dashboard KPI Queries** (Migration 034) - These run frequently and aggregate large datasets
2. **Authentication & Authorization** (Migration 035) - Critical path for every request
3. **Data Retrieval** - Common CRUD operations and filtering

## Migration 034: Dashboard Query Optimization

### Players Table
```sql
ALTER TABLE players ADD KEY idx_players_tenant_status (tenant_id, status);
```
**Usage:**
- `SELECT COUNT(*) FROM players WHERE tenant_id = ? AND status = "active"`
- `SELECT status, COUNT(*) FROM players WHERE tenant_id = ? GROUP BY status`
- Status filtering for player lists

### Matches Table
```sql
ALTER TABLE matches ADD KEY idx_matches_tenant_status (tenant_id, status);
```
**Usage:**
- `SELECT status, COUNT(*) FROM matches WHERE tenant_id = ? GROUP BY status`
- Match status aggregations for dashboard

### Coach Categories
```sql
ALTER TABLE coach_categories ADD KEY idx_coach_categories_category (category_id, coach_user_id);
```
**Usage:**
- `SELECT COUNT(DISTINCT user_id) FROM coach_categories WHERE category_id IN (...)`
- Finding coaches assigned to categories

### Match Attendance
```sql
ALTER TABLE match_attendance ADD KEY idx_match_attendance_player_attended (player_id, attended);
```
**Usage:**
- `LEFT JOIN match_attendance ON player.id = match_attendance.player_id`
- Attendance rate calculations for performance analytics

### Player Viewers
```sql
ALTER TABLE player_viewers ADD KEY idx_player_viewers_tenant_relationship (tenant_id, relationship);
```
**Usage:**
- `SELECT COUNT(DISTINCT player_id) FROM player_viewers WHERE tenant_id = ? AND relationship = 'PARENT'`
- Tracking parent-linked players

### Categories
```sql
ALTER TABLE categories ADD KEY idx_categories_tenant_status (tenant_id, status);
```
**Usage:**
- Consistency with access pattern for category filtering

## Migration 035: General Query Optimization

### Users Table
```sql
ALTER TABLE users ADD KEY idx_users_email_status (email, status);
ALTER TABLE users ADD KEY idx_users_tenant_role (tenant_id, role);
```
**Usage:**
- Authentication: `SELECT * FROM users WHERE email = ? AND status = 'active'`
- RBAC: `SELECT * FROM users WHERE tenant_id = ? AND role IN ('coach', 'academy_admin')`

### Player Viewers
```sql
ALTER TABLE player_viewers ADD KEY idx_player_viewers_viewer_tenant (viewer_id, tenant_id);
```
**Usage:**
- `SELECT * FROM player_viewers WHERE viewer_id = ? AND tenant_id = ?`
- Parent dashboard queries

### Match Attendance
```sql
ALTER TABLE match_attendance ADD KEY idx_match_attendance_match_tenant (match_id, tenant_id);
```
**Usage:**
- Game action capture: `SELECT * FROM match_attendance WHERE match_id = ?`

### Game Actions
```sql
ALTER TABLE game_actions ADD KEY idx_game_actions_match_tenant (match_id, tenant_id);
ALTER TABLE game_actions ADD KEY idx_game_actions_player (player_id, match_id);
```
**Usage:**
- Match replay: `SELECT * FROM game_actions WHERE match_id = ? ORDER BY period, time_in_period`
- Player stats: `SELECT * FROM game_actions WHERE player_id = ?`

### Action Catalog
```sql
ALTER TABLE action_catalog ADD KEY idx_action_catalog_code (code, tenant_id);
```
**Usage:**
- Coach validation: `SELECT * FROM action_catalog WHERE code = ? AND tenant_id = ?`

### Notifications
```sql
ALTER TABLE notifications ADD KEY idx_notifications_user_created (user_id, created_at DESC);
ALTER TABLE notifications ADD KEY idx_notifications_user_read (user_id, read, created_at DESC);
```
**Usage:**
- Notification lists: `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`
- Unread counts: `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0`

## Index Size Considerations

These indexes are added incrementally across two migrations to manage maintenance overhead. The composite indexes are designed to:
- Cover common WHERE clauses
- Support ORDER BY operations
- Use the leftmost prefix principle

## Performance Impact

### Expected Improvements
- Dashboard KPI queries: **50-80% faster** (from table scans to index scans)
- Authentication queries: **30-50% faster**
- Notification queries: **40-70% faster**
- Count aggregations: **60-90% faster**

### Trade-offs
- Slightly increased INSERT/UPDATE time due to index maintenance
- Minimal additional disk space (typically <5% increase)
- Benefits far outweigh costs for read-heavy workloads

## Monitoring

After migrations are applied:
1. Monitor query execution plans with `EXPLAIN`
2. Check `INFORMATION_SCHEMA.STATISTICS` for index usage
3. Use `mysql-slow-log` to identify remaining slow queries
4. Consider periodic `ANALYZE TABLE` for table statistics

## Future Optimization

Potential additional optimizations:
1. **Partitioning** by tenant_id for very large tables (1M+ rows)
2. **Materialized Views** for frequently-computed aggregations
3. **Query Caching** for non-volatile dashboard metrics
4. **Denormalization** of summary tables for KPI dashboards

## References

- [MySQL Composite Index Best Practices](https://dev.mysql.com/doc/refman/8.0/en/multiple-column-indexes.html)
- [Index Selectivity and Cardinality](https://dev.mysql.com/doc/refman/8.0/en/column-indexes.html)
- [Query Optimization Overview](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
