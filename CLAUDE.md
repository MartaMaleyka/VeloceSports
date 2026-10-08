# VeloceSports: Claude Code Integration Guide

## Project Overview

VeloceSports is a comprehensive sports academy management system built with Astro SSR (frontend, with a BFF layer), Express (backend), and MySQL. It provides real-time match tracking, player analysis, and performance monitoring.

**Key Stats:**
- **Frontend**: Astro (SSR, `@astrojs/node`), React islands, TypeScript
- **Backend**: 20+ Express services, 30+ API endpoints, MySQL database
- **Testing**: Jest unit tests, Playwright E2E tests
- **Performance**: Logging middleware, correlation ID tracing, performance budgets
- **Accessibility**: WCAG 2.1 AA compliant components

## Repository Structure

```
velocesports/
├── apps/
│   ├── backend/              # Express backend
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── repositories/ # Database queries
│   │   │   ├── validators/   # Zod schemas
│   │   │   ├── middlewares/  # Express middleware
│   │   │   ├── utils/        # Utilities (logger, auth, etc)
│   │   │   └── routes/       # Express routes
│   │   ├── tests/
│   │   │   ├── unit/         # Unit tests
│   │   │   ├── integration/  # Integration tests
│   │   │   ├── factories/    # Test data factories
│   │   │   └── utils/        # Test utilities
│   │   ├── TESTING_GUIDE.md
│   │   ├── LOGGING_GUIDE.md
│   │   ├── PERFORMANCE_MONITORING.md
│   │   └── ACCESSIBILITY_GUIDE.md
│   │
│   ├── web/                  # Astro frontend (SSR + BFF)
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   │   ├── accessible/  # WCAG 2.1 AA components
│   │   │   │   ├── matches/     # Match-related components
│   │   │   │   └── ...
│   │   │   ├── pages/        # Astro pages (.astro) and BFF proxy (pages/api/)
│   │   │   ├── middleware.ts # Session, role and password-change guards
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   │   ├── useDebounce.ts        # Performance hooks
│   │   │   │   ├── useRetry.ts
│   │   │   │   ├── useMatchForm.ts       # Business logic hooks
│   │   │   │   └── ...
│   │   │   ├── lib/          # Utilities (API client, auth, etc)
│   │   │   └── styles/       # CSS modules
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── e2e/          # Playwright tests
│   │   │   └── utils/
│   │   └── FRONTEND_IMPROVEMENTS.md
│   │
│   └── shared/               # Shared types & constants
│       ├── src/
│       │   ├── types/        # Shared TypeScript types
│       │   ├── constants/    # Shared constants
│       │   └── i18n/         # Translations
│
├── docs/                     # Documentation
├── ARCHITECTURE.md           # System design
└── CLAUDE.md                 # This file
```

## Key Technologies

**Frontend:**
- Astro 7 (SSR) with role-based route guards in `middleware.ts`
- TypeScript 5+
- React 18+
- Tailwind CSS
- Playwright for E2E tests
- Custom accessible components with ARIA attributes

**Backend:**
- Express 4.2+
- TypeScript 5+
- MySQL with mysql2 driver
- Winston logging
- Zod for validation
- JWT for authentication

**Shared:**
- Shared types between frontend & backend
- i18n for Spanish/English support
- Design system components

## Critical Paths & Performance

### High-Priority Endpoints

1. **Coach Analysis** (`GET /api/coach/analysis/players`)
   - Budget: 500ms (p95)
   - Handles photo batching, aggregations
   - Correlation ID: `req.correlationId`
   - File: `apps/backend/src/services/coach-analysis.service.ts`

2. **Match Operations** (`GET/POST /api/tenant/matches`)
   - Budget: 150-200ms
   - High-frequency endpoint
   - File: `apps/backend/src/services/match.service.ts`

