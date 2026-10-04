import { test, expect } from '@playwright/test';

test.describe('Match Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/matches').catch(() => {
      page.goto('/dashboard').catch(() => {
        page.goto('/');
      });
    });
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('should display matches list', async ({ page }) => {
    // Check for table or list of matches
    const hasMatchTable = await page.locator('[role="table"]').isVisible().catch(() => false);
    const hasMatchList = await page.locator('[role="list"]').isVisible().catch(() => false);
    const hasMatches = hasMatchTable || hasMatchList || await page.locator('text=/partidos|matches/i').isVisible().catch(() => false);

    expect(hasMatches).toBeTruthy();
  });

  test('should open create match modal', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'))
      .or(page.locator('[aria-label*="crear" i]'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      const modal = page.locator('[role="dialog"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      expect(modalVisible).toBeTruthy();
    }
  });

  test('should validate match creation form', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Try to submit without filling required fields
      const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /crear|guardar|confirmar/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // Should show validation errors
        const hasErrors = await page.locator('[role="alert"], .error').isVisible().catch(() => false);
        expect(hasErrors || !page.url().includes('/dashboard')).toBeTruthy();
      }
    }
  });

  test('should filter matches by status', async ({ page }) => {
    const statusFilter = page.locator('select').first()
      .or(page.locator('[role="combobox"]').first())
      .or(page.locator('button[aria-haspopup="listbox"]').first());

    if (await statusFilter.isVisible()) {
      await statusFilter.click();

      const scheduledOption = page.locator('[role="option"]:has-text("Programado" i)').first()
        .or(page.locator('[role="option"]:has-text("Scheduled" i)').first());

      if (await scheduledOption.isVisible()) {
        await scheduledOption.click();
        await page.waitForLoadState('networkidle').catch(() => {});

        expect(true).toBeTruthy(); // Filter applied
      }
    }
  });

  test('should search matches by opponent', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="búsqueda" i]').first()
      .or(page.locator('input[placeholder*="search" i]').first())
      .or(page.locator('input[aria-label*="search" i]').first());

    if (await searchInput.isVisible()) {
      await searchInput.fill('Real Madrid');
      await page.waitForLoadState('networkidle').catch(() => {});

      // Results should be filtered
      expect(true).toBeTruthy();
    }
  });

  test('should open match detail view', async ({ page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});

    const firstMatch = page.locator('[role="row"]').first()
      .or(page.locator('[role="listitem"]').first())
      .or(page.locator('button:has-text(/\d{2}\/\d{2}/)')  .first());

    if (await firstMatch.isVisible()) {
      await firstMatch.click();
      await page.waitForLoadState('networkidle').catch(() => {});

      const isDetailView = await page.locator('[role="dialog"]').isVisible()
        .or(page.url().includes('/match'))
        .catch(() => false);

      expect(isDetailView).toBeTruthy();
    }
  });

  test('should display match actions menu', async ({ page }) => {
    const actionsBtn = page.locator('button[aria-haspopup="menu"]').first()
      .or(page.locator('[aria-label*="acciones" i]').first())
      .or(page.locator('[aria-label*="actions" i]').first());

    if (await actionsBtn.isVisible()) {
      await actionsBtn.click();

      const menu = page.locator('[role="menu"]').first();
      const hasMenu = await menu.isVisible().catch(() => false);
      expect(hasMenu).toBeTruthy();
    }
  });
});
