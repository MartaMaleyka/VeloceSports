# Monitoring & Alerting Guide

## Overview

Complete monitoring and alerting strategy for VeloceSports covering application metrics, infrastructure monitoring, error tracking, performance monitoring, and proactive alerting.

## Monitoring Architecture

```
Applications          Metrics & Logs          Aggregation          Dashboards & Alerts
  ├─ Backend          CloudWatch              CloudWatch Logs       CloudWatch Dashboard
  ├─ Frontend         Sentry                  Insights              Grafana
  └─ Database         Application Metrics    Time-series DB        PagerDuty
         ↓                    ↓                    ↓                    ↓
    Instrumentation      Collection          Storage & Index    Visualization & Action
```

## Application Instrumentation

### Backend Metrics

**File**: `apps/backend/src/utils/metrics.ts`

```typescript
import { performance } from 'perf_hooks';

export interface Metric {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: Date;
}

class MetricsCollector {
  private metrics: Metric[] = [];

  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags: Record<string, string> = {}
  ): void {
    this.metrics.push({
      name,
      value,
      unit,
      tags,
      timestamp: new Date(),
    });
  }

  recordDuration(name: string, fn: () => Promise<void>, tags: Record<string, string> = {}): Promise<void> {
    const start = performance.now();
    return fn().finally(() => {
      const duration = performance.now() - start;
      this.recordMetric(name, duration, 'ms', tags);
    });
  }

  getMetrics(): Metric[] {
    return this.metrics;
  }

  flush(): void {
    // Send metrics to CloudWatch
    this.metrics.forEach(metric => {
      sendToCloudWatch(metric);
    });
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

// Usage
await metricsCollector.recordDuration(
  'coach-analysis-duration',
  async () => {
    await coachAnalysisService.listPlayers(actor, query);
  },
  { categoryId: '1', playerCount: '50' }
);
```

### Express Middleware for Metrics

```typescript
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusFamily = Math.floor(res.statusCode / 100) * 100;

    metricsCollector.recordMetric('http_request_duration', duration, 'ms', {
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
      statusFamily: `${statusFamily}xx`,
    });

    if (duration > 500) {
      metricsCollector.recordMetric('slow_request', 1, 'count', {
        method: req.method,
        path: req.path,
      });
    }
  });

  next();
}
```

### Database Query Metrics

```typescript
export async function queryWithMetrics<T>(
  name: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - start;

    metricsCollector.recordMetric('db_query_duration', duration, 'ms', {
      query: name,
      status: 'success',
      ...tags,
    });

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    metricsCollector.recordMetric('db_query_duration', duration, 'ms', {
      query: name,
      status: 'error',
      ...tags,
    });

    throw error;
  }
}

// Usage
const players = await queryWithMetrics(
  'select-players-by-category',
  () => playerRepository.findByCategory(categoryId),
  { categoryId }
);
```

## Error Tracking

### Sentry Integration

**Setup**:
```bash
npm install @sentry/node
```

**Configuration** (`apps/backend/src/utils/sentry.ts`):

```typescript
import * as Sentry from '@sentry/node';

export function initializeSentry(): void {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({
        request: true,
        serverName: true,
        transaction: true,
      }),
    ],
  });
}

export function captureException(error: Error, context: Record<string, any> = {}): void {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      environment: process.env.NODE_ENV,
    },
  });
}

export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
  Sentry.captureMessage(message, level);
}
```

**Express Integration**:

```typescript
import { initializeSentry, captureException } from './utils/sentry';

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

initializeSentry();

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  captureException(error, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    correlationId: req.correlationId,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An error occurred',
      sentryId: Sentry.lastEventId(),
    },
  });
});

app.use(Sentry.Handlers.errorHandler());
```

### Frontend Error Tracking

