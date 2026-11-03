import { expect, test } from '@playwright/test';

/** Form rules that depend on live data. Needs the API with the demo tenant. */

test('a product in stock has its tracking mode locked', async ({ page }) => {
  await page.goto('/sign-in');
  await page.locator('#email').fill('admin@afya.co.tz');
  await page.locator('#password').fill('Afya#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/workspace|dashboard/);
  if (page.url().includes('workspace')) {
    await page.locator('.option', { hasText: /head office/i }).click();
    await page.waitForURL(/dashboard/);
  }

  await page.goto('/catalogue/products');
  await page.locator('tr.clickable', { hasText: /paracetamol 500mg/i }).first().click();
  await page.waitForURL(/catalogue\/products\/[0-9a-f-]{36}/);
  const tracking = page.locator('.tracking');
  await expect(tracking).toHaveClass(/locked/);
  await expect(tracking.locator('input[type=radio]').first()).toBeDisabled();
  await expect(page.getByText(/Locked: \d+ units are held in stock/)).toBeVisible();
});
