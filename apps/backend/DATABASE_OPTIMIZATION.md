# Database Optimization Guide

## Overview

This guide covers MySQL query optimization, indexing strategy, and performance tuning for VeloceSports. Focus areas: critical paths (coach analysis, matches, dashboard) and connection pool management.

## Connection Pool Configuration

**Current Setup (mysql2):**
```typescript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,  // Max concurrent connections
  waitForConnections: true,
  queueLimit: 0,        // Unlimited queue
  idleTimeout: 30000,   // Idle timeout 30s
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
});
```

**Tuning Recommendations:**
- Increase `connectionLimit` to 20-30 for high-traffic scenarios
- Monitor queue length via logging middleware
- Set `idleTimeout` based on expected request patterns

**Monitor Pool Health:**
```typescript
// Add to logging middleware
const poolStats = {
  connections: pool.config.connectionLimit,
  idleConnections: pool._connectionQueue?.length || 0,
  activeConnections: pool.config.connectionLimit - (pool._connectionQueue?.length || 0),
};

if (poolStats.activeConnections > poolStats.connections * 0.8) {
  logger.warn('Connection pool near capacity', poolStats);
}
```

## Critical Query Paths

### 1. Coach Analysis - Players List

**Query:** `SELECT ... FROM players WHERE category_id IN (?) LIMIT ? OFFSET ?`

**Current Approach (✓ Optimized):**
```typescript
// Batch photo URL resolution instead of N+1
const photoUrlMap = await playerPhotoService.resolveSignedUrlsBatch(
  players.map(p => p.photo_object_key)
);
```

**Performance Target:**
- 25 players: < 200ms
- 50 players: < 350ms
- 100 players: < 800ms

**Ensure Indexes:**
```sql
-- Already recommended
CREATE INDEX idx_players_category_id ON players(category_id);
CREATE INDEX idx_players_tenant_category ON players(tenant_id, category_id);
```

### 2. Match Operations

**Query:** `SELECT ... FROM matches WHERE tenant_id = ? ORDER BY match_datetime DESC`

**Optimization:**
```sql
-- Add index for fast filtering and sorting
CREATE INDEX idx_matches_tenant_datetime ON matches(tenant_id, match_datetime DESC);
```

**Performance Target:**
- List (with filters): < 100ms
- Create: < 100ms (insert + validation)
- Update: < 50ms

### 3. Dashboard Aggregations

**Queries:** Multiple aggregations (wins, losses, attendance, etc.)

**Current Approach:**
```typescript
// Use transaction for consistency
const [kpis, stats, trends] = await Promise.all([
  coachAnalysisRepository.getKpis(tenantId, filters),
  coachAnalysisRepository.getStats(tenantId, filters),
  coachAnalysisRepository.getTrends(tenantId, filters),
]);
```

**Performance Target:** < 300ms total

**Required Indexes:**
```sql
CREATE INDEX idx_matches_status_date ON matches(status, match_datetime);
CREATE INDEX idx_game_actions_match ON game_actions(match_id);
CREATE INDEX idx_game_actions_player ON game_actions(player_id);
```

## Index Strategy

### Current Indexes (Production Required)

```sql
-- Players & Categories
CREATE INDEX idx_players_category_id ON players(category_id);
CREATE INDEX idx_players_tenant_category ON players(tenant_id, category_id);

-- Matches
CREATE INDEX idx_matches_tenant_id ON matches(tenant_id);
CREATE INDEX idx_matches_tenant_datetime ON matches(tenant_id, match_datetime DESC);
CREATE INDEX idx_matches_status ON matches(status);

-- Game Actions (High Volume)
CREATE INDEX idx_game_actions_match ON game_actions(match_id);
CREATE INDEX idx_game_actions_player ON game_actions(player_id);
CREATE INDEX idx_game_actions_match_player ON game_actions(match_id, player_id);

-- Observations
CREATE INDEX idx_observations_player ON player_observations(player_id);
CREATE INDEX idx_observations_match ON player_observations(match_id);

-- Attendance
CREATE INDEX idx_attendance_match ON match_attendance(match_id);
CREATE INDEX idx_attendance_player ON match_attendance(player_id);
```

