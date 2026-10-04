# Integration Tests

Integration tests for VeloceSports API verify end-to-end functionality of critical flows.

## Test Suites

### 1. auth.integration.test.ts
Tests authentication endpoints and rate limiting on login attempts.

**Coverage:**
- `POST /auth/login` - Invalid credentials, format validation
- `POST /auth/refresh` - Invalid/missing refresh tokens
- `POST /auth/logout` - Authentication requirement
- `PATCH /auth/password` - Password change validation
- Rate limiting: 5 login attempts per 15 minutes

**Run specific suite:**
```bash
npm test -- tests/integration/auth.integration.test.ts
```

### 2. match-capture.integration.test.ts
Tests match action recording, attendance tracking, and rate limiting.

**Coverage:**
- `POST /api/tenant/matches/:matchId/actions` - Game action recording
- `GET /api/tenant/matches/:matchId/actions` - Action retrieval
- `PUT /api/tenant/matches/:matchId/attendance` - Attendance management
- Rate limiting: 20 actions per minute per user
- Multi-tenant isolation: Rate limits tracked per tenant

**Validation tests:**
- Player ID, action code, minute, period validation
- Minute range: 0-999
- Period range: 1+
- Authentication requirement

**Run specific suite:**
```bash
npm test -- tests/integration/match-capture.integration.test.ts
```

### 3. observations.integration.test.ts
Tests player observation recording and management.

**Coverage:**
- `POST /api/tenant/matches/players/:playerId/observations` - Create observation
- `GET /api/tenant/matches/players/:playerId/observations` - List observations
- `PATCH /api/tenant/matches/player-observations/:observationId` - Update observation
- `DELETE /api/tenant/matches/player-observations/:observationId` - Delete observation
- Rate limiting: 10 observations per minute per user

**Validation tests:**
- Observation text: 1-5000 characters
- Rating: 1-5 scale
- Category enum validation
- Pagination support (page, limit)
- Authentication requirement

**Run specific suite:**
```bash
npm test -- tests/integration/observations.integration.test.ts
```

## Running All Integration Tests

```bash
npm test -- tests/integration/
```

## Key Test Patterns

### Authentication Testing
All endpoints except auth/login should return 401 without valid token:
```typescript
const response = await request(app)
  .post('/api/endpoint')
  .send(payload);

expect(response.status).toBe(401);
expect(response.body.error?.code).toBe('UNAUTHORIZED');
```

### Validation Testing
Invalid payloads should return 400 with VALIDATION_ERROR:
```typescript
const response = await request(app)
  .post('/api/endpoint')
  .set('Authorization', token)
  .send(invalidPayload);

expect(response.status).toBe(400);
expect(response.body.error?.code).toBe('VALIDATION_ERROR');
```

### Rate Limit Headers
All responses should include rate limit headers:
```typescript
expect(response.headers['ratelimit-limit']).toBeDefined();
expect(response.headers['ratelimit-remaining']).toBeDefined();
expect(response.headers['ratelimit-reset']).toBeDefined();
```

### Multi-tenant Isolation
Rate limits should be tracked per tenant:
```typescript
const tenant1 = await request(app)
  .post('/api/endpoint')
  .set('x-tenant-id', '1')
  .send(payload);

const tenant2 = await request(app)
  .post('/api/endpoint')
  .set('x-tenant-id', '2')
  .send(payload);

// Both should have independent rate limit counters
```

## Debugging Tests

Run with verbose output:
```bash
npm test -- tests/integration/ --verbose
```

Run single test:
```bash
npm test -- tests/integration/auth.integration.test.ts --testNamePattern="should return 401 without authentication"
```

## Future Enhancements

- [ ] Database cleanup between test runs
- [ ] Test fixtures for seeding test data
- [ ] Performance benchmarks for critical paths
- [ ] Concurrent request testing
- [ ] Error recovery scenarios
- [ ] API versioning tests
