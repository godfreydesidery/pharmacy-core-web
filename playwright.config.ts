import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the production build (npm run serve:prod) and a running API.
 * Headed and maximised by default, as the full-test skill requires; CI=1 runs headless.
 */
const headless = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'docs/.qa/playwright-report', open: 'never' }]],
  outputDir: 'docs/.qa/test-results',
  use: {
    baseURL: process.env['APP_URL'] ?? 'http://localhost:4300',
    headless,
    viewport: headless ? { width: 1600, height: 1000 } : null,
    launchOptions: {
      args: headless ? [] : ['--start-maximized'],
      slowMo: Number(process.env['PLAYWRIGHT_SLOW_MO'] ?? 0),
    },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run serve:prod',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
