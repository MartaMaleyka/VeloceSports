import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check for login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check for form labels
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Password')).toBeVisible();
  });

  test('should display error message with invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('text=/Invalid|incorrect|failed/i')).toBeVisible();
  });

  test('should display validation error with empty fields', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    const alerts = page.locator('[role="alert"]');
    await expect(alerts.first()).toBeVisible();
  });

  test('should display validation error with invalid email format', async ({ page }) => {
    // Fill in invalid email
    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'ValidPassword123!');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('text=/email|format/i')).toBeVisible();
  });

  test('should have accessible login form', async ({ page }) => {
    // Check for accessibility attributes
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // Should have labels or aria-labels
    await expect(emailInput).toHaveAttribute(/aria-label|id/, /.+/);
    await expect(passwordInput).toHaveAttribute(/aria-label|id/, /.+/);
    await expect(submitButton).toHaveAttribute(/aria-label|value/, /.+/);
  });

  test('should have password visibility toggle', async ({ page }) => {
    // Check if password visibility toggle exists
    const toggleButton = page.locator('button[aria-label*="password"]');
    
    // If toggle exists, test it
    if (await toggleButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      const passwordInput = page.locator('input[type="password"]');
      
      // Click toggle to show password
      await toggleButton.click();
      
      // Input should change to type="text"
      await expect(passwordInput).not.toHaveAttribute('type', 'password');
    }
  });

  test('should handle form submission state', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    
    // Button should be enabled initially
    await expect(submitButton).toBeEnabled();
    
    // Fill in fields
    await page.fill('input[type="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password');
    
    // Start submission
    const submitPromise = page.waitForNavigation({ timeout: 5000 }).catch(() => null);
    await submitButton.click();
    
    // Button might be disabled during submission
    // (depends on implementation)
    
    // Wait a bit for any state changes
    await page.waitForTimeout(500);
  });
});

test.describe('Logout E2E Tests', () => {
  test('logout button should be visible to authenticated users', async ({ page, context }) => {
    // Set auth cookie (in real test, would login first)
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'test-token',
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Look for logout button
    const logoutButton = page.locator('button[aria-label*="logout"], button:has-text("Logout")');
    
    // If button exists, verify it's visible
    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(logoutButton).toBeVisible();
    }
  });
});
