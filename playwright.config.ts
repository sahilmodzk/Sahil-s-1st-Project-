import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
if (existsSync('.env')) loadEnvFile('.env');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    ...devices['Desktop Chrome'],
    launchOptions: existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
