import { expect, Page, test } from '@playwright/test';

/**
 * Clicks every sidebar entry and every user-menu entry the way a person would, and checks each
 * click lands on its page. Route sweeps use page.goto and cannot catch a link that does nothing.
 */

const USERS = {
  admin: { email: 'admin@afya.co.tz', password: 'Afya#2026' },
  cashier: { email: 'cashier@afya.co.tz', password: 'Cashier#2026' },
  root: { email: 'root@pharmacy.local', password: 'Root#2026' },
};

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // One tenant and one branch enter automatically; otherwise pick Afya, then its head office.
  const entered = () =>
    page.waitForURL(/dashboard|pos/, { timeout: 4_000 }).then(
      () => true,
      () => false,
    );
  if (await entered()) return;
  const picker = page.locator('.option');
  const afya = picker.filter({ hasText: /afya pharmacy/i });
  if (await afya.isVisible().catch(() => false)) await afya.click();
  if (await entered()) return;
  await picker.filter({ hasText: /head office/i }).click();
  await page.waitForURL(/dashboard|pos/);
}

/** Every link in the sidebar, opening each group first; returns the paths that failed. */
async function clickSidebar(page: Page): Promise<string[]> {
  const failed: string[] = [];
  const nav = page.locator('aside nav');
  const groups = nav.locator('.group');
  for (let g = 0; g < (await groups.count()); g++) {
    const group = groups.nth(g);
    if (!(await group.evaluate((el) => el.classList.contains('open')))) {
      await group.locator('button.item').click();
    }
    await expect(group.locator('.sub')).toBeVisible();
  }
  const links = nav.locator('a[href]');
  const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
  for (const href of hrefs) {
    const link = nav.locator(`a[href="${href}"]`).first();
    if (!(await link.isVisible())) {
      // A group may have been collapsed by the page; reopen it.
      await link.locator('xpath=ancestor::div[contains(@class,"group")]/button').click();
    }
    await link.click();
    const landed = await page
      .waitForURL((url) => url.pathname === href, { timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    if (!landed) failed.push(`${href} (stayed on ${new URL(page.url()).pathname})`);
  }
  return failed;
}

for (const role of ['admin', 'cashier', 'root'] as const) {
  test(`${role}: every sidebar link navigates`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page, USERS[role]);
    expect(await clickSidebar(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('collapsed sidebar: every group link opens from its flyout', async ({ page }) => {
  await signIn(page, USERS.admin);
  await page.locator('.topbar .icon-btn').first().click(); // collapse
  await expect(page.locator('app-shell')).toHaveClass(/collapsed/);
  const groups = page.locator('aside nav .group');
  const failed: string[] = [];
  for (let g = 0; g < (await groups.count()); g++) {
    const group = groups.nth(g);
    const hrefs = await group
      .locator('.sub a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
    for (const href of hrefs) {
      await group.locator('button.item').click();
      const link = group.locator(`.sub a[href="${href}"]`);
      await expect(link).toBeVisible();
      await link.click(); // a real click: fails if anything covers the link
      const landed = await page
        .waitForURL((url) => url.pathname === href, { timeout: 5_000 })
        .then(
          () => true,
          () => false,
        );
      if (!landed) failed.push(href);
      await expect(group.locator('.sub')).toBeHidden(); // the flyout closes after navigating
    }
  }
  expect(failed).toEqual([]);

  // Escape and an outside click close an open flyout.
  await groups.first().locator('button.item').click();
  await expect(groups.first().locator('.sub')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(groups.first().locator('.sub')).toBeHidden();
  await groups.first().locator('button.item').click();
  await page.locator('main').click({ position: { x: 400, y: 20 } });
  await expect(groups.first().locator('.sub')).toBeHidden();
});

test('a tab from an older build still opens pages after a deploy', async ({ page }) => {
  await signIn(page, USERS.admin);
  // The next page chunk is "gone", as when a rebuild replaced the files this tab knows about.
  let gone = true;
  await page.route(/\/chunk-[^/]+\.js$/, (route) => {
    if (gone) {
      gone = false;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
    }
    return route.continue();
  });
  const group = page.locator('aside .group', { hasText: /inventory/i });
  if (!(await group.evaluate((el) => el.classList.contains('open')))) {
    await group.locator('button.item').click();
  }
  await group.locator('.sub a[href="/inventory/expiry"]').click();
  await page.waitForURL((url) => url.pathname === '/inventory/expiry');
  await expect(page.locator('main h1').first()).toBeVisible();
  expect(gone).toBe(false);
});

test('user menu: account, switch pharmacy and sign out respond', async ({ page }) => {
  await signIn(page, USERS.admin);
  for (const [name, path] of [
    [/account|akaunti/i, '/account'],
    [/switch|badilisha/i, '/workspace'],
  ] as const) {
    await page.goto('/dashboard');
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name }).click();
    await page.waitForURL((url) => url.pathname === path, { timeout: 5_000 });
  }
  await page.goto('/dashboard');
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: /sign out|toka/i }).click();
  await page.waitForURL(/sign-in/);
});
