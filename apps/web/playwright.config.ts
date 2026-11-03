import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:63781',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: { command: 'npm run start -- --port 63781', url: 'http://localhost:63781', reuseExistingServer: !process.env.CI },
});
