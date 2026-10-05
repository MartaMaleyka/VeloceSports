# Performance Monitoring & Testing Guide

## Overview

This guide covers performance monitoring, benchmarking, and optimization strategies for VeloceSports backend.

## Performance Monitoring

### Request Duration Tracking

All HTTP requests are automatically tracked through the `requestLoggingMiddleware`:

```
2026-10-04 14:32:15 [info] GET /api/matches → 200 {
  "method": "GET",
  "path": "/api/matches",
  "statusCode": 200,
  "duration": "45ms",
  "ip": "127.0.0.1"
}
```

### Identifying Slow Requests

Query logs for requests exceeding threshold:

```bash
# Find requests slower than 500ms
grep -E "duration.*[5-9][0-9]{2,}ms" logs/combined.log

# Find P95 slowest requests
grep "duration" logs/combined.log | \
  sed 's/.*duration": "\([0-9]*\)ms.*/\1/' | \
  sort -n | tail -20
```

### Performance Metrics to Monitor

| Metric | Target | Critical |
|--------|--------|----------|
| **API Response Time** | < 200ms p95 | > 1000ms |
| **Database Query** | < 50ms p95 | > 500ms |
| **Coach Analysis (50 players)** | < 500ms | > 2000ms |
| **File Upload** | < 2s | > 5s |
| **Batch Operations** | < 3s per 100 | > 10s per 100 |

## Performance Testing

### Unit Test Performance Assertions

```typescript
import { measurePerformance } from '../utils/performance.test-utils';

describe('PlayerService', () => {
  it('should fetch players within performance budget', async () => {
    const result = await measurePerformance(async () => {
      return await playerService.findByCategory(categoryId);
    });

    expect(result.duration).toBeLessThan(100); // milliseconds
    expect(result.value).toHaveLength(50);
  });
});
```

### Integration Test with Bulk Operations

```typescript
it('should bulk create 100 players within budget', async () => {
  const players = Array.from({ length: 100 }, (_, i) => ({
    firstName: `Player${i}`,
    lastName: `Test`,
    jerseyNumber: i + 1,
    categoryId: testCategory.id,
  }));

  const result = await measurePerformance(async () => {
    return await bulkCreateService.createPlayers(players);
  }, { maxDuration: 3000 }); // 3 seconds max

  expect(result.duration).toBeLessThan(3000);
});
```

### Query Performance Analysis

Enable query logging to identify slow queries:

```bash
# Set environment variable
LOG_LEVEL=debug npm run dev

# Monitor MySQL slow queries
tail -f logs/combined.log | grep "duration.*[0-9][0-9][0-9]ms"
```

## Benchmarking Critical Paths

### Coach Analysis Performance

The coach analysis endpoint is a critical path with potential N+1 queries:

```typescript
describe('CoachAnalysisService - Performance', () => {
  it('should analyze 50 players within 500ms', async () => {
    const players = await createTestPlayers(50);
    const actions = await createTestActions(100);

    const result = await measurePerformance(async () => {
      return await coachAnalysisService.listPlayers(actor, query);
    });

    expect(result.duration).toBeLessThan(500);
    logPerformance('coach-analysis-50-players', result);
  });

  it('should analyze 100 players within 800ms', async () => {
    const players = await createTestPlayers(100);
    const actions = await createTestActions(200);

    const result = await measurePerformance(async () => {
      return await coachAnalysisService.listPlayers(actor, query);
    });

    expect(result.duration).toBeLessThan(800);
    logPerformance('coach-analysis-100-players', result);
  });
});
```

### Database Connection Pooling

Monitor pool usage:

```typescript
describe('Database Connection Pool', () => {
  it('should maintain connection pool under load', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        measurePerformance(async () => {
          return await playerRepository.findAll();
        })
      )
    );

    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const maxDuration = Math.max(...results.map(r => r.duration));

    console.log(`Avg: ${avgDuration}ms, Max: ${maxDuration}ms`);
    expect(maxDuration).toBeLessThan(500);
  });
});
```

## Load Testing

### Using Artillery for Load Testing

1. **Install Artillery**:

```bash
npm install -D artillery
```

2. **Create load test configuration** (`load-test.yml`):

```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 30
      arrivalRate: 10
      name: "Warm up"
    - duration: 60
      arrivalRate: 50
      name: "Ramp up"
    - duration: 30
      arrivalRate: 100
      name: "Spike"

scenarios:
  - name: "Match Operations"
    flow:
      - get:
          url: "/api/matches"
      - post:
          url: "/api/matches"
          json:
            categoryId: 1
            opponent: "Test Team"
            matchDatetime: "{{ $timestamp }}"

  - name: "Coach Analysis"
    flow:
      - get:
          url: "/api/coach-analysis/players"
          queryStringParams:
            categoryId: 1
```

3. **Run load test**:

```bash
artillery run load-test.yml
```

### Expected Results

```
Summary report @ 17:32:15(+0000)
  Scenarios launched:  5400
  Scenarios completed: 5400
  Requests completed:  5400
  Mean response time:  245ms
  Median response time: 180ms
  p95 response time:   580ms
  p99 response time:   1200ms
  Scenarios with errors: 2
```

## Profiling & Optimization

### Node.js Profiling

```bash
# Generate CPU profile
node --prof --prof-process dist/index.js

# Isolate module
npm install -D clinicjs
clinic doctor -- node dist/index.js
clinic flame -- node dist/index.js
```

