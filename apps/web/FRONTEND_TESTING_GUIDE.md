# Frontend Testing Guide

## Overview

Comprehensive testing strategy for VeloceSports frontend covering unit tests, integration tests, E2E tests, and accessibility testing. Target: 70% coverage for critical user paths.

## Testing Architecture

```
tests/
├── unit/                    # React component tests
│   ├── components/          # Component unit tests
│   ├── hooks/               # Custom hook tests
│   ├── lib/                 # Utility function tests
│   └── __mocks__/           # Mock setup
├── integration/             # Component interaction tests
│   ├── forms/               # Form submission flows
│   ├── auth/                # Authentication flows
│   └── pages/               # Page-level integration
└── e2e/                     # End-to-end tests
    ├── auth.spec.ts         # Login/logout flows
    ├── match-creation.spec.ts  # Match workflows
    ├── coach-analysis.spec.ts  # Coach analysis
    └── player-management.spec.ts
```

## Unit Testing

### Framework: Vitest + React Testing Library

**Setup**:
```bash
npm install -D vitest @testing-library/react @testing-library/user-event
```

### Basic Component Test

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('should render with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Testing Custom Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });
    expect(result.current).toBe('initial'); // Not updated yet

    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    });

    expect(result.current).toBe('updated');
  });
});
```

### Testing Forms

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/forms/LoginForm';

describe('LoginForm', () => {
  it('should validate email format', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<LoginForm onSubmit={onSubmit} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });
    
    // Invalid email
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid form', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<LoginForm onSubmit={onSubmit} />);
    
    await user.type(screen.getByLabelText(/email/i), 'user@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));
    
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'password123'
    });
  });
});
```

### Mocking API Calls

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/players', () => {
    return HttpResponse.json([
      { id: 1, firstName: 'John', lastName: 'Doe' }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PlayerList', () => {
  it('should fetch and display players', async () => {
    const { getByText } = render(<PlayerList />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should handle API errors', async () => {
    server.use(
      http.get('/api/players', () => {
        return HttpResponse.error();
      })
    );
    
    const { getByText } = render(<PlayerList />);
    
    await waitFor(() => {
      expect(getByText(/error loading/i)).toBeInTheDocument();
    });
  });
});
```

## Integration Testing

### Testing Component Interactions

```typescript
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchCreationFlow } from '@/components/MatchCreationFlow';

describe('MatchCreationFlow', () => {
  it('should complete match creation with category and opponent', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    
    render(<MatchCreationFlow onComplete={onComplete} />);
    
    // Step 1: Select category
    const categorySelect = screen.getByLabelText(/category/i);
    await user.selectOptions(categorySelect, '1');
    
    // Step 2: Enter opponent
    await user.type(screen.getByLabelText(/opponent/i), 'Rival Team');
    
    // Step 3: Select date
    const dateInput = screen.getByLabelText(/date/i);
    await user.type(dateInput, '2026-10-10');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /create/i }));
    
    expect(onComplete).toHaveBeenCalledWith({
      categoryId: '1',
      opponent: 'Rival Team',
      matchDatetime: '2026-10-10'
    });
  });
});
```

## E2E Testing

### Framework: Playwright

**Setup**:
```bash
npm install -D @playwright/test
```

**Configuration** (`playwright.config.ts`):
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 2,
  workers: 4,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
```

### Authentication Fixture

```typescript
import { test as base, expect } from '@playwright/test';

type AuthFixture = {
  authenticatedPage: Page;
  login: (email: string, password: string) => Promise<void>;
};

export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/login');
    
    // Perform login
    await page.fill('input[name="email"]', 'coach@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');
    
    // Wait for navigation
    await page.waitForURL('/matches');
    
    // Use the authenticated page
    await use(page);
  },

  login: async ({ page }, use) => {
    const login = async (email: string, password: string) => {
      await page.goto('/login');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button:has-text("Login")');
      await page.waitForURL('/matches');
    };
    
    await use(login);
  },
});

export { expect };
```

