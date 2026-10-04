# Backend Performance Optimization Guide

## Current State Analysis

**Framework:** Express.js with TypeScript
**Database:** MySQL 8.0
**Runtime:** Node.js 20+
**Response Format:** JSON

## Performance Optimization Areas

### 1. Query Optimization (COMPLETED in Sprint 3.3)

**Status:** ✅ Indexes added via migrations 034-035
- Composite indexes on (tenant_id, status) for fast filtering
- Coverage indexes for common WHERE clauses
- Expected improvement: 50-90% for dashboard queries

**Monitoring:**
```sql
-- Check index usage
SELECT * FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = 'database_name' 
AND SEQ_IN_INDEX = 1;

-- Check query execution plans
EXPLAIN SELECT ... \G
```

### 2. Connection Pooling Optimization

**Current Setup:** mysql2/promise with default pool
- Pool size: Check `getPool()` configuration

**Recommendations:**
```typescript
// Verify pool configuration in config/db.ts
const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,        // Adjust based on load
  queueLimit: 0,              // Unlimited queue
  enableKeepAlive: true,      // Prevent connection timeout
  keepAliveInitialDelayMs: 0, // Start immediately
});
```

**Impact:** 15-25% faster query execution under load

### 3. Caching Strategies

#### 3.1 In-Memory Caching
```typescript
// Implement for frequently accessed, rarely-changing data
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10 min default

// Cache academy data
async getDashboard(tenantId: number) {
  const cacheKey = `dashboard:${tenantId}`;
  let data = cache.get(cacheKey);
  
  if (!data) {
    data = await this.service.getDashboard(tenantId);
    cache.set(cacheKey, data, 300); // 5 min TTL
  }
  
  return data;
}
```

**Items to cache (TTL):**
- Academy metadata (1 hour)
- Category list (30 minutes)
- User roles/permissions (1 hour)
- KPI dashboard data (5 minutes)
- Action catalog (1 hour)

**Expected savings:** 40-60% reduction in database queries during peak load

#### 3.2 Response Caching (HTTP)
```typescript
// Cache GET endpoints in Express
app.get('/api/tenant/dashboard', 
  authenticate,
  cache('5 minutes'),
  (req, res) => {
    // Serve from cache if available
  }
);
```

**Impact:** 70-80% reduction in API calls for repeated requests

### 4. Database Connection Optimization

#### 4.1 Query Batching
```typescript
// Instead of N queries:
for (const userId of userIds) {
  const user = await getUserById(userId);
}

// Use batched query:
const users = await getUsersByIds(userIds);
```

**Expected savings:** 80-90% reduction in round trips

#### 4.2 Connection Pooling
Ensure MySQL connection pool is properly configured:
```typescript
// Add to db.ts
pool.on('acquire', (connection) => {
  console.log(`Connection acquired: ${connection.threadId}`);
});

pool.on('connection', (connection) => {
  connection.query(`SET SESSION sql_mode='STRICT_TRANS_TABLES'`);
});
```

### 5. API Response Optimization

#### 5.1 Field Selection
```typescript
// Instead of SELECT *
const query = `
  SELECT id, name, status, created_at
  FROM players
  WHERE tenant_id = ?
`;
```

**Impact:** 20-30% smaller payloads

#### 5.2 Pagination
Always paginate large result sets:
```typescript
async getPlayers(
  tenantId: number,
  page: number = 1,
  limit: number = 50
) {
  const offset = (page - 1) * limit;
  // Apply LIMIT ? OFFSET ?
}
```

#### 5.3 Compression
```typescript
import compression from 'compression';
app.use(compression()); // gzip responses
```

**Impact:** 60-80% reduction in transfer size

### 6. Request/Response Pipeline Optimization

#### 6.1 Middleware Ordering
Critical path first:
```typescript
// Fast first
app.use(helmet());
app.use(cors());
app.use(compression());

// Authentication next
app.use(authenticate);

// Heavy operations last
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);
```

#### 6.2 Early Returns
```typescript
// Fail fast pattern
if (!tenantId) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// Avoid unnecessary database queries
if (cache.has(key)) {
  return res.json(cache.get(key));
}

// Then do expensive operations
const data = await fetchFromDatabase();
```

### 7. Async/Concurrent Operations

#### 7.1 Parallel Queries
```typescript
// Use Promise.all for independent queries
const [players, coaches, categories] = await Promise.all([
  getPlayers(tenantId),
  getCoaches(tenantId),
  getCategories(tenantId),
]);
```

**Expected impact:** 3x faster for independent operations

#### 7.2 Stream Large Responses
```typescript
// For very large datasets
app.get('/api/export/players', (req, res) => {
  const stream = createReadStream('large_data.json');
  stream.pipe(res);
});
```

### 8. Code Optimization

#### 8.1 Bundle Size Analysis
```bash
# Check Node build size
npm install --save-dev webpack-bundle-analyzer
npm run build -- --analyze
```

#### 8.2 Lazy Loading
```typescript
// Defer non-critical imports
const heavy = await import('./heavy-module.js');
```

#### 8.3 Object Pool Pattern
```typescript
// For frequently created/destroyed objects
class ObjectPool {
  private pool: Array<ExpensiveObject> = [];
  
  acquire(): ExpensiveObject {
    return this.pool.pop() || new ExpensiveObject();
  }
  
  release(obj: ExpensiveObject): void {
    obj.reset();
    this.pool.push(obj);
  }
}
```

## Performance Monitoring

### 1. Slow Query Log
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1; -- Queries > 1 second
```

### 2. Application Metrics
```typescript
// Add to Express middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, { duration });
  });
  
  next();
});
```

### 3. Resource Monitoring
- Memory usage: `process.memoryUsage()`
- Event loop lag: Use 0x profiler
- CPU usage: Monitor with system tools

## Performance Targets

### Latency
- **API Response:** < 100ms (p95)
- **Database Query:** < 50ms (p95)
- **Slow Query Alert:** > 500ms

### Throughput
- **Concurrent Users:** 1000+
- **Requests Per Second:** 500+
- **Database Connections:** < 100 active

### Resource Usage
- **Memory:** < 500 MB steady state
- **CPU:** < 50% average
- **Disk I/O:** < 10 MB/s

## Implementation Priority

### Phase 1 (Immediate) - Low Effort, High Impact
- [ ] Verify connection pool configuration
- [ ] Add node-cache for dashboard metrics
- [ ] Implement response compression
- [ ] Add slow query logging

### Phase 2 (Short-term) - Medium Effort, Medium Impact
- [ ] Implement pagination for large datasets
- [ ] Add caching headers to HTTP responses
- [ ] Optimize SELECT queries to use only needed fields
- [ ] Profile and optimize hot paths

### Phase 3 (Long-term) - Higher Effort
- [ ] Implement Redis caching layer
- [ ] Add API request deduplication
- [ ] Optimize database schema further
- [ ] Implement request batching for client

## Expected Performance Gains

After all optimizations:
- **API Response Time:** 30-40% faster
- **Database Query Time:** 50-70% faster (with indexes)
- **Memory Usage:** 20-30% more efficient
- **Concurrent Capacity:** 2-3x improvement
- **Transfer Size:** 60-80% reduction with compression

## Tools

1. **Clinic.js** - Diagnose Node.js performance issues
2. **0x** - Profiler for real-time CPU analysis
3. **Artillery** - Load testing tool
4. **New Relic / DataDog** - Application monitoring

## References

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/nodejs-performance/)
- [MySQL Query Optimization](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Express.js Performance Tips](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Caching Strategies](https://www.cloudflare.com/learning/cdn/what-is-caching/)
