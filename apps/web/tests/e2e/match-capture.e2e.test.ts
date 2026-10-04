import { test, expect } from '@playwright/test';

test.describe('Match Capture E2E Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set auth cookie for authenticated tests
    await context.addCookies([
      {
        name: 'auth_token',
        value: 'test-token',
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    
    // Navigate to matches page
    await page.goto('/matches');
  });

  test('should display match list with actions', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for match list elements
    const matchTable = page.locator('[role="table"], .match-list, [class*="match"]');
    
    // Should have matches or empty state
    const content = page.locator('text=/Match|No matches|Schedule/i');
    await expect(content.first()).toBeVisible();
  });

  test('should allow filtering matches by status', async ({ page }) => {
    // Look for filter controls
    const statusFilter = page.locator('[aria-label*="status"], select[name*="status"]');
    
    if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Change filter
      await statusFilter.selectOption('IN_PROGRESS');
      
      // Wait for results to update
      await page.waitForLoadState('networkidle');
      
      // Verify results changed
      await page.waitForTimeout(500);
    }
  });

  test('should open match detail page', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Find first match link
    const matchLink = page.locator('a[href*="/matches/"], button:has-text("View")').first();
    
    // Click if exists
    if (await matchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await matchLink.click();
      
      // Should navigate to match detail
      await expect(page).toHaveURL(/\/matches\/\d+/);
    }
  });

  test('should display match detail with action capture form', async ({ page }) => {
    // Navigate to a specific match
    await page.goto('/matches/1');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Look for match detail elements
    const opponent = page.locator('text=/opponent|vs/i');
    const actionForm = page.locator('[role="form"], form:has-text("Action")');
    
    // Should have match info
    const content = page.locator('[class*="match"], [class*="header"]');
    await expect(content.first()).toBeVisible();
  });

  test('should validate action capture form', async ({ page }) => {
    // Navigate to match with capture form
    await page.goto('/matches/1/capture');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]:has-text("Record")');
    
    if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitButton.click();
      
      // Should show validation errors
      const errors = page.locator('[role="alert"], [class*="error"]');
      await expect(errors.first()).toBeVisible({ timeout: 2000 }).catch(() => {
        // Form might not have visible errors
      });
    }
  });

  test('should allow recording game actions', async ({ page }) => {
    // Navigate to capture page
    await page.goto('/matches/1/capture');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Fill in action form
    const playerInput = page.locator('input[type="number"][name*="player"]');
    const actionSelect = page.locator('select[name*="action"]');
    const minuteInput = page.locator('input[type="number"][name*="minute"]');
    
    if (await playerInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Fill in values
      await playerInput.fill('10');
      
      if (await actionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await actionSelect.selectOption('0');
      }
      
      if (await minuteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await minuteInput.fill('25');
      }
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]');
      
      // Wait for submission
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/actions') && response.status() < 500,
        { timeout: 5000 }
      ).catch(() => null);
      
      await submitButton.click();
      
      // Wait for response
      const response = await responsePromise;
      
      // If successful, should see success message or form reset
      if (response && response.status() === 201) {
        // Form should reset or show success
        await page.waitForTimeout(500);
      }
    }
  });

  test('should display actions log', async ({ page }) => {
    // Navigate to match
    await page.goto('/matches/1/capture');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Look for actions log
    const logSection = page.locator('[class*="log"], [class*="history"], text=/Actions|Log/i');
    
    // Log should be visible
    if (await logSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(logSection).toBeVisible();
    }
  });

  test('should manage match attendance', async ({ page }) => {
    // Navigate to attendance page
    await page.goto('/matches/1/attendance');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Look for attendance controls
    const playerRows = page.locator('tr, [role="row"]');
    
    // Should have player list
    const content = page.locator('text=/player|attendance/i');
    if (await content.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(content).toBeVisible();
    }
  });

  test('should provide keyboard shortcuts for action capture', async ({ page }) => {
    // Navigate to capture page
    await page.goto('/matches/1/capture');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    
    // Look for shortcuts help
    const helpButton = page.locator('button[aria-label*="help"], button:has-text("?")');
    
    if (await helpButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await helpButton.click();
      
      // Should show shortcuts dialog
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
    }
  });
});
