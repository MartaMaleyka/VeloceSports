# Backend Logging Guide

## Overview

This guide covers the structured logging system implemented in VeloceSports backend using Winston and correlation IDs for request tracing.

## Logging Infrastructure

### Logger Setup

The logger is configured in `src/utils/logger.ts` with Winston. It supports:

- **Console output** (development only)
- **File outputs**: `logs/combined.log`, `logs/error.log`
- **Exception handling**: `logs/exceptions.log`
- **Rejection handling**: `logs/rejections.log`

### Log Levels

- `error` (0): Critical failures
- `warn` (1): Warnings and non-critical issues
- `info` (2): General information (default level)
- `http` (3): HTTP request/response details
- `debug` (4): Detailed debugging information

Set log level with `LOG_LEVEL` environment variable.

## Usage Patterns

### Basic Logging

```typescript
import { logInfo, logDebug, logWarn, logError } from '../utils/logger';

// Simple log
logInfo('User created successfully');

// Log with context
logInfo('Player added to team', {
  playerId: 42,
  teamId: 7,
  userId: req.user?.userId,
  correlationId: req.correlationId,
});

// Debug logs
logDebug('Database query executed', {
  query: 'SELECT * FROM players WHERE category_id = ?',
  duration: '125ms',
});

// Warnings
logWarn('API rate limit approaching', {
  userId: 123,
  requestsRemaining: 5,
});

// Errors
try {
  await processPayment(invoice);
} catch (error) {
  logError(error as Error, {
    invoiceId: invoice.id,
    userId: req.user?.userId,
    correlationId: req.correlationId,
  });
}
```

### Structured Logging with Context

Always include relevant context for debugging:

```typescript
logInfo('Match created', {
  matchId: match.id,
  categoryId: match.categoryId,
  tenantId: req.tenantId,
  userId: req.user?.userId,
  correlationId: req.correlationId,
  timestamp: new Date().toISOString(),
});
```

## Correlation IDs

### What are Correlation IDs?

Correlation IDs are unique identifiers that track a request through the entire system. They're essential for:

- **Debugging**: Find all logs related to a single user request
- **Performance**: Measure end-to-end request duration
- **Tracing**: Track requests across services
- **Troubleshooting**: Root cause analysis in production

### How to Use Correlation IDs

The `correlationIdMiddleware` is automatically added to Express in the main app setup:

```typescript
import { correlationIdMiddleware } from './middlewares/correlation-id';

app.use(correlationIdMiddleware);
```

Every request gets a correlation ID that can be:

1. **Automatically generated**: If client doesn't provide one
2. **Reused**: If client sends `X-Correlation-ID` header

### Including Correlation IDs in Logs

```typescript
// Always include correlationId in context
logInfo('Sensitive operation', {
  correlationId: req.correlationId,
  userId: req.user?.userId,
  action: 'payment_processed',
  amount: 100.00,
});
```

### Client-Side Tracing

Clients can track their requests by passing a correlation ID:

```javascript
// Frontend: Send correlation ID in header
const correlationId = sessionStorage.getItem('correlationId') || generateUUID();
sessionStorage.setItem('correlationId', correlationId);

const response = await fetch('/api/matches', {
  headers: {
    'X-Correlation-ID': correlationId,
  },
});

// Backend returns the same correlation ID for client tracking
const returnedId = response.headers.get('X-Correlation-ID');
```

## Best Practices

### 1. Log Meaningful Context

❌ **Bad:**
```typescript
logInfo('Error occurred');
```

✅ **Good:**
```typescript
logInfo('Player photo upload failed', {
  playerId: 42,
  photoSize: fileSize,
  error: error.message,
  correlationId: req.correlationId,
});
```

### 2. Use Appropriate Log Levels

- `error`: Something broke that the application cannot recover from
- `warn`: Something unexpected happened but the app can continue
- `info`: Notable events in normal operation
- `debug`: Detailed information for developers during troubleshooting