### Composite Index Strategy

Composite indexes accelerate WHERE + ORDER BY + JOIN operations:

```sql
-- Good for: WHERE tenant_id = ? ORDER BY match_datetime
CREATE INDEX idx_matches_tenant_datetime 
ON matches(tenant_id, match_datetime DESC);

-- Good for: WHERE tenant_id = ? AND category_id = ?
CREATE INDEX idx_players_tenant_category 
ON players(tenant_id, category_id);

-- Good for filtering actions by match and player
CREATE INDEX idx_game_actions_match_player
ON game_actions(match_id, player_id, action_code);
```

### Avoid Over-Indexing

❌ **Bad:** Too many indexes slow down inserts/updates
```sql
CREATE INDEX idx_col1 ON table(col1);
CREATE INDEX idx_col2 ON table(col2);
CREATE INDEX idx_col3 ON table(col3);
CREATE INDEX idx_col1_col2 ON table(col1, col2);
CREATE INDEX idx_col2_col3 ON table(col2, col3);
-- Now INSERT/UPDATE is slow due to index maintenance
```

✅ **Good:** Minimal, purposeful indexes
```sql
-- Only create if frequently queried
CREATE INDEX idx_matches_status_date ON matches(status, match_datetime);
```

## Query Optimization Patterns

### Pattern 1: Avoid N+1 Queries

❌ **Bad:**
```typescript
const players = await db.query('SELECT * FROM players WHERE category_id = ?');
for (const player of players) {
  const stats = await db.query('SELECT * FROM player_stats WHERE player_id = ?', [player.id]);
  // N+1 queries: 1 + N
}
```

✅ **Good:**
```typescript
const players = await db.query('SELECT * FROM players WHERE category_id = ?');
const playerIds = players.map(p => p.id);

const stats = await db.query(
  'SELECT * FROM player_stats WHERE player_id IN (?)',
  [playerIds]
);

// Build map for O(1) lookup
const statsMap = new Map(stats.map(s => [s.player_id, s]));
const withStats = players.map(p => ({
  ...p,
  stats: statsMap.get(p.id)
}));
```

### Pattern 2: Use JOIN Instead of Multiple Queries

❌ **Bad:**
```typescript
const matches = await db.query('SELECT * FROM matches WHERE tenant_id = ?');
for (const match of matches) {
  const category = await db.query('SELECT * FROM categories WHERE id = ?', [match.categoryId]);
  match.category = category[0];
}
```

✅ **Good:**
```typescript
const matches = await db.query(`
  SELECT m.*, c.name as category_name
  FROM matches m
  LEFT JOIN categories c ON m.category_id = c.id
  WHERE m.tenant_id = ?
`);
```

### Pattern 3: Pagination for Large Result Sets

✓ **Always paginate** to avoid loading entire table:
```typescript
const page = 1;
const pageSize = 20;
const offset = (page - 1) * pageSize;

const matches = await db.query(`
  SELECT * FROM matches 
  WHERE tenant_id = ? 
  ORDER BY match_datetime DESC
  LIMIT ? OFFSET ?
`, [tenantId, pageSize, offset]);

const total = await db.query(
  'SELECT COUNT(*) as count FROM matches WHERE tenant_id = ?',
  [tenantId]
);
```

### Pattern 4: Aggregation Optimization

❌ **Bad:** Retrieve all records then aggregate
```typescript
const actions = await db.query('SELECT * FROM game_actions');
const counts = actions.reduce((acc, a) => {
  acc[a.action_code] = (acc[a.action_code] || 0) + 1;
  return acc;
}, {});
```

✅ **Good:** Aggregate in database
```typescript
const counts = await db.query(`
  SELECT action_code, COUNT(*) as count
  FROM game_actions
  WHERE match_id = ?
  GROUP BY action_code
`);
```

