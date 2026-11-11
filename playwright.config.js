import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:3917',
    headless: true,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node src/server.js',
    url: 'http://localhost:3917',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