### Database Query Optimization

```sql
-- Identify slow queries
SELECT * FROM information_schema.PROFILING
WHERE Query_ID = <id>
ORDER BY SEQ ASC;

-- Analyze query execution
EXPLAIN SELECT * FROM players WHERE category_id = ? AND tenantId = ?;

-- Check for missing indexes
SELECT * FROM performance_schema.file_summary_by_event_name
WHERE COUNT_READ > 1000 OR COUNT_WRITE > 1000;
```

### Connection Pool Monitoring

```typescript
import { getPool } from './config/db';

// Monitor pool statistics
setInterval(() => {
  const pool = getPool();
  console.log({
    connectionLimit: pool.config.connectionLimit,
    queueLength: pool._connectionQueue?.length,
    acquiredConnections: pool.config.connectionLimit - (pool._connectionQueue?.length || 0),
  });
}, 10000);
```

## Optimization Strategies

### 1. Database Query Optimization

- ✓ **Batch queries**: Use `IN ()` clauses instead of N+1
- ✓ **Pagination**: Limit result sets with LIMIT/OFFSET
- ✓ **Indexing**: Add indexes on frequently filtered columns
- ✓ **Connection pooling**: Reuse connections (already configured)

### 2. Caching

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getCategory(id: number) {
  const cached = cache.get(`category:${id}`);
  if (cached) return cached;

  const category = await db.findCategory(id);
  cache.set(`category:${id}`, category);
  return category;
}
```

### 3. Async Processing

For heavy operations, offload to job queue:

```typescript
import Bull from 'bull';

const photoProcessingQueue = new Bull('photo-processing');

photoProcessingQueue.process(async (job) => {
  const { photoId } = job.data;
  await processPhotoOptimization(photoId);
});

// Queue job
await photoProcessingQueue.add(
  { photoId: 123 },
  { delay: 1000, attempts: 3 }
);
```

### 4. Response Compression

Already configured via Helmet:

```typescript
app.use(helmet.compression()); // Gzip responses > 1KB
```

### 5. Lazy Loading

Load related data only when needed:

```typescript
async getPlayer(id: number) {
  const player = await db.findPlayer(id);
  // Don't load stats, photos, history unless requested
  return player;
}

async getPlayerWithStats(id: number) {
  const player = await db.findPlayer(id);
  const stats = await db.findPlayerStats(id); // Explicit load
  return { ...player, stats };
}
```

## Performance Budgets

### API Endpoint Budgets

| Endpoint | Budget | Rationale |
|----------|--------|-----------|
| GET /api/matches | 150ms | Filtered list with pagination |
| GET /api/matches/:id | 80ms | Single record fetch |
| POST /api/matches | 200ms | Validation + insert |
| GET /api/coach-analysis/players | 500ms | Complex aggregations |
| POST /api/players/:id/observations | 100ms | Simple insert |
| GET /api/dashboard | 300ms | Multiple aggregations |

### Monitoring Budget Compliance

```typescript
// Auto-warn if endpoint exceeds budget
app.use((req, res, next) => {
  const start = Date.now();
  const budget = ENDPOINT_BUDGETS[req.path] || 200;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > budget) {
      logger.warn(`Endpoint exceeded performance budget`, {
        path: req.path,
        duration,
        budget,
        correlationId: req.correlationId,
      });
    }
  });

  next();
});
```

## Monitoring in Production

### Key Metrics Dashboard

Create a dashboard showing:

- **Average API response time** (target: < 200ms)
- **p95 response time** (target: < 500ms)
- **p99 response time** (target: < 1000ms)
- **Error rate** (target: < 0.1%)
- **Database connection pool** utilization
- **Slow query count** (queries > 500ms)

### Alert Conditions

- Response time p95 > 500ms
- Error rate > 1%
- Database connection pool > 80% utilized
- Slow queries > 10 per minute
- Memory usage > 80% of limit

## Testing Performance Regressions

### Baseline Metrics

Run baseline on main branch:

```bash
npm run test:perf -- --save baseline
```

### Compare Against Baseline

```bash
npm run test:perf -- --compare baseline
```

This will show:

```
Performance Comparison

✓ Coach analysis 50 players: 120ms (was 125ms) -4.0%
✗ Player list query: 95ms (was 85ms) +11.8% [REGRESSION]
✓ Match creation: 175ms (was 180ms) -2.8%
```

## Best Practices

### 1. Measure What Matters

Focus on:
- User-facing latency (response time)
- Critical business operations (coach analysis, payments)
- System health (connection pool, memory)

### 2. Set Realistic Budgets

- Network latency is not in your control (~50ms)
- Database latency varies with load
- Set budgets based on actual usage patterns

### 3. Test Early & Often

- Run performance tests in CI/CD
- Catch regressions before merge
- Maintain performance history

### 4. Document Performance Decisions

```typescript
// PERF: Batch photo URL generation instead of N+1 queries
// This reduces coach analysis from 3s to 500ms with 50 players
const photoUrlMap = await playerPhotoService.resolveSignedUrlsBatch(
  players.map(p => p.photo_object_key)
);
```

### 5. Profile Before Optimizing

Don't guess:

```bash
# Generate flame graph
clinic flame -- npm run dev

# Measure database queries
LOG_LEVEL=debug npm run dev | grep "duration"
```

---

**Last Updated**: 2026-10-04  
**Status**: Performance monitoring infrastructure ready
