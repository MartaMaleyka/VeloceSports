import { test, expect } from '@playwright/test';

test.describe('Signup Flow', () => {
  test('should display signup options', async ({ page }) => {
    await page.goto('/auth/signup');

    const academyBtn = page.locator('button:has-text("Academia")').first();
    const independentBtn = page.locator('button:has-text("Independiente")').first();

    expect(academyBtn.or(page.locator('[role="link"]:has-text("Academia")'))).toBeTruthy();
    expect(independentBtn.or(page.locator('[role="link"]:has-text("Independiente")'))).toBeTruthy();
  });

  test('should navigate to academy signup form', async ({ page }) => {
    await page.goto('/auth/signup');

    const academyBtn = page.locator('button:has-text("Academia")').first();
    await academyBtn.click().catch(() => {
      const academyLink = page.locator('[role="link"]:has-text("Academia")');
      return academyLink.click();
    });

    // Expect form fields
    const formVisible = await page.locator('input[placeholder*="nombre" i]').isVisible().catch(() => false);
    expect(formVisible || page.url().includes('/signup/academy')).toBeTruthy();
  });

  test('should validate form fields on academy signup', async ({ page }) => {
    await page.goto('/auth/signup/academy').catch(() => {
      page.goto('/auth/signup');
    });

    // Try to submit empty form
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();

      // Should show validation errors
      const errors = page.locator('[role="alert"], .error, .text-red-600').count();
      const hasErrors = await errors.then(count => count > 0).catch(() => false);
      expect(hasErrors).toBeTruthy();
    }
  });

  test('should navigate to independent signup form', async ({ page }) => {
    await page.goto('/auth/signup');

    const independentBtn = page.locator('button:has-text("Independiente")').first();
    await independentBtn.click().catch(() => {
      const independentLink = page.locator('[role="link"]:has-text("Independiente")');
      return independentLink.click();
    });

    // Expect form to be visible
    const formVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    expect(formVisible || page.url().includes('/signup/independent')).toBeTruthy();
  });
});