3. **Dashboard** (`GET /api/tenant/dashboard`)
   - Budget: 300ms (p95)
   - Multiple aggregations
   - File: `apps/backend/src/services/dashboard.service.ts`

### Database Performance

**Key Optimizations:**
- ✓ Batch photo URL generation (no N+1)
- ✓ Connection pooling enabled
- ✓ Pagination with LIMIT/OFFSET
- ✓ Indexes on frequently queried columns

**Add Performance Tests:**
```bash
# Run performance benchmarks
npm run test -- performance-benchmarks

# Monitor slow queries
LOG_LEVEL=debug npm run dev | grep "duration.*[0-9][0-9][0-9]ms"
```

## Authentication & Authorization

### JWT Tokens

**Access Token:**
- Duration: 15 minutes
- Used in `Authorization: Bearer <token>` header
- Payload: `{ userId, role, tenantId, permissions }`
- Verified in `authenticate` middleware

**Refresh Token:**
- Duration: 30 days  
- Stored in HTTP-only cookie (secure in production)
- Rotates on each refresh
- Revocation: Distributed blacklist (Redis/cache)

### Middleware Stack

1. **authenticate**: Validate JWT token
2. **tenant**: Extract and validate tenant context
3. **requireRole**: RBAC checks (Admin, Coach, Parent, Player)
4. **validate**: Zod schema validation
5. **correlationIdMiddleware**: Tracing
6. **requestLogger**: Performance monitoring

Example:
```typescript
router.post('/api/tenant/matches',
  authenticate,           // User is authenticated
  tenant,                 // Tenant context exists
  requireRole('COACH'),   // User is coach
  validate(createMatchSchema), // Input is valid
  matchController.create  // Handle request
);
```

## Testing Strategy

### Unit Tests
- Location: `apps/backend/tests/unit/`
- Coverage: 70% target (utilities, validators, helpers)
- Run: `npm test` (watch: `npm test:watch`)

**Test Factories:**
```typescript
import { userFactory, playerFactory } from './factories';

const admin = userFactory.create({ role: 'ADMIN' });
const players = playerFactory.createBatch(10);
```

### Integration Tests
- Test service layers with real database
- Use test transactions for cleanup
- Location: `apps/backend/tests/integration/`

### E2E Tests
- Playwright tests for critical user flows
- Location: `apps/web/tests/e2e/`
- Run: `npm run test:e2e` (headed: `npm run test:e2e:headed`)
- Critical paths: Auth, match creation, player management

**Example:**
```typescript
test('coach should create and analyze match', async ({ page, login }) => {
  await login('coach@test.local');
  
  await page.goto('/matches');
  await page.click('button:has-text("New Match")');
  
  // Fill form
  await page.fill('input[name="opponent"]', 'Rival Team');
  
  // Submit and verify
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/matches\/\d+/);
});
```

## Logging & Monitoring

### Structured Logging

All logs include correlation IDs for tracing:

```typescript
import { logInfo } from '../utils/logger';

logInfo('Player added to team', {
  playerId: 42,
  teamId: 7,
  correlationId: req.correlationId,
  userId: req.user?.userId,
});
```

### Log Levels

- `error`: Failures, exceptions
- `warn`: Potential issues, rate limit approaching
- `info`: User actions, state changes (default)
- `debug`: Detailed execution info (development)

### Querying Logs

```bash
# Find all logs for a request
grep "correlation-id-abc123" logs/combined.log

# Find slow coach analysis
grep "Coach analysis" logs/combined.log | grep "duration.*[5-9][0-9][0-9]ms"

# Find errors
cat logs/error.log | tail -50
```

See `LOGGING_GUIDE.md` for comprehensive documentation.

## Performance Monitoring

### Request Duration Tracking

Automatic via `requestLoggerMiddleware`:
```
GET /api/tenant/matches → 200 {45ms}
POST /api/coach/analysis/players/export.csv → 200 {320ms}
GET /api/invalid → 404 {5ms}
```