**Setup** (`apps/web/src/utils/sentry.ts`):

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initializeSentry(): void {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Wrap root component
export const SentryRoutes = Sentry.withSentryRouting(Routes);
```

## Key Metrics

### Response Time Metrics

```typescript
interface ResponseTimeMetrics {
  endpoint: string;
  p50: number;   // 50th percentile
  p95: number;   // 95th percentile
  p99: number;   // 99th percentile
  errors: number;
  requests: number;
}

// Target SLAs
const SLA_TARGETS = {
  '/api/matches': { p95: 150, p99: 200 },
  '/api/players': { p95: 100, p99: 150 },
  '/api/coach-analysis/players': { p95: 500, p99: 800 },
  '/api/coach-analysis/dashboard': { p95: 300, p99: 500 },
};
```

### Business Metrics

```typescript
interface BusinessMetrics {
  activeUsers: number;
  matchesCreated: number;
  playersAdded: number;
  coachAnalysisRequests: number;
  observationsRecorded: number;
  averageSessionDuration: number;
  userRetention: number; // %
}
```

### Infrastructure Metrics

```typescript
interface InfrastructureMetrics {
  cpuUtilization: number;    // %
  memoryUtilization: number; // %
  diskUtilization: number;   // %
  networkBandwidth: number;  // MB/s
  databaseConnections: number;
  cacheHitRate: number;      // %
  errorRate: number;         // %
}
```

## CloudWatch Dashboards

### Main Dashboard

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["VeloceSports/Backend", "http_request_duration", { "stat": "Average" }],
          [".", ".", { "stat": "p95" }],
          [".", ".", { "stat": "p99" }]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "API Response Time"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", { "dimensions": { "ServiceName": "backend" } }],
          [".", "MemoryUtilization"]
        ],
        "title": "ECS Resource Utilization"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/RDS", "DatabaseConnections", { "stat": "Average" }],
          [".", "QueryLatency", { "stat": "p95" }]
        ],
        "title": "Database Performance"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "fields @timestamp, duration\n| filter duration > 500\n| stats count() by bin(5m)",
        "region": "us-east-1",
        "title": "Slow Queries (> 500ms)"
      }
    }
  ]
}
```

### Application Metrics Dashboard

```typescript
// CloudWatch Insights queries
const queries = {
  errorRate: `
    fields @timestamp, @message, @logStream
    | filter ispresent(@message) and @message like /ERROR/
    | stats count() as error_count by @logStream
    | sort error_count desc
  `,

  slowEndpoints: `
    fields @timestamp, duration, path
    | filter duration > 500
    | stats count() as slow_count, avg(duration) as avg_duration 
      by path
    | sort slow_count desc
  `,

  apiLatencyByEndpoint: `
    fields @timestamp, duration, path
    | stats avg(duration) as avg_ms, pct(duration, 95) as p95_ms, 
            pct(duration, 99) as p99_ms by path
  `,

  userActivity: `
    fields @timestamp, userId, @message
    | filter @message like /login|logout|create_match/
    | stats count() as activity_count by userId
    | sort activity_count desc
  `,
};
```

## Alerting

### Alert Policies

**High Error Rate**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-error-rate-high \
  --alarm-description "Alert if error rate > 1%" \
  --metric-name 5XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:critical-alerts
```

**Slow API Response**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-api-slow \
  --alarm-description "Alert if p95 response > 500ms" \
  --metric-name TargetResponseTime \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 300 \
  --threshold 0.5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:warnings
```

**Database Connection Pool Exhausted**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-db-pool-exhausted \
  --alarm-description "Alert if connection pool > 80% utilized" \
  --metric-name DatabaseConnections \
  --namespace VeloceSports/Backend \
  --statistic Average \
  --period 60 \
  --threshold 24 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:critical-alerts
```

**High CPU Usage**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name velocesports-cpu-high \
  --alarm-description "Alert if CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --dimensions Name=ServiceName,Value=backend \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789:warnings
```

### Alert Routing

**PagerDuty Integration**:
```typescript
interface AlertConfig {
  severity: 'critical' | 'warning' | 'info';
  service: string;
  title: string;
  message: string;
  context: Record<string, any>;
}

async function sendAlert(config: AlertConfig): Promise<void> {
  const pagerDutyEvent = {
    routing_key: process.env.PAGERDUTY_INTEGRATION_KEY,
    event_action: 'trigger',
    dedup_key: `${config.service}-${config.title}`,
    payload: {
      summary: config.title,
      severity: config.severity === 'critical' ? 'critical' : 'warning',
      source: 'VeloceSports',
      custom_details: config.context,
    },
  };

  await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pagerDutyEvent),
  });
}
```

### Alert Thresholds

| Alert | Threshold | Duration | Action |
|-------|-----------|----------|--------|
| Error Rate High | > 1% | 5 min | Critical |
| API Response Slow (p95) | > 500ms | 15 min | Warning |
| API Response Slow (p99) | > 1000ms | 5 min | Critical |
| Database Connections | > 80% | 2 min | Warning |
| CPU Usage | > 85% | 5 min | Warning |
| Memory Usage | > 90% | 5 min | Critical |
| Disk Space | > 85% | 10 min | Warning |
| Replication Lag | > 1s | 2 min | Critical |

## Observability

### Distributed Tracing

**Implementation with correlation IDs**:

```typescript
export function traceRequest(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.headers['x-correlation-id'] as string || generateId();
  const traceId = generateId();

  req.correlationId = correlationId;
  req.traceId = traceId;

  // Add to response headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Trace-ID', traceId);

  // Log start
  logInfo('Request started', {
    correlationId,
    traceId,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  res.on('finish', () => {
    logInfo('Request completed', {
      correlationId,
      traceId,
      status: res.statusCode,
      duration: Date.now() - (req.startTime || Date.now()),
    });
  });

  next();
}

// Pass correlation ID through service calls
async function someService(input: Input, correlationId: string): Promise<Output> {
  logInfo('Service call', { correlationId, input });
  
  // Database calls
  const result = await db.query('SELECT ...', {
    correlationId,
  });

  logInfo('Service result', { correlationId, result });
  return result;
}
```

### Request Tracing Flow

```
Client Request
  ↓
API Gateway (adds X-Correlation-ID, X-Trace-ID)
  ↓
Express Middleware (attaches to req object)
  ↓
Route Handler (passes to services)
  ↓
Service Layer (logs with correlation ID)
  ↓
Database Query (includes correlation ID)
  ↓
CloudWatch Logs (all logs grouped by correlation ID)
  ↓
Query logs: grep "correlation-id-abc123" logs/combined.log
```

## Health Checks

### Comprehensive Health Check

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    cache: HealthCheckResult;
    fileStorage: HealthCheckResult;
    externalServices: HealthCheckResult;
  };
}

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  latency: number;
  error?: string;
}

