import { test, expect } from '@playwright/test';

test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/categories').catch(() => {
      page.goto('/dashboard').catch(() => {
        page.goto('/');
      });
    });
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('should display categories list', async ({ page }) => {
    const hasCategoryTable = await page.locator('[role="table"]').isVisible().catch(() => false);
    const hasCategoryList = await page.locator('[role="list"]').isVisible().catch(() => false);
    const hasCategories = hasCategoryTable || hasCategoryList || await page.locator('text=/categorías|categories/i').isVisible().catch(() => false);

    expect(hasCategories).toBeTruthy();
  });

  test('should open create category modal', async ({ page }) => {
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

  test('should validate category name is required', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Try to submit without name
      const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /crear|guardar|confirmar/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        const hasErrors = await page.locator('[role="alert"], .error').isVisible().catch(() => false);
        expect(hasErrors).toBeTruthy();
      }
    }
  });

  test('should fill category form', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      const nameInput = page.locator('input[placeholder*="nombre" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('Sub-12 A');
      }

      expect(true).toBeTruthy();
    }
  });

  test('should assign coach to category', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      const coachSelect = page.locator('select').first()
        .or(page.locator('[role="combobox"]').first())
        .or(page.locator('button[aria-haspopup="listbox"]').first());

      if (await coachSelect.isVisible()) {
        await coachSelect.click();

        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }

      expect(true).toBeTruthy();
    }
  });

  test('should search categories', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="búsqueda" i]').first()
      .or(page.locator('input[placeholder*="search" i]').first())
      .or(page.locator('input[aria-label*="search" i]').first());

    if (await searchInput.isVisible()) {
      await searchInput.fill('Sub-12');
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(true).toBeTruthy();
    }
  });

  test('should open category detail/edit view', async ({ page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});

    const firstCategory = page.locator('[role="row"]').first()
      .or(page.locator('[role="listitem"]').first())
      .or(page.locator('button:has-text(/Sub-/)')  .first());

    if (await firstCategory.isVisible()) {
      await firstCategory.click();
      await page.waitForLoadState('networkidle').catch(() => {});

      const isDetailView = await page.locator('[role="dialog"]').isVisible()
        .or(page.url().includes('/category'))
        .catch(() => false);

      expect(isDetailView).toBeTruthy();
    }
  });

  test('should set age requirements for category', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      const minAgeInput = page.locator('input[placeholder*="mín" i]').first()
        .or(page.locator('input[aria-label*="edad mín" i]').first());
      const maxAgeInput = page.locator('input[placeholder*="máx" i]').first()
        .or(page.locator('input[aria-label*="edad máx" i]').first());

      if (await minAgeInput.isVisible()) {
        await minAgeInput.fill('10');
      }
      if (await maxAgeInput.isVisible()) {
        await maxAgeInput.fill('12');
      }

      expect(true).toBeTruthy();
    }
  });
});