### Performance Budgets

| Endpoint | Budget | Critical |
|----------|--------|----------|
| GET /api/tenant/matches | 150ms | 1000ms |
| POST /api/tenant/matches | 200ms | 1000ms |
| GET /api/coach/analysis/players | 500ms | 2000ms |
| GET /api/tenant/dashboard | 300ms | 1500ms |

### Benchmark Tests

```typescript
import { benchmarkAsync, assertPercentile } from './tests/utils/performance-utils';

const stats = await benchmarkAsync(
  () => coachAnalysisService.listPlayers(actor, query),
  { iterations: 10 }
);

// p95 must be < 500ms
assertPercentile(stats.p95, 500, 'Coach analysis');
```

See `PERFORMANCE_MONITORING.md` for load testing with Artillery.

## Common Development Tasks

### Adding a New API Endpoint

1. **Create validator** (`apps/backend/src/validators/my-feature.validator.ts`):
```typescript
import { z } from 'zod';

export const createFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export type CreateFeatureBody = z.infer<typeof createFeatureSchema>;
```

2. **Create service** (`apps/backend/src/services/my-feature.service.ts`):
```typescript
import { logInfo } from '../utils/logger';

export class MyFeatureService {
  async create(tenantId: number, input: CreateFeatureBody) {
    logInfo('Creating feature', { tenantId, name: input.name });
    
    const result = await db.insert(...);
    
    logInfo('Feature created', { featureId: result.id });
    return result;
  }
}
```

3. **Create controller** (`apps/backend/src/controllers/my-feature.controller.ts`):
```typescript
import { getValidated } from '../middlewares/validate';

export class MyFeatureController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId as number;
      const input = getValidated<CreateFeatureBody>(req, 'body');
      
      const result = await myFeatureService.create(tenantId, input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
```

4. **Add route** (`apps/backend/src/routes/my-feature.routes.ts`):
```typescript
import { Router } from 'express';
import { authenticate, tenant, requireRole, validate } from '../middlewares';
import { createFeatureSchema } from '../validators/my-feature.validator';
import { myFeatureController } from '../controllers/my-feature.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  tenant,
  requireRole('ADMIN'),
  validate(createFeatureSchema),
  (req, res, next) => myFeatureController.create(req, res, next)
);

export default router;
```

5. **Add tests**:
```typescript
describe('MyFeatureService', () => {
  it('should create feature', async () => {
    const result = await myFeatureService.create(tenantId, {
      name: 'Test Feature'
    });
    
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Feature');
  });
});
```

### Frontend: Adding an Accessible Component

1. **Create component** (`apps/web/src/components/accessible/MyComponent.tsx`):
```typescript
import React from 'react';

interface MyComponentProps {
  label: string;
  required?: boolean;
  error?: string;
}

export const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ label, required, error }, ref) => {
    const id = `my-component-${Math.random().toString(36).slice(2)}`;
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div ref={ref} className="my-component">
        <label htmlFor={id}>
          {label}
          {required && <span aria-label="required">*</span>}
        </label>
        
        <input
          id={id}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={errorId}
        />
        
        {error && (
          <div id={errorId} role="alert" className="error-message">
            {error}
          </div>
        )}
      </div>
    );
  }
);

MyComponent.displayName = 'MyComponent';
```

2. **Test accessibility**:
```typescript
import { render } from '@testing-library/react';

it('should be accessible', () => {
  const { container } = render(
    <MyComponent label="Test" required error="Error message" />
  );
  
  const input = container.querySelector('input');
  expect(input).toHaveAttribute('aria-required', 'true');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});
```

See `ACCESSIBILITY_GUIDE.md` for detailed patterns.

## Deployment

### Environment Variables

**Backend (.env):**
```
NODE_ENV=production
PORT=3001
DATABASE_URL=mysql://user:pass@localhost:3306/velocesports
LOG_LEVEL=info
JWT_SECRET=your-secret-key
MINIO_URL=https://minio.example.com
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ENVIRONMENT=production
```