router.get('/health', async (req, res) => {
  const startTime = Date.now();

  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    fileStorage: await checkFileStorage(),
    externalServices: await checkExternalServices(),
  };

  const status = Object.values(checks).every(c => c.status === 'ok') ? 'healthy' : 'degraded';

  const health: HealthStatus = {
    status,
    timestamp: new Date(),
    uptime: process.uptime(),
    checks,
  };

  res.status(status === 'healthy' ? 200 : 503).json(health);
});
```

## Logging Best Practices

### Structured Logging

```typescript
// Good: Structured logs
logInfo('Match created', {
  matchId: 1,
  categoryId: 1,
  opponent: 'Rival',
  tenantId: 1,
  userId: 42,
  correlationId: 'req-abc123',
  duration: 125,
});

// Bad: Unstructured logs
console.log('Match 1 created for Rival in category 1');
```

### Log Levels

```typescript
// ERROR: Something failed that shouldn't
logError('Database connection failed', { error });

// WARN: Something unexpected but recoverable
logWarn('Slow query detected', { duration: 750, query: 'SELECT...' });

// INFO: User actions and state changes
logInfo('User logged in', { userId, tenantId });

// DEBUG: Detailed diagnostic info
logDebug('Processing game action', { actionCode: 'GOAL', timestamp: 1200 });
```

## SLA Monitoring

### Service Level Objectives (SLOs)

```typescript
interface SLO {
  service: string;
  metric: string;
  target: number;      // %
  window: number;      // seconds
  alertThreshold: number; // % below target
}

const SLOs = [
  {
    service: 'API',
    metric: 'availability',
    target: 99.9,
    window: 86400, // 24 hours
    alertThreshold: 99.5,
  },
  {
    service: 'API',
    metric: 'response_time_p99',
    target: 1000, // ms
    window: 300, // 5 minutes
    alertThreshold: 1500,
  },
  {
    service: 'Database',
    metric: 'availability',
    target: 99.99,
    window: 86400,
    alertThreshold: 99.95,
  },
];