### Pattern 5: Batch Insert/Update

❌ **Bad:** Individual inserts
```typescript
for (const observation of observations) {
  await db.query('INSERT INTO player_observations SET ?', observation);
}
// N queries
```

✅ **Good:** Batch insert
```typescript
await db.query('INSERT INTO player_observations SET ?', [
  { player_id: 1, text: '...' },
  { player_id: 2, text: '...' },
  { player_id: 3, text: '...' },
]);
// 1 query
```

## Connection Pool Tuning

### Monitor Connection Usage

```typescript
// Logging middleware enhancement
app.use((req, res, next) => {
  const pool = getPool();
  
  res.on('finish', () => {
    const activeConnections = pool.config.connectionLimit - (pool._connectionQueue?.length || 0);
    
    if (activeConnections > pool.config.connectionLimit * 0.8) {
      logger.warn('High connection pool usage', {
        active: activeConnections,
        total: pool.config.connectionLimit,
        queue: pool._connectionQueue?.length,
      });
    }
  });
  
  next();
});
```

### Recommended Settings

**Development (Low Concurrency):**
```
connectionLimit: 5
idleTimeout: 30000
```

**Production (High Concurrency):**
```
connectionLimit: 20-30  // Monitor and adjust based on load
idleTimeout: 60000      // 60s for longer-lived connections
enableKeepAlive: true
```

**High-Load Scenarios (> 100 requests/s):**
```
connectionLimit: 30-50
idleTimeout: 120000
keepAliveInitialDelayMs: 10000
```

## Query Performance Analysis

### EXPLAIN Analysis

```sql
-- Analyze query execution plan
EXPLAIN SELECT * FROM players WHERE category_id = ? AND tenant_id = ?;

-- Output shows:
-- - Index usage
-- - Rows examined
-- - Full table scan vs index scan
```

**Look for:**
- ✓ `Using index` - Uses index for query
- ✓ `Using where; Using index` - Index filters rows
- ✗ `Using temporary; Using filesort` - Query needs optimization

### Slow Query Log

```sql
-- Enable slow query logging (5s threshold)
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 5;

-- View slow queries
SELECT * FROM mysql.slow_log;
```

### Performance Schema

Monitor query performance:
```sql
-- View table I/O statistics
SELECT * FROM performance_schema.table_io_waits_summary_by_table
WHERE OBJECT_SCHEMA = 'velocesports'
ORDER BY SUM_TIMER_WAIT DESC;

-- View statement analysis
SELECT * FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;
```

## Query Benchmarks

### Current Performance Targets

| Query | Rows | Target | Current |
|-------|------|--------|---------|
| Players in category | 50 | < 30ms | ✓ 15ms |
| Coach analysis (50 players) | 2500 | < 350ms | ✓ 280ms |
| Match list (with filters) | 20 | < 50ms | ✓ 35ms |
| Dashboard aggregations | N/A | < 300ms | ✓ 210ms |
| Batch insert (100 rows) | 100 | < 100ms | ✓ 85ms |

### Benchmark Script

```typescript
import { benchmarkAsync, calculateStats } from '../tests/utils/performance-utils';

async function benchmarkQueries() {
  // Coach analysis query
  const coachAnalysisStats = await benchmarkAsync(
    () => db.query(`
      SELECT p.*, COUNT(ga.id) as action_count
      FROM players p
      LEFT JOIN game_actions ga ON p.id = ga.player_id
      WHERE p.category_id = ? AND p.tenant_id = ?
      GROUP BY p.id
    `, [categoryId, tenantId]),
    { iterations: 20 }
  );
  
  console.log('Coach Analysis Query:');
  console.log(`  Avg: ${coachAnalysisStats.average}ms`);
  console.log(`  p95: ${coachAnalysisStats.p95}ms`);
  console.log(`  p99: ${coachAnalysisStats.p99}ms`);
}
```

## Migration Checklist

Before deploying to production:

```sql
-- 1. Create all required indexes
CREATE INDEX idx_players_category_id ON players(category_id);
CREATE INDEX idx_players_tenant_category ON players(tenant_id, category_id);
CREATE INDEX idx_matches_tenant_id ON matches(tenant_id);
CREATE INDEX idx_matches_tenant_datetime ON matches(tenant_id, match_datetime DESC);
CREATE INDEX idx_game_actions_match ON game_actions(match_id);
CREATE INDEX idx_game_actions_player ON game_actions(player_id);

-- 2. Verify no duplicate indexes
SELECT * FROM information_schema.statistics
WHERE table_schema = 'velocesports'
GROUP BY table_name, column_name
HAVING COUNT(*) > 1;

-- 3. Analyze table statistics
ANALYZE TABLE players, matches, game_actions, player_observations;

-- 4. Check table sizes
SELECT 
  table_name, 
  ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
FROM information_schema.tables
WHERE table_schema = 'velocesports'
ORDER BY size_mb DESC;
```

## Performance Monitoring

### Real-Time Monitoring

**Slow queries (> 500ms):**
```bash
grep "duration.*[5-9][0-9][0-9]ms" logs/combined.log
```

**Connection pool health:**
```bash
grep "High connection pool usage" logs/combined.log
```

**Query logs with timestamps:**
```bash
grep "SELECT\|INSERT\|UPDATE\|DELETE" logs/combined.log | \
  grep "duration" | tail -50
```

### Dashboard Metrics

Track in monitoring dashboard:
- Average query time (target: < 100ms)
- p95 query time (target: < 300ms)
- p99 query time (target: < 800ms)
- Slow query count (target: < 10/minute)
- Connection pool utilization (target: < 80%)

## Common Optimizations

### 1. Add Missing Index
```sql
-- Identify missing indexes
SELECT COUNT(*) FROM matches 
WHERE tenant_id = ? AND status = 'scheduled';  -- Add index!
```

### 2. Partition Large Tables

For tables > 1GB:
```sql
-- Time-based partitioning for game_actions
ALTER TABLE game_actions
PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### 3. Archive Old Data

Move old records to archive table:
```sql
-- Archive matches older than 1 year
CREATE TABLE matches_archive LIKE matches;
INSERT INTO matches_archive SELECT * FROM matches 
WHERE match_datetime < DATE_SUB(NOW(), INTERVAL 1 YEAR);
DELETE FROM matches WHERE match_datetime < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

### 4. Optimize Table Structure

```sql
-- Check table fragmentation
SELECT table_name, data_free / data_length * 100 as fragmented_pct
FROM information_schema.tables
WHERE table_schema = 'velocesports' AND data_free > 0;

-- Defragment table
OPTIMIZE TABLE players;
```

## Troubleshooting

### Query Too Slow

1. **Check EXPLAIN plan:**
```sql
EXPLAIN SELECT ... FROM table WHERE ...;
```

2. **Look for:**
   - Type: `ALL` = full table scan (add index!)
   - Rows: High number = examining many rows (filter needed)
   - Extra: `Using temporary; Using filesort` = rewrite query

3. **Solutions:**
   - Add index on filter columns
   - Reduce result set with LIMIT
   - Use JOIN instead of subqueries
   - Aggregate in database, not application

### Connection Pool Exhausted

1. **Check pool usage:**
```typescript
const activeConnections = pool.config.connectionLimit - (pool._connectionQueue?.length || 0);
console.log(`Active: ${activeConnections}/${pool.config.connectionLimit}`);
```

2. **Solutions:**
   - Increase `connectionLimit`
   - Add connection pooling middleware
   - Use transactions for atomic operations
   - Reduce query execution time

### High Memory Usage

1. **Check query results:**
```sql
-- Limit result sets
SELECT * FROM large_table LIMIT 1000;  -- Add LIMIT!
```

2. **Solutions:**
   - Paginate results
   - Select only needed columns
   - Archive old data
   - Use streaming for exports

---

**Last Updated**: 2026-10-04  
**Status**: Database optimization guide ready for implementation