### Authentication Tests

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form
    await page.fill('input[name="email"]', 'coach@test.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit
    await page.click('button:has-text("Login")');
    
    // Verify navigation and user info
    await expect(page).toHaveURL('/matches');
    await expect(page.locator('text=Welcome, Coach')).toBeVisible();
  });

  it('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button:has-text("Login")');
    
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should logout successfully', async ({ authenticatedPage }) => {
    // Click logout button
    await authenticatedPage.click('button:has-text("Logout")');
    
    // Verify redirect to login
    await expect(authenticatedPage).toHaveURL('/login');
  });
});
```

### Match Management Tests

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Match Management', () => {
  test('should create match', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/matches');
    
    // Click "New Match"
    await authenticatedPage.click('button:has-text("New Match")');
    
    // Fill form
    await authenticatedPage.selectOption('select[name="categoryId"]', '1');
    await authenticatedPage.fill('input[name="opponent"]', 'Rival United');
    await authenticatedPage.fill('input[name="matchDatetime"]', '2026-10-10T14:00');
    
    // Submit
    await authenticatedPage.click('button:has-text("Create Match")');
    
    // Verify creation
    await expect(authenticatedPage.locator('text=Rival United')).toBeVisible();
  });

  test('should record game action', async ({ authenticatedPage }) => {
    // Navigate to match
    await authenticatedPage.goto('/matches/1');
    
    // Start match
    await authenticatedPage.click('button:has-text("Start Match")');
    
    // Record goal
    await authenticatedPage.selectOption('select[name="playerId"]', '1');
    await authenticatedPage.selectOption('select[name="actionCode"]', 'GOAL');
    await authenticatedPage.fill('input[name="timestamp"]', '600');
    await authenticatedPage.click('button:has-text("Record Action")');
    
    // Verify action recorded
    await expect(authenticatedPage.locator('text=John Doe')).toBeVisible();
    await expect(authenticatedPage.locator('text=Goal')).toBeVisible();
  });

  test('should finish match with score', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/matches/1');
    
    // Set final score
    await authenticatedPage.fill('input[name="scoreOur"]', '3');
    await authenticatedPage.fill('input[name="scoreOpponent"]', '1');
    
    // Finish match
    await authenticatedPage.click('button:has-text("Finish Match")');
    
    // Verify status change
    await expect(authenticatedPage.locator('text=Completed')).toBeVisible();
    await expect(authenticatedPage.locator('text=3 - 1')).toBeVisible();
  });
});
```

### Coach Analysis Tests

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Coach Analysis', () => {
  test('should load player analysis', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/coach-analysis/players');
    
    // Wait for players to load
    await authenticatedPage.waitForSelector('text=Players Analysis');
    
    // Verify player cards visible
    const playerCards = await authenticatedPage.locator('[data-testid="player-card"]').count();
    expect(playerCards).toBeGreaterThan(0);
  });

  test('should add player observation', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/coach-analysis/players/1');
    
    // Add observation
    await authenticatedPage.fill('textarea[name="observation"]', 'Excellent positioning');
    await authenticatedPage.click('button:has-text("Save Observation")');
    
    // Verify observation added
    await expect(authenticatedPage.locator('text=Excellent positioning')).toBeVisible();
  });

  test('should display dashboard KPIs', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/coach-analysis/dashboard');
    
    // Wait for KPIs to load
    await authenticatedPage.waitForSelector('[data-testid="kpi-wins"]');
    
    // Verify KPI cards
    await expect(authenticatedPage.locator('text=Wins')).toBeVisible();
    await expect(authenticatedPage.locator('text=Total Matches')).toBeVisible();
    await expect(authenticatedPage.locator('text=Win %')).toBeVisible();
  });
});
```

### Player Management Tests

```typescript
import { test, expect } from './fixtures/auth.fixture';