// Calculate SLO compliance
async function calculateSLOCompliance(slo: SLO): Promise<number> {
  const metric = await getMetric(slo.service, slo.metric, slo.window);
  return (metric.value / slo.target) * 100;
}
```

## Incident Response

### On-Call Runbook

**High Error Rate Incident**:

1. **Detect**: CloudWatch alarm triggers (error rate > 1%)
2. **Alert**: PagerDuty notifies on-call engineer
3. **Acknowledge**: Engineer acknowledges within 5 minutes
4. **Investigate**:
   - Check Sentry for recent errors
   - Query CloudWatch Logs for error patterns
   - Review correlation IDs
   - Check deployment status
5. **Mitigate**:
   - Scale up ECS tasks
   - Drain bad instances
   - Rollback deployment if needed
6. **Resolve**:
   - Fix root cause
   - Deploy fix
   - Monitor for 30 minutes
   - Close incident
7. **Post-Mortem**: Document within 24 hours

### Incident Templates

```markdown
# Incident Report: High Error Rate

## Timeline
- 2026-10-05 14:32 - Alert triggered
- 2026-10-05 14:35 - On-call acknowledged
- 2026-10-05 14:42 - Root cause identified (memory leak)
- 2026-10-05 14:55 - Fix deployed
- 2026-10-05 15:05 - Incident resolved

## Impact
- Error rate: 3.2% (above 1% threshold)
- Affected users: ~150
- Duration: 23 minutes

## Root Cause
Memory leak in match service caused by unclosed database connections

## Resolution
- Reverted to previous version
- Deployed fix with connection pooling fix
- Added monitoring for connection count

## Prevention
- Add memory usage alerts
- Improve connection pool testing
- Code review checklist for connection handling
```

## Performance Monitoring

### Percentile Analysis

```bash
# CloudWatch Logs Insights: Get percentiles
fields duration
| stats pct(duration, 50) as p50, pct(duration, 95) as p95, 
        pct(duration, 99) as p99
| display p50, p95, p99
```

### Performance Report

Generate weekly performance reports:

```typescript
async function generatePerformanceReport(): Promise<void> {
  const metrics = await getMetrics(7 * 24 * 60 * 60 * 1000); // Last 7 days

  const report = {
    period: 'Last 7 days',
    summary: {
      totalRequests: metrics.requests,
      totalErrors: metrics.errors,
      errorRate: (metrics.errors / metrics.requests) * 100,
      avgResponseTime: metrics.avgDuration,
      p95ResponseTime: metrics.p95Duration,
    },
    endpoints: metrics.endpoints.map(e => ({
      name: e.name,
      requests: e.requests,
      avgDuration: e.avgDuration,
      p95Duration: e.p95Duration,
      errorRate: (e.errors / e.requests) * 100,
    })),
    alerts: metrics.alerts,
  };

  // Send report via email
  await sendEmail({
    to: 'team@velocesports.com',
    subject: 'VeloceSports Performance Report - Week of Oct 5',
    body: formatReport(report),
  });
}
```

## Monitoring Tools

### Required Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| CloudWatch | Metrics & Logs | AWS native |
| CloudWatch Insights | Log analysis | AWS native |
| Sentry | Error tracking | npm package |
| PagerDuty | On-call alerting | API integration |
| Grafana | Dashboards | CloudWatch + Prometheus |
| DataDog (optional) | Advanced APM | Agent |

## Monitoring Checklist

- [ ] All critical endpoints have performance budgets
- [ ] Error tracking (Sentry) configured
- [ ] CloudWatch dashboards created
- [ ] Alert policies configured for all thresholds
- [ ] PagerDuty integration active
- [ ] On-call rotation established
- [ ] Incident runbooks documented
- [ ] Correlation ID tracing implemented
- [ ] Health check endpoints working
- [ ] Performance baselines established
- [ ] Weekly performance reports scheduled
- [ ] SLO monitoring active
- [ ] Log retention policies set
- [ ] Cost monitoring enabled

---

**Last Updated**: 2026-10-05  
**Status**: Monitoring infrastructure ready for production
