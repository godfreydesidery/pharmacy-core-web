import { expect, Page, test } from '@playwright/test';

/**
 * Smoke sweep: signs in as each seeded role, chooses the workspace, and opens every route the
 * role may use, failing on console errors, uncaught exceptions and API 404/405/5xx responses.
 * Needs the API running with the local profile (demo tenant AFYA).
 */

const ADMIN = { email: process.env['E2E_EMAIL'] ?? 'admin@afya.co.tz', password: process.env['E2E_PASSWORD'] ?? 'Afya#2026' };
const CASHIER = { email: 'cashier@afya.co.tz', password: 'Cashier#2026' };
const ROOT = { email: process.env['E2E_ROOT_EMAIL'] ?? 'root@pharmacy.local', password: process.env['E2E_ROOT_PASSWORD'] ?? 'Root#2026' };

const TENANT_ROUTES = [
  '/dashboard',
  '/pos',
  '/sales',
  '/sales/returns',
  '/inventory/stock',
  '/inventory/expiry',
  '/inventory/movements',
  '/inventory/adjustments',
  '/inventory/transfers',
  '/purchasing/orders',
  '/purchasing/orders/new',
  '/purchasing/receipts',
  '/purchasing/receipts/new',
  '/catalogue/products',
  '/catalogue/products/new',
  '/catalogue/categories',
  '/catalogue/manufacturers',
  '/customers',
  '/suppliers',
  '/receivables',
  '/insurance/claims',
  '/insurance/batches',
  '/insurance/remittances',
  '/insurance/payers',
  '/insurance/members',
  '/finance/expenses',
  '/finance/accounts',
  '/finance/journal',
  '/finance/exchange-rates',
  '/finance/supplier-payments',
  '/reports',
  '/notifications',
  '/account',
  '/admin/users',
  '/admin/roles',
  '/admin/branches',
  '/admin/settings',
  '/admin/webhooks',
  '/admin/notifications',
  '/admin/audit',
  '/sales/shifts',
  '/sales/vouchers',
  '/inventory/controlled',
  '/inventory/repack',
  '/inventory/stock-counts',
  '/inventory/recalls',
  '/inventory/destructions',
  '/purchasing/reorder',
  '/purchasing/supplier-returns',
  '/catalogue/pricing',
  '/finance/statements',
  '/finance/opening-balances',
  '/finance/period-lock',
  '/admin/payment-methods',
  '/admin/subscription',
];
/** List pages whose first row links to a detail page. */
const DETAIL_FROM = ['/sales', '/catalogue/products', '/purchasing/receipts', '/receivables', '/platform/tenants'];
const PLATFORM_ROUTES = [
  '/platform',
  '/platform/tenants',
  '/platform/root-admins',
  '/platform/audit',
  '/platform/plans',
  '/platform/payment-methods',
  '/platform/message-providers',
];

type Problems = string[];

function watch(page: Page): Problems {
  const problems: Problems = [];
  page.on('console', (message) => {
    // Playwright injects its helper script into every frame. The email-template preview is an
    // iframe with an empty sandbox (no scripts, by design), so Chrome logs that it blocked
    // Playwright's injection. Real users see no such message; anything else still fails.
    const sandboxedPreview = /Blocked script execution in 'about:(blank|srcdoc)'.*sandboxed/.test(message.text());
    if (message.type() === 'error' && !sandboxedPreview) problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const status = response.status();
    if (response.url().includes('/api/') && (status === 404 || status === 405 || status >= 500)) {
      problems.push(`api ${status}: ${response.request().method()} ${response.url()}`);
    }
  });
  return problems;
}

async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

/** Picks Afya Pharmacy (when asked) and then its head office (when asked). */
async function chooseWorkspace(page: Page) {
  const dashboard = () => page.waitForURL(/dashboard/, { timeout: 4_000 }).then(() => true, () => false);
  if (await dashboard()) return; // one tenant and one branch: entered automatically
  const picker = page.locator('.option');
  const afya = picker.filter({ hasText: /afya pharmacy/i });
  if (await afya.isVisible().catch(() => false)) await afya.click();
  if (await dashboard()) return;
  await picker.filter({ hasText: /head office/i }).click();
  await page.waitForURL(/dashboard/);
}

async function sweep(page: Page, routes: string[], problems: Problems) {
  for (const route of routes) {
    const before = problems.length;
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toBeEmpty();
    const found = problems.slice(before);
    expect.soft(found, `problems on ${route}`).toEqual([]);
  }
}

test('admin opens every tenant route without errors', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  await chooseWorkspace(page);
  await sweep(page, TENANT_ROUTES, problems);
});

test('cashier reaches the POS but not administration', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, CASHIER);
  await chooseWorkspace(page);
  await sweep(page, ['/dashboard', '/pos', '/sales', '/inventory/stock'], problems);
  await page.goto('/admin/users');
  await expect(page).not.toHaveURL(/admin\/users$/);
});

test('root administrator opens the platform screens', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ROOT);
  await page.waitForURL(/workspace|platform|dashboard/);
  await sweep(page, PLATFORM_ROUTES, problems);
});

/** Opens the first detail link of a list page, if it has rows, and checks it like a route. */
async function openFirstDetail(page: Page, list: string, problems: Problems) {
  await page.goto(list);
  await page.waitForLoadState('networkidle');
  const link = page.locator(`main a[href^="${list}/"]`).first();
  if (!(await link.isVisible().catch(() => false))) return;
  const before = problems.length;
  await link.click();
  await page.waitForLoadState('networkidle');
  expect.soft(problems.slice(before), `problems on detail of ${list} (${page.url()})`).toEqual([]);
}

test('admin opens detail pages (sale, product, receipt, customer account, statement)', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  await chooseWorkspace(page);
  for (const list of DETAIL_FROM.filter((l) => !l.startsWith('/platform'))) {
    await openFirstDetail(page, list, problems);
  }
  await openFirstDetail(page, '/receivables', problems);
  const statement = page.locator('a[href$="/statement"]').first();
  if (await statement.isVisible().catch(() => false)) {
    await statement.click();
    await page.waitForLoadState('networkidle');
  }
  expect.soft(problems, 'problems on detail pages').toEqual([]);
});

test('Swahili: every page renders translated text, never raw keys', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ADMIN);
  await chooseWorkspace(page);
  await page.evaluate(() => localStorage.setItem('pharmacy.lang', 'sw'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', /sw/);
  for (const route of TENANT_ROUTES) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    const raw = text.match(/(nav|common|pos|sales|inventory|purchasing|catalogue|partners|finance|reports|admin|platform|receivables|insurance|notifications|enum)\.[a-z][A-Za-z0-9.]+/g) ?? [];
    expect.soft(raw, `raw i18n keys on ${route}`).toEqual([]);
  }
  expect.soft(problems, 'problems in Swahili').toEqual([]);
});

test('root administrator opens a tenant detail page', async ({ page }) => {
  const problems = watch(page);
  await signIn(page, ROOT);
  await page.waitForURL(/workspace|platform|dashboard/);
  await openFirstDetail(page, '/platform/tenants', problems);
  expect.soft(problems).toEqual([]);
});
