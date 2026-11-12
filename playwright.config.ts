import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [
    ['list'],
    ['executable-stories-playwright/reporter', { formats: ['html'], outputDir: path.join(import.meta.dirname, 'reports') }],
  ],
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4377', viewport: { width: 1280, height: 800 } },
  webServer: { command: 'pnpm build && node server.mjs', url: 'http://localhost:4377', reuseExistingServer: !process.env.CI },
});
