import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke, accessibility and layout checks against a running stack (seeded demo data).
 * Defaults to the Vite dev server; set E2E_BASE_URL=http://localhost:8000 to test the
 * production build served by Django (`make build` first).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    // Phones: the core journeys plus phone-specific checks. iPhone sizing runs in Chromium so the
    // suite needs only one browser download; add `browserName: 'webkit'` once WebKit is installed.
    { name: 'pixel-7', use: { ...devices['Pixel 7'] }, testMatch: /(smoke|mobile)\.spec\.ts/ },
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testMatch: /(smoke|mobile)\.spec\.ts/ },
  ],
});
