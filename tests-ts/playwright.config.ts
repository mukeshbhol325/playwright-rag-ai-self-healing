import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/utils/globalSetup.ts',
  // The public OpenCart demo is a shared, session-based site: run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['./src/reporters/healingReporter.ts'],
  ],
  use: {
    baseURL: env.baseUrl,
    locale: 'en-GB',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: (process.env.VIDEO_MODE as 'on' | 'off' | 'retain-on-failure' | undefined) ?? 'retain-on-failure',
    // Optional: use a system/bundled Chromium (corporate proxies, air-gapped CI).
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