### Build & Deploy

```bash
# Build backend
pnpm build:backend
pnpm --filter @velocesport/backend start  # Starts on :3001

# Build frontend
pnpm --filter @velocesport/web build
pnpm --filter @velocesport/web preview
```

## Code Review Checklist

When reviewing PRs, check:

- [ ] Tests added/updated for new code
- [ ] Performance budget respected (benchmark tests pass)
- [ ] Logging includes correlation ID for critical paths
- [ ] Input validation with Zod (no `as unknown as`)
- [ ] Accessibility: ARIA attributes, focus management
- [ ] Database: No N+1 queries, batch operations used
- [ ] Error handling: Proper error messages logged
- [ ] Documentation: CLAUDE.md updated if needed

## Troubleshooting

### Slow Queries

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# Search for slow queries
grep "duration.*[5-9][0-9][0-9]ms" logs/combined.log

# Check correlation ID for context
grep "correlation-id-abc" logs/combined.log
```

### Performance Regression

1. Run performance benchmarks:
```bash
npm run test -- performance-benchmarks
```

2. Check before/after metrics:
```typescript
const statsBefore = await benchmarkAsync(fn, { iterations: 100 });
const statsAfter = await benchmarkAsync(fn, { iterations: 100 });
const improvement = (statsAfter.average / statsBefore.average - 1) * 100;
```

### Test Failures

```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- auth.test.ts

# Watch mode for development
npm test:watch

# E2E tests headed (see browser)
npm run test:e2e:headed
```

## Useful Commands

```bash
# Development
pnpm dev:backend         # Backend dev server (tsx watch)
pnpm dev:web             # Frontend dev server (Astro)
pnpm test:backend        # Backend tests (Jest)
pnpm --filter @velocesport/web test   # Frontend unit tests (Vitest)

# Build & Deploy
pnpm build               # Build all workspaces
pnpm --filter @velocesport/backend start   # Start production backend

# E2E (frontend)
pnpm --filter @velocesport/web test:e2e

# Database (run from root with pnpm db:seed, or inside apps/backend)
pnpm db:seed             # Seed test data
pnpm --filter @velocesport/backend db:migrate
pnpm --filter @velocesport/backend db:repair
pnpm --filter @velocesport/backend db:backfill-action-catalog
pnpm --filter @velocesport/backend db:backfill-player-viewers
```

## Documentation Files

- **ARCHITECTURE.md**: System design, data flow, database schema
- **TESTING_GUIDE.md**: Unit, integration, E2E testing patterns
- **LOGGING_GUIDE.md**: Structured logging, correlation IDs, monitoring
- **PERFORMANCE_MONITORING.md**: Benchmarking, load testing, optimization
- **ACCESSIBILITY_GUIDE.md**: WCAG 2.1 AA compliance, component patterns
- **FRONTEND_IMPROVEMENTS.md**: React hooks, accessible components

## Quick Links

- **GitHub**: https://github.com/MartaMaleyka/VeloceSports
- **API Docs**: http://localhost:3001/api/docs (development)
- **Design System**: `@velocesport/design-system`
- **Shared Types**: `@velocesport/shared`

## Contributing Guidelines

1. **Branch naming**: `feature/name` or `fix/bug-name` or `chore/task-name`
2. **Commit messages**: Clear, descriptive (see git log for style)
3. **PRs**: Include test coverage, performance budget verification
4. **Reviews**: Approve once tests pass and code meets standards

## Team Guidelines

- **Communication**: Use correlation IDs for debugging
- **Performance**: Measure before optimizing
- **Testing**: Unit + E2E for critical paths
- **Documentation**: Update CLAUDE.md when patterns change
- **Code Style**: Use existing patterns in codebase

---

**Last Updated**: 2026-10-04  
**Status**: Documentation ready for development