### 3. Include Correlation ID in Every Service Call

```typescript
export class PaymentService {
  async processPayment(invoiceId: number, correlationId: string) {
    logInfo('Processing payment', { invoiceId, correlationId });
    // ...
    logInfo('Payment successful', { invoiceId, correlationId, amount });
  }
}
```

### 4. Log Entry and Exit of Critical Operations

```typescript
async listAcademies(filters?: AcademyListFilters) {
  logDebug('Fetching academies', { filters, correlationId: this.correlationId });
  
  const academies = await db.query('SELECT * FROM academies WHERE ...');
  
  logInfo('Academies fetched', {
    count: academies.length,
    correlationId: this.correlationId,
  });
  
  return academies;
}
```

### 5. Avoid Logging Sensitive Data

❌ **Bad:**
```typescript
logInfo('User login', { email: user.email, password: user.password });
```

✅ **Good:**
```typescript
logInfo('User login', { userId: user.id, email: user.email });
```

## Querying Logs

### Find logs by Correlation ID

```bash
grep "correlation-id-123" logs/combined.log
```

### Find error logs

```bash
cat logs/error.log | grep "2026-10-04"
```

### Find slow requests

```bash
grep "duration.*[5-9][0-9][0-9][0-9]ms\|duration.*[0-9][0-9][0-9][0-9][0-9]ms" logs/combined.log
```

## Migration from console.log

### Before (Old Pattern)

```typescript
console.log('User created:', user);
```

### After (New Pattern)

```typescript
import { logInfo } from '../utils/logger';

logInfo('User created', {
  userId: user.id,
  email: user.email,
  role: user.role,
});
```

## Testing with Logging

In tests, logging is disabled by default (no file output). To capture logs in tests:

```typescript
import { logger } from '../utils/logger';

it('should log user creation', () => {
  const logSpy = jest.spyOn(logger, 'info');
  
  // ... test code
  
  expect(logSpy).toHaveBeenCalledWith(
    expect.stringContaining('User created'),
    expect.objectContaining({ userId: 123 })
  );
  
  logSpy.mockRestore();
});
```

## Performance Monitoring

Example of using correlation IDs for performance analysis:

```typescript
async getPlayerDetail(playerId: number, correlationId: string) {
  const startTime = Date.now();
  
  logInfo('Fetching player detail', { playerId, correlationId });
  
  const player = await db.findPlayer(playerId);
  const stats = await db.findPlayerStats(playerId);
  
  const duration = Date.now() - startTime;
  
  logInfo('Player detail fetched', {
    playerId,
    correlationId,
    duration: `${duration}ms`,
    statsCount: stats.length,
  });
  
  return { player, stats };
}
```

Then query logs for slow requests:

```bash
grep "Player detail fetched.*duration.*[0-9][0-9][0-9][0-9]ms" logs/combined.log
```

## Configuration

### Environment Variables

```bash
# Log level: error, warn, info (default), http, debug
LOG_LEVEL=debug

# Node environment
NODE_ENV=production
```

### Log Output Locations

- Development: Console + `logs/combined.log` + `logs/error.log`
- Production: `logs/combined.log` + `logs/error.log` (no console)
- Test: No file output

### Log Rotation

Log files auto-rotate when they exceed:
- **Max size**: 10MB
- **Max files**: 5 retained files

## Troubleshooting

### Logs not appearing

1. Check `LOG_LEVEL` environment variable matches your message level
2. In production, check `logs/combined.log` (console won't output)
3. Ensure `/logs` directory exists and is writable

### Correlation ID missing

1. Ensure `correlationIdMiddleware` is registered early in Express setup
2. Always include `req.correlationId` when calling services
3. Pass `correlationId` through async service chains

### Performance impact

- Logging adds minimal overhead (< 1ms per log entry)
- Use `debug` level only in development to reduce noise
- Consider sampling in high-volume endpoints

---

**Last Updated**: 2026-10-04  
**Status**: Logging infrastructure ready for integration
