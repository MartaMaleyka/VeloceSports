# E2E Tests with Playwright

This directory contains end-to-end tests for critical user paths in the VeloceSports web application.

## Test Coverage

### Authentication (`auth.spec.ts`)
- Login with valid credentials
- Error handling with invalid credentials
- Email format validation
- Password visibility toggle

### Signup (`signup.spec.ts`)
- Academy signup flow
- Independent signup flow
- Form validation
- Navigation between signup options

### Dashboard (`dashboard.spec.ts`)
- Main dashboard navigation
- Access to categories, players, and matches sections
- User menu functionality

### Players (`players.spec.ts`)
- Display players list
- Create new player
- Form validation
- Filter players by category
- Search players by name
- Filter by status
- Edit player details

### Categories (`categories.spec.ts`)
- Display categories list
- Create new category
- Category form validation
- Assign coaches to categories
- Search categories
- Set age requirements

### Matches (`matches.spec.ts`)
- Display matches list
- Create new match
- Form validation
- Filter matches by status
- Search matches by opponent
- Open match detail view
- Match actions menu

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests matching pattern
```bash
npx playwright test -g "should login"
```

### Generate HTML report
```bash
npx playwright test
npx playwright show-report
```

## Configuration

The Playwright configuration is defined in `playwright.config.ts`:

- **Base URL**: `http://localhost:3000`
- **Browsers**: Chromium, Firefox
- **Parallel Execution**: Enabled (unless in CI)
- **Retries**: 2 retries in CI, 0 in local development
- **Screenshots**: Captured on failure
- **Videos**: Recorded on failure
- **Traces**: Enabled for debugging

### Environment Variables

- `CI`: Set by CI/CD pipeline to enable strict mode
- `DEBUG`: Set to `pw:api` for detailed logging

## Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/path');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    const element = page.locator('selector');
    
    // Act
    await element.click();
    
    // Assert
    await expect(element).toBeVisible();
  });
});
```

### Best Practices

1. **Use semantic locators**: Prefer `role` attributes and text over CSS selectors
2. **Wait for page load**: Use `waitForLoadState('networkidle')`
3. **Graceful failures**: Use `.catch(() => false)` for optional UI elements
4. **Reusable helpers**: Use functions from `helpers.ts` for common actions
5. **Timeout handling**: Most async operations have 10-second timeouts
6. **Error resilience**: Tests should not fail if backend is not available

### Helper Functions

Import from `helpers.ts`:

```typescript
import { 
  loginAs,
  navigateTo,
  fillFormField,
  submitForm,
  expectErrorMessage,
  waitForTableData,
  expectNavigationTo
} from './helpers';
```

## CI/CD Integration

In GitHub Actions:
1. Install dependencies: `pnpm install`
2. Build web app: `pnpm build`
3. Run E2E tests: `pnpm test:e2e`
4. Upload artifacts for failed tests

Tests run:
- On every PR to main/develop
- After successful unit tests
- With retries enabled
- With screenshots and videos on failure

## Debugging

### Debug Mode
```bash
npx playwright test --debug
```

Launches with step-by-step debugger and inspector.

### Browser Context
```typescript
test.only('debug test', async ({ page, context }) => {
  // Set breakpoint or add logging
  console.log('Page URL:', page.url());
  await page.pause(); // Pause execution
});
```

### Taking Screenshots
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Generating Traces
```typescript
const context = await browser.newContext({ recordTrace: 'trace.zip' });
// ... run test ...
await context.tracing.stop({ path: 'trace.zip' });
```

## Known Limitations

1. **Backend Dependency**: Tests are resilient to backend unavailability but don't test API integration
2. **Authentication**: Login tests may not succeed without real backend
3. **Data Persistence**: Tests don't persist data between runs
4. **Real-time Features**: WebSocket and real-time updates not fully tested

## Future Enhancements

- [ ] API mocking with MSW (Mock Service Worker)
- [ ] Database fixtures for pre-seeded test data
- [ ] Visual regression testing
- [ ] Performance testing
- [ ] Accessibility testing (axe-core)
- [ ] Mobile/responsive testing
