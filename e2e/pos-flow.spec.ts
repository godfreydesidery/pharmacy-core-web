import { expect, test } from '@playwright/test';

/**
 * A cashier sells at the POS through the UI: search, add to cart, pay exact cash, complete the
 * sale, see the receipt, and find the sale in the history. Needs the API with the demo tenant.
 */
test('cashier sells Paracetamol for exact cash and finds it in the sales history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 500) {
      errors.push(`api ${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/sign-in');
  await page.locator('#email').fill('cashier@afya.co.tz');
  await page.locator('#password').fill('Cashier#2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/dashboard/);

  await page.goto('/pos');
  await page.waitForLoadState('networkidle');
  const search = page.locator('.catalogue .search input');
  await search.fill('Paracetamol');
  const product = page.locator('.product', { hasText: 'Paracetamol' }).first();
  await expect(product).toBeVisible();
  await product.click();

  await page.getByRole('button', { name: /^exact$/i }).click();
  const complete = page.locator('button.btn.success');
  await expect(complete).toBeEnabled();
  await complete.click();

  const receipt = page.getByText(/INV-HQ-\d{6}/).first();
  await expect(receipt).toBeVisible({ timeout: 15_000 });
  const number = (await receipt.innerText()).match(/INV-HQ-\d{6}/)![0];

  await page.goto('/sales');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(number).first()).toBeVisible();
  expect(errors).toEqual([]);
});
