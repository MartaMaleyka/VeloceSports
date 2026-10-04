# VeloceSports Backend Testing Guide

## Overview

This guide documents testing practices and infrastructure for the VeloceSports backend.

## Test Types

### Unit Tests (`tests/unit/`)
Test individual functions and utilities in isolation.

**Key principles:**
- No database calls
- Mock external dependencies
- Test both happy paths and error cases
- Use factories for test data

**Example:**
```typescript
import { createUser } from '../factories/user.factory';

describe('UserService', () => {
  it('should create user with valid data', () => {
    const user = createUser({ email: 'test@example.com' });
    expect(user.email).toBe('test@example.com');
  });
});
```

### Integration Tests (`tests/integration/`)
Test API endpoints and service workflows with real database.

**Key principles:**
- Use real database connection
- Test request/response flow
- Verify data persistence
- Check error handling and validation

**Fixtures:**
- Setup database state before tests
- Cleanup after tests
- Use helper functions for common operations

**Example:**
```typescript
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'coach@academy.com', password: 'password123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
      });
  });
});
```

### E2E Tests (`tests/e2e/`)
Test complete user workflows in a real browser environment using Playwright.

**Key principles:**
- Test actual user interactions
- Verify visual feedback
- Test cross-browser compatibility
- Check accessibility

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run coverage in watch mode
npm run test:coverage:watch

# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="pattern"
```

### Coverage Reports

Coverage reports are generated in `coverage/` directory:

```bash
# View HTML coverage report
open coverage/index.html
```

**Coverage targets:**
- Statements: 50%
- Branches: 50%
- Functions: 50%
- Lines: 50%

## Test Data Factories

Use factories to create consistent test data:

```typescript
import { createUser, createAcademyAdmin, createCoach } from '../factories/user.factory';
import { createPlayer, createPlayers } from '../factories/player.factory';
import { createMatch, createMatches } from '../factories/match.factory';

// Create single user
const admin = createAcademyAdmin({ email: 'admin@academy.com' });

// Create multiple players
const players = createPlayers(5);

// Override factory defaults
const coach = createCoach({ 
  tenantId: 2,
  name: 'John Doe' 
});
```

## Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should update player', async () => {
  // Arrange: Set up test data
  const player = createPlayer();
  
  // Act: Perform the action
  const result = await playerService.update(player.id, { position: 'Goalie' });
  
  // Assert: Verify results
  expect(result.position).toBe('Goalie');
});
```

### 2. Error Testing
```typescript
it('should throw for invalid input', () => {
  expect(() => {
    createUser({ email: 'not-an-email' });
  }).toThrow(ValidationError);
});
```

### 3. Async/Await
```typescript
it('should fetch player', async () => {
  const player = await playerService.getById(playerId);
  expect(player).toBeDefined();
});
```

### 4. Test Isolation
- Each test should be independent
- Setup fresh data before each test
- Cleanup after each test
- Don't rely on test execution order

### 5. Descriptive Names
```typescript
// ✅ Good
it('should reject login with incorrect password', () => {});

// ❌ Bad
it('rejects login', () => {});
```

## Integration Test Patterns

### Test Helper Functions

```typescript
async function createTestUser(role: UserRole) {
  return request(app)
    .post('/api/auth/register')
    .send({
      email: `user-${randomUUID()}@example.com`,
      password: 'password123',
      role,
    });
}

async function loginAs(role: UserRole) {
  const { body } = await createTestUser(role);
  return body.accessToken;
}
```

### Database Transactions
Tests wrap operations in transactions that rollback:

```typescript
beforeEach(async () => {
  await db.beginTransaction();
});

afterEach(async () => {
  await db.rollback();
});
```

## E2E Test Patterns

### Page Objects
```typescript
class LoginPage {
  async goto() {
    await page.goto('/login');
  }

  async login(email: string, password: string) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
  }
}

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('coach@academy.com', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

## Common Issues

### Tests Timeout
- Increase timeout in jest.config.js (default: 30s)
- Check for missing `await` in async operations
- Verify database connection

### Flaky Tests
- Avoid hard-coded delays (use proper waiting)
- Don't rely on external services
- Use database transactions for isolation
- Check for race conditions

### Coverage Gaps
```bash
# See uncovered lines
npm run test:coverage

# Focus on specific files
npm test -- path/to/file.ts --coverage
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main/develop branches
- Manual workflow trigger

Coverage reports are attached to CI output.

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Playwright Testing](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