test.describe('Player Management', () => {
  test('should create player', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/players');
    
    // Open create player dialog
    await authenticatedPage.click('button:has-text("Add Player")');
    
    // Fill form
    await authenticatedPage.fill('input[name="firstName"]', 'John');
    await authenticatedPage.fill('input[name="lastName"]', 'Striker');
    await authenticatedPage.fill('input[name="email"]', 'john@test.com');
    await authenticatedPage.fill('input[name="jerseyNumber"]', '10');
    await authenticatedPage.selectOption('select[name="categoryId"]', '1');
    
    // Submit
    await authenticatedPage.click('button:has-text("Create Player")');
    
    // Verify creation
    await expect(authenticatedPage.locator('text=John Striker')).toBeVisible();
  });

  test('should upload player photo', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/players/1');
    
    // Upload photo
    const fileInput = authenticatedPage.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/player-photo.jpg');
    
    // Wait for upload
    await authenticatedPage.waitForSelector('img[data-testid="player-photo"]');
    
    // Verify photo uploaded
    const photoElement = authenticatedPage.locator('img[data-testid="player-photo"]');
    await expect(photoElement).toHaveAttribute('src', /https:\/\/minio/);
  });
});
```

## Performance Testing

### Performance Measurements

```typescript
import { test, expect } from '@playwright/test';

test('should load coach analysis within budget', async ({ page }) => {
  const startTime = Date.now();
  
  await page.goto('/login');
  await page.fill('input[name="email"]', 'coach@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button:has-text("Login")');
  
  await page.goto('/coach-analysis/players');
  await page.waitForSelector('[data-testid="player-card"]');
  
  const duration = Date.now() - startTime;
  
  // Should load within 2 seconds
  expect(duration).toBeLessThan(2000);
  
  console.log(`Coach analysis loaded in ${duration}ms`);
});
```

## Accessibility Testing

### Testing WCAG 2.1 AA Compliance

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('should pass WCAG 2.1 AA on login page', async ({ page }) => {
    await page.goto('/login');
    
    // Inject axe
    await injectAxe(page);
    
    // Check accessibility
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/matches');
    
    // Verify form labels
    const emailInput = page.locator('input[name="email"]');
    const ariaLabel = await emailInput.getAttribute('aria-label');
    expect(ariaLabel || (await emailInput.locator('..label').textContent())).toBeTruthy();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form
    await page.keyboard.press('Tab'); // Focus email
    await page.keyboard.type('user@test.com');
    
    await page.keyboard.press('Tab'); // Focus password
    await page.keyboard.type('password123');
    
    await page.keyboard.press('Tab'); // Focus submit
    await page.keyboard.press('Enter'); // Submit
    
    // Should successfully submit
    await expect(page).toHaveURL('/matches');
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Run tests in watch mode
npm test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Run E2E tests in UI mode
npm run test:e2e:ui

# Generate coverage report
npm test -- --coverage
```

## Test Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Critical paths | 100% | ✓ |
| Components | 80% | ✓ |
| Hooks | 90% | ✓ |
| Utilities | 85% | ✓ |
| Overall | 70% | ✓ |

Critical paths (must have E2E):
- Login/logout
- Match creation
- Player management
- Coach analysis
- Dashboard

## Best Practices

### 1. Test User Interactions, Not Implementation

❌ **Bad**: Tests component state directly
```typescript
expect(component.state.isLoading).toBe(false);
```

✅ **Good**: Tests visible behavior
```typescript
expect(screen.getByText('Loading...')).not.toBeInTheDocument();
```

### 2. Use Accessible Queries

❌ **Bad**: Uses testid for everything
```typescript
screen.getByTestId('submit-button');
```

✅ **Good**: Uses semantic queries
```typescript
screen.getByRole('button', { name: /submit/i });
```

### 3. Test User Flows, Not Components

❌ **Bad**: Individual component tests
```typescript
test('Input accepts text', ...)
test('Button can be clicked', ...)
test('Form submits', ...)
```

✅ **Good**: Integration tests
```typescript
test('User can fill and submit form', ...)
```

### 4. Wait for Async Operations

❌ **Bad**: No wait for async
```typescript
await user.click(button);
const result = screen.getByText('Success');
```

✅ **Good**: Proper async handling
```typescript
await user.click(button);
await expect(screen.getByText('Success')).toBeVisible();
```

## Debugging Tests

```bash
# Run test with debug output
npm test -- --debug

# Run E2E test with inspector
npm run test:e2e:debug

# View test report
npm run test:e2e -- --reporter=html
open playwright-report/index.html
```

## CI/CD Integration

**GitHub Actions** (`.github/workflows/test.yml`):
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

**Last Updated**: 2026-10-04  
**Status**: Frontend testing infrastructure ready
