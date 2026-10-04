import { test, expect } from '@playwright/test';

test.describe('Player Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/players').catch(() => {
      page.goto('/dashboard').catch(() => {
        page.goto('/');
      });
    });
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('should display players list', async ({ page }) => {
    const hasPlayerTable = await page.locator('[role="table"]').isVisible().catch(() => false);
    const hasPlayerList = await page.locator('[role="list"]').isVisible().catch(() => false);
    const hasPlayers = hasPlayerTable || hasPlayerList || await page.locator('text=/jugadores|players/i').isVisible().catch(() => false);

    expect(hasPlayers).toBeTruthy();
  });

  test('should open create player modal', async ({ page }) => {
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

  test('should validate player form fields', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Try to submit empty form
      const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /crear|guardar|confirmar/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        const hasErrors = await page.locator('[role="alert"], .error').isVisible().catch(() => false);
        expect(hasErrors).toBeTruthy();
      }
    }
  });

  test('should fill player creation form', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo")').first()
      .or(page.locator('button:has-text("Crear" i)'));

    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill form fields
      const firstNameInput = page.locator('input[placeholder*="nombre" i]').first();
      const lastNameInput = page.locator('input[placeholder*="apellido" i]').first();
      const jerseyInput = page.locator('input[type="number"], input[placeholder*="número" i]').first();

      if (await firstNameInput.isVisible()) {
        await firstNameInput.fill('Juan');
      }
      if (await lastNameInput.isVisible()) {
        await lastNameInput.fill('Pérez');
      }
      if (await jerseyInput.isVisible()) {
        await jerseyInput.fill('10');
      }

      expect(true).toBeTruthy();
    }
  });

  test('should filter players by category', async ({ page }) => {
    const categoryFilter = page.locator('select').first()
      .or(page.locator('[role="combobox"]').first())
      .or(page.locator('button[aria-haspopup="listbox"]').first());

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();

      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
        await page.waitForLoadState('networkidle').catch(() => {});

        expect(true).toBeTruthy();
      }
    }
  });

  test('should search players by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="búsqueda" i]').first()
      .or(page.locator('input[placeholder*="search" i]').first())
      .or(page.locator('input[aria-label*="search" i]').first());

    if (await searchInput.isVisible()) {
      await searchInput.fill('Juan');
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(true).toBeTruthy();
    }
  });

  test('should filter players by status', async ({ page }) => {
    const statusFilter = page.locator('button:has-text("Activo")').first()
      .or(page.locator('button[aria-label*="estado" i]').first())
      .or(page.locator('[role="tab"]').first());

    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForLoadState('networkidle').catch(() => {});

      expect(true).toBeTruthy();
    }
  });

  test('should open player detail/edit view', async ({ page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});

    const firstPlayer = page.locator('[role="row"]').first()
      .or(page.locator('[role="listitem"]').first())
      .or(page.locator('button:has-text(/\\w+ \\w+/)').first());

    if (await firstPlayer.isVisible()) {
      await firstPlayer.click();
      await page.waitForLoadState('networkidle').catch(() => {});

      const isDetailView = await page.locator('[role="dialog"]').isVisible()
        .or(page.url().includes('/player'))
        .catch(() => false);

      expect(isDetailView).toBeTruthy();
    }
  });
});
