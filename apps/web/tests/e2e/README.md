# E2E Tests with Playwright

End-to-end tests for VeloceSports web application using Playwright Test Framework.

## Setup

Playwright is already installed in `package.json`. No additional setup required.

## Test Files

### auth.e2e.test.ts
Tests authentication flows and UI interactions on login page.

**Coverage:**
- Login form rendering and visibility
- Error handling with invalid credentials
- Form validation (empty fields, invalid email)
- Accessibility attributes
- Password visibility toggle
- Form submission state
- Logout flow

**Run:**
```bash
npm run test:e2e -- auth.e2e.test.ts
```

### match-capture.e2e.test.ts
Tests match capture interface and live action recording.

**Coverage:**
- Match list display and pagination
- Match filtering by status
- Match detail page navigation
- Action capture form rendering
- Form validation
- Recording game actions
- Actions log display
- Attendance management
- Keyboard shortcuts

**Run:**
```bash
npm run test:e2e -- match-capture.e2e.test.ts
```

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test File
```bash
npm run test:e2e -- auth.e2e.test.ts
```

### Specific Test
```bash
npm run test:e2e -- --grep "should display login form"
```

### UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Debug Mode
```bash
npm run test:e2e:debug
```

### Headed Mode (See Browser)
```bash
npm run test:e2e -- --headed
```

### Specific Browser
```bash
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit
```

### Generate Report
```bash
npm run test:e2e -- --reporter=html
npx playwright show-report
```

## Configuration

### playwright.config.ts
Key configurations:
- **baseURL**: http://localhost:5173 (configurable via BASE_URL env var)
- **testDir**: ./tests/e2e
- **webServer**: Auto-starts dev server before tests
- **Workers**: Parallel execution (1 in CI, multiple locally)
- **Retries**: 0 locally, 2 in CI
- **Reporters**: HTML, JSON, JUnit (for CI integration)

### Screenshots & Videos
- Screenshots captured on test failure
- Videos captured on test failure
- Stored in `test-results/` directory

## Test Patterns

### Waiting for Elements
```typescript
// Wait for visibility
await expect(page.locator('button')).toBeVisible();

// Wait with timeout
await expect(element).toBeVisible({ timeout: 5000 });

// Custom wait
await page.waitForLoadState('networkidle');
```

### Form Interactions
```typescript
// Fill input
await page.fill('input[type="email"]', 'test@example.com');

// Select dropdown
await select.selectOption('OPTION_VALUE');

// Click button
await page.click('button[type="submit"]');
```

### Accessibility Testing
```typescript
// Check for aria attributes
await expect(element).toHaveAttribute('aria-label', /.+/);

// Check role
await expect(element).toHaveAttribute('role', 'button');
```

### Network Mocking
```typescript
// Wait for API response
const responsePromise = page.waitForResponse(
  response => response.url().includes('/api/matches'),
  { timeout: 5000 }
);

await button.click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

## Best Practices

1. **Use Page Object Model** for complex tests
2. **Avoid hardcoding waits** - use explicit waits
3. **Test user interactions** not implementation details
4. **Use descriptive test names** - describe what is tested
5. **Use data-testid** attributes in components for reliable selectors
6. **Mock authentication** with cookies in beforeEach
7. **Test critical paths** first
8. **Use .catch(() => false)** for optional elements

## Example Test Structure

```typescript
test.describe('Feature E2E Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup: Navigate, set cookies, etc
    await context.addCookies([...]);
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Arrange: Element is visible
    await expect(page.locator('selector')).toBeVisible();
    
    // Act: User interacts
    await page.click('button');
    
    // Assert: Verify result
    await expect(page).toHaveURL(/expected-url/);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup if needed
  });
});
```

## Debugging Tips

1. **Use test.only()** to run single test
2. **Use test.skip()** to skip tests
3. **Use page.pause()** to pause execution
4. **Check screenshots** in test-results/
5. **View videos** in test-results/ for failures
6. **Use --debug flag** to step through test
7. **Use page.screenshot()** to debug visuals

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run E2E tests
  run: npm run test:e2e
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: apps/web/test-results/
```

## Future Enhancements

- [ ] Page Object Model for reusable components
- [ ] Visual regression testing
- [ ] Performance testing with Lighthouse
- [ ] Mobile device testing
- [ ] Accessibility audits (axe)
- [ ] Test data fixtures
- [ ] Mock API responses
- [ ] Cross-browser compatibility testing
- [ ] Load testing scripts

## Troubleshooting

### Tests timeout
- Increase timeout in config
- Check if dev server is running
- Verify selectors are correct

### Flaky tests
- Add explicit waits
- Use data-testid attributes
- Avoid hardcoded delays
- Check for race conditions

### Selector issues
- Use page.locator('text=') for text matching
- Use data-testid for reliable selectors
- Avoid overly complex CSS selectors
- Use accessibility selectors (role, aria-label)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)
